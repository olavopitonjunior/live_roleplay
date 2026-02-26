"""
Custom FrameProcessors for the Pipecat PoC agent.

Intercepts frames in the pipeline to:
- Capture user and assistant transcriptions for the session transcript
- Strip stage directions from LLM output before TTS (Gemini includes them)
- Feed text to the shared EmotionAnalyzer for real-time emotion tracking
- Hume AI prosody-based emotion detection from user audio
- Track metrics (token counts, latencies) for cost comparison
"""

import asyncio
import base64
import json
import time
import logging
from typing import Optional

from pipecat.frames.frames import (
    Frame,
    InputAudioRawFrame,
    TranscriptionFrame,
    TextFrame,
    TTSAudioRawFrame,
    LLMFullResponseEndFrame,
)
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection, StartFrame

logger = logging.getLogger(__name__)


class TranscriptProcessor(FrameProcessor):
    """Captures user transcriptions (from STT) and assistant text (from LLM).

    Placed AFTER stt in the pipeline to intercept TranscriptionFrame (user speech).
    Assistant responses are captured via a separate method called from the LLM output side.
    """

    def __init__(self, scenario: dict, **kwargs):
        super().__init__(**kwargs)
        self.scenario = scenario
        self.transcript: list[dict] = []
        self.start_time = time.time()
        self._current_assistant_text = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TranscriptionFrame):
            # User speech transcribed by Deepgram
            elapsed = round(time.time() - self.start_time, 1)
            entry = {
                "speaker": "user",
                "text": frame.text,
                "timestamp": elapsed,
            }
            self.transcript.append(entry)
            logger.info(f"[USER t={elapsed}s] {frame.text}")

        await self.push_frame(frame, direction)

    def add_assistant_turn(self, text: str) -> None:
        """Called externally when a full assistant response is collected."""
        elapsed = round(time.time() - self.start_time, 1)
        entry = {
            "speaker": "avatar",
            "text": text,
            "timestamp": elapsed,
        }
        self.transcript.append(entry)
        logger.info(f"[AVATAR t={elapsed}s] {text[:80]}...")

    def get_transcript(self) -> list[dict]:
        return self.transcript


class AssistantTranscriptProcessor(FrameProcessor):
    """Captures assistant (LLM) text output for transcript recording.

    Placed AFTER llm in the pipeline. Collects TextFrame chunks and commits
    a full turn when LLMFullResponseEndFrame arrives.

    Also strips stage directions like ``(Com um tom frustrado)`` from LLM
    output so TTS doesn't verbalize them. Handles cross-chunk parentheses
    via a simple state machine.
    """

    def __init__(self, transcript_proc: TranscriptProcessor, **kwargs):
        super().__init__(**kwargs)
        self.transcript_proc = transcript_proc
        self._buffer = ""
        self._in_stage_direction = False

    def _strip_stage_directions(self, text: str) -> str:
        """Strip (stage directions) from text, handling cross-chunk spans."""
        result = []
        for char in text:
            if char == '(' and not self._in_stage_direction:
                self._in_stage_direction = True
            elif char == ')' and self._in_stage_direction:
                self._in_stage_direction = False
            elif not self._in_stage_direction:
                result.append(char)
        return ''.join(result)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TextFrame):
            clean = self._strip_stage_directions(frame.text)
            self._buffer += clean
            if clean.strip():
                await self.push_frame(TextFrame(text=clean), direction)
            return
        elif isinstance(frame, LLMFullResponseEndFrame):
            if self._buffer.strip():
                self.transcript_proc.add_assistant_turn(self._buffer.strip())
            self._buffer = ""
            self._in_stage_direction = False

        await self.push_frame(frame, direction)


class LazySimliVideoService:
    """Wrapper that delays Simli connection until first audio frame.

    SimliVideoService._start_connection() is normally called on StartFrame
    (pipeline start), but participants may join much later. Simli's server-side
    idle timeout (~6s) disconnects the session before any audio arrives,
    causing "WSDC Not ready" errors.

    This subclass overrides process_frame to:
    1. Skip _start_connection() on StartFrame (pipeline start)
    2. Call _start_connection() on the FIRST TTSAudioRawFrame instead
    """

    @staticmethod
    def create(**kwargs):
        """Factory that returns a LazySimliVideoService instance.

        Defers the import so --no-avatar mode doesn't require simli installed.
        """
        from pipecat.frames.frames import OutputImageRawFrame
        from pipecat.services.simli.video import SimliVideoService as _Base

        _logger = logging.getLogger("pipecat-poc")

        class _Lazy(_Base):
            def __init__(self, **kw):
                super().__init__(**kw)
                self._connection_started = False
                self._video_frame_count = 0
                self._audio_frame_count = 0

            async def process_frame(self, frame, direction):
                if isinstance(frame, StartFrame):
                    # Skip Simli init — just propagate StartFrame downstream
                    await FrameProcessor.process_frame(self, frame, direction)
                    await self.push_frame(frame, direction)
                    return

                if isinstance(frame, TTSAudioRawFrame) and not self._connection_started:
                    self._connection_started = True
                    _logger.info(
                        "Lazy init: first audio frame -> connecting to Simli now"
                    )
                    await self._start_connection()
                    _logger.info("Simli connection established, processing first audio frame")

                await super().process_frame(frame, direction)

            async def _consume_and_process_video(self):
                """Override to add diagnostic logging for video frames."""
                _logger.info("Video consume task: waiting for resampler event...")
                await self._pipecat_resampler_event.wait()
                has_video = hasattr(self._simli_client, 'video_track') and self._simli_client.video_track is not None
                _logger.info(
                    "Video consume task: resampler ready, requesting video stream "
                    f"(video_track={has_video})"
                )
                try:
                    video_iterator = self._simli_client.getVideoStreamIterator(
                        targetFormat="rgb24"
                    )
                    async for video_frame in video_iterator:
                        self._video_frame_count += 1
                        if self._video_frame_count == 1:
                            _logger.info(
                                f"First video frame! {video_frame.width}x{video_frame.height}"
                            )
                        elif self._video_frame_count % 100 == 0:
                            _logger.info(f"Video frames: {self._video_frame_count}")
                        converted = OutputImageRawFrame(
                            image=video_frame.to_rgb().to_image().tobytes(),
                            size=(video_frame.width, video_frame.height),
                            format="RGB",
                        )
                        converted.pts = video_frame.pts
                        await self.push_frame(converted)
                except Exception as e:
                    _logger.error(f"Video consume error: {e}", exc_info=True)
                _logger.info(
                    f"Video consume task ended ({self._video_frame_count} frames total)"
                )

            async def _consume_and_process_audio(self):
                """Override to add diagnostic logging for audio frames."""
                _logger.info("Audio consume task: waiting for resampler event...")
                await self._pipecat_resampler_event.wait()
                _logger.info("Audio consume task: resampler ready, starting audio consumption")
                try:
                    audio_iterator = self._simli_client.getAudioStreamIterator()
                    async for audio_frame in audio_iterator:
                        resampled_frames = self._pipecat_resampler.resample(audio_frame)
                        for resampled_frame in resampled_frames:
                            import numpy as np
                            audio_array = resampled_frame.to_ndarray()
                            if audio_array.any():
                                self._audio_frame_count += 1
                                if self._audio_frame_count == 1:
                                    _logger.info("First Simli audio frame received")
                                await self.push_frame(
                                    TTSAudioRawFrame(
                                        audio=audio_array.tobytes(),
                                        sample_rate=self._pipecat_resampler.rate,
                                        num_channels=1,
                                    ),
                                )
                except Exception as e:
                    _logger.error(f"Audio consume error: {e}", exc_info=True)
                _logger.info(
                    f"Audio consume task ended ({self._audio_frame_count} frames total)"
                )

        return _Lazy(**kwargs)


class LiveKitVideoPublisher(FrameProcessor):
    """Publishes OutputImageRawFrame to LiveKit as a video track.

    Pipecat's LiveKit transport (v0.0.102) does NOT implement write_video_frame,
    so video frames from Simli are silently dropped. This processor intercepts
    OutputImageRawFrame and publishes them directly via LiveKit's VideoSource API.

    Place AFTER SimliVideoService and BEFORE LiveKitOutputTransport in the pipeline.
    """

    def __init__(self, transport, **kwargs):
        super().__init__(**kwargs)
        self._transport = transport
        self._video_source = None
        self._video_track = None
        self._published = False
        self._frame_count = 0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        from pipecat.frames.frames import OutputImageRawFrame

        if isinstance(frame, OutputImageRawFrame):
            try:
                await self._publish_video_frame(frame)
            except Exception as e:
                if self._frame_count == 0:
                    logger.error(f"Video publish error: {e}", exc_info=True)
            # Don't push OutputImageRawFrame downstream (transport can't handle it)
            return

        await self.push_frame(frame, direction)

    async def _publish_video_frame(self, frame):
        """Publish a single video frame to LiveKit."""
        from livekit import rtc

        width, height = frame.size

        if not self._published:
            # Create video source and track on first frame
            self._video_source = rtc.VideoSource(width, height)
            self._video_track = rtc.LocalVideoTrack.create_video_track(
                "simli-video", self._video_source
            )
            room = self._transport._client.room
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_CAMERA
            await room.local_participant.publish_track(self._video_track, options)
            self._published = True
            logger.info(f"LiveKitVideoPublisher: published video track ({width}x{height})")

        # Convert RGB to RGBA (LiveKit requires RGBA) using numpy
        import numpy as np

        rgb_array = np.frombuffer(frame.image, dtype=np.uint8).reshape(height, width, 3)
        rgba_array = np.empty((height, width, 4), dtype=np.uint8)
        rgba_array[:, :, :3] = rgb_array
        rgba_array[:, :, 3] = 255

        lk_frame = rtc.VideoFrame(width, height, rtc.VideoBufferType.RGBA, rgba_array.tobytes())
        self._video_source.capture_frame(lk_frame)

        self._frame_count += 1
        if self._frame_count == 1:
            logger.info("LiveKitVideoPublisher: first frame captured")
        elif self._frame_count % 500 == 0:
            logger.info(f"LiveKitVideoPublisher: {self._frame_count} frames published")


class EmotionProcessor(FrameProcessor):
    """Feeds conversation text to the shared EmotionAnalyzer (GPT-4o-mini).

    Runs emotion analysis asynchronously (non-blocking) every 2 avatar turns
    and publishes results via LiveKit participant attributes.
    """

    def __init__(
        self,
        scenario: dict,
        transcript_proc: Optional["TranscriptProcessor"] = None,
        transport: Optional[object] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.scenario = scenario
        self.transcript_proc = transcript_proc
        self._transport = transport
        self._turn_count = 0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseEndFrame):
            self._turn_count += 1
            if self.transcript_proc and self._turn_count % 2 == 0:
                asyncio.create_task(self._analyze_emotion())

        await self.push_frame(frame, direction)

    async def _analyze_emotion(self) -> None:
        """Run emotion analysis in background via shared emotion_analyzer."""
        try:
            transcript = self.transcript_proc.get_transcript()
            if not transcript:
                return

            transcript_lines = [
                f"{e['speaker'].capitalize()}: {e['text']}"
                for e in transcript[-8:]
            ]
            avatar_entries = [e for e in transcript if e["speaker"] == "avatar"]
            if not avatar_entries:
                return

            from emotion_analyzer import analyze_emotion_with_intensity

            result = await analyze_emotion_with_intensity(
                avatar_entries[-1]["text"], transcript_lines
            )

            # Publish via participant attributes if transport available
            if self._transport:
                try:
                    room = self._transport._client.room
                    attrs = {
                        "emotion": result["state"],
                        "emotion_intensity": str(result["intensity"]),
                        "emotion_trend": result["trend"],
                    }
                    await room.local_participant.set_attributes(attrs)
                except Exception as e:
                    logger.warning(f"Failed to publish emotion attributes: {e}")

            logger.info(
                f"Emotion: {result['state']} "
                f"(intensity={result['intensity']}, trend={result['trend']})"
            )
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")


class HumeEmotionProcessor(FrameProcessor):
    """Real-time emotion detection via Hume Expression Measurement Streaming API.

    Analyzes user speech prosody (tone, rhythm, timbre) for 48 emotion dimensions.
    More accurate than text-based analysis (GPT-4o-mini) as it captures vocal cues.

    Place AFTER transport.input() and BEFORE STT in the pipeline so it can
    intercept InputAudioRawFrame without blocking the pipeline.
    """

    # Map Hume's 48 emotions to our 8-emotion set.
    # Unmapped emotions default to "neutral" via .get() fallback.
    HUME_TO_SIMPLE = {
        # enthusiastic
        "Excitement": "enthusiastic",
        "Ecstasy": "enthusiastic",
        "Desire": "enthusiastic",
        "Determination": "enthusiastic",
        "Triumph": "enthusiastic",
        # happy
        "Joy": "happy",
        "Amusement": "happy",
        "Love": "happy",
        "Pride": "happy",
        # receptive
        "Satisfaction": "receptive",
        "Admiration": "receptive",
        "Gratitude": "receptive",
        "Relief": "receptive",
        "Contentment": "receptive",
        # curious
        "Interest": "curious",
        "Surprise (positive)": "curious",
        "Realization": "curious",
        "Awe": "curious",
        # neutral
        "Contemplation": "neutral",
        "Calmness": "neutral",
        "Concentration": "neutral",
        "Boredom": "neutral",
        "Nostalgia": "neutral",
        # hesitant
        "Confusion": "hesitant",
        "Awkwardness": "hesitant",
        "Anxiety": "hesitant",
        "Fear": "hesitant",
        "Embarrassment": "hesitant",
        "Distress": "hesitant",
        "Sadness": "hesitant",
        "Tiredness": "hesitant",
        # skeptical
        "Doubt": "skeptical",
        "Contempt": "skeptical",
        "Surprise (negative)": "skeptical",
        "Sarcasm": "skeptical",
        # frustrated
        "Disappointment": "frustrated",
        "Anger": "frustrated",
        "Annoyance": "frustrated",
        "Disgust": "frustrated",
        "Frustration": "frustrated",
        "Pain": "frustrated",
        "Horror": "frustrated",
    }

    def __init__(
        self,
        api_key: str,
        transport: Optional[object] = None,
        analyze_every_ms: int = 4500,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self._api_key = api_key
        self._transport = transport
        self._audio_buffer = bytearray()
        self._buffer_duration_ms = 0.0
        self._analyze_every_ms = analyze_every_ms
        self._sample_rate = 16000
        self._analyzing = False
        self._first_frame_logged = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, InputAudioRawFrame):
            if not self._first_frame_logged:
                self._first_frame_logged = True
                logger.info("Hume: first audio frame received (prosody analysis active)")

            # Use the frame's actual sample rate if available
            if hasattr(frame, "sample_rate") and frame.sample_rate:
                self._sample_rate = frame.sample_rate

            self._audio_buffer.extend(frame.audio)
            # 16-bit PCM mono: 2 bytes per sample
            chunk_ms = (len(frame.audio) / (self._sample_rate * 2)) * 1000
            self._buffer_duration_ms += chunk_ms

            if self._buffer_duration_ms >= self._analyze_every_ms and not self._analyzing:
                # Set flag synchronously BEFORE scheduling task to prevent races
                self._analyzing = True
                # Cap audio to 5s max (Hume limit) — buffer may exceed threshold
                # while a previous analysis is in-flight
                max_bytes = self._sample_rate * 2 * 5  # 5s of 16-bit mono
                audio_data = bytes(self._audio_buffer[-max_bytes:])
                self._audio_buffer.clear()
                duration_ms = min(self._buffer_duration_ms, 5000.0)
                self._buffer_duration_ms = 0.0
                logger.info(f"Hume: analyzing {duration_ms:.0f}ms of audio ({len(audio_data)} bytes)")
                asyncio.create_task(self._analyze_prosody(audio_data))

        await self.push_frame(frame, direction)

    async def _analyze_prosody(self, audio_data: bytes) -> None:
        """Send audio buffer to Hume Streaming API for prosody analysis."""
        try:
            import io
            import wave
            import websockets

            # Wrap raw PCM in WAV container (Hume requires a valid media file)
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(self._sample_rate)
                wf.writeframes(audio_data)
            wav_bytes = wav_buffer.getvalue()

            b64_audio = base64.b64encode(wav_bytes).decode()

            async with websockets.connect(
                "wss://api.hume.ai/v0/stream/models",
                additional_headers={"X-Hume-Api-Key": self._api_key},
            ) as ws:
                await ws.send(json.dumps({
                    "data": b64_audio,
                    "models": {"prosody": {}},
                    "raw_text": False,
                }))

                response = json.loads(await ws.recv())

            # Check for API error response
            if "error" in response:
                logger.error(f"Hume API error: {response['error']} (code={response.get('code', 'unknown')})")
                return

            prosody = response.get("prosody", {})
            predictions = prosody.get("predictions", [])
            if not predictions:
                logger.debug("Hume: no prosody predictions returned")
                return

            emotions = predictions[0].get("emotions", [])
            top_emotions = sorted(emotions, key=lambda e: e["score"], reverse=True)[:3]

            if not top_emotions:
                return

            primary = self.HUME_TO_SIMPLE.get(top_emotions[0]["name"], "neutral")
            top3_json = json.dumps([
                {"name": e["name"], "score": round(e["score"], 3)}
                for e in top_emotions
            ])

            # Publish via participant attributes
            if self._transport:
                try:
                    room = self._transport._client.room
                    attrs = {
                        "emotion": primary,
                        "emotion_source": "hume_prosody",
                        "hume_top3": top3_json,
                    }
                    await room.local_participant.set_attributes(attrs)
                except Exception as e:
                    logger.warning(f"Failed to publish Hume emotion attributes: {e}")

            logger.info(
                f"Hume prosody: {top_emotions[0]['name']}={top_emotions[0]['score']:.3f} "
                f"→ {primary} | top3={top3_json}"
            )

        except Exception as e:
            logger.error(f"Hume analysis error ({type(e).__name__}): {e}")
        finally:
            self._analyzing = False


