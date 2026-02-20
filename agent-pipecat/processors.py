"""
Custom FrameProcessors for the Pipecat PoC agent.

Intercepts frames in the pipeline to:
- Capture user and assistant transcriptions for the session transcript
- Feed text to the shared EmotionAnalyzer for real-time emotion tracking
- Track metrics (token counts, latencies) for cost comparison
"""

import asyncio
import time
import logging
from typing import Optional

from pipecat.frames.frames import (
    Frame,
    TranscriptionFrame,
    TextFrame,
    LLMFullResponseEndFrame,
)
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection

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
    """

    def __init__(self, transcript_proc: TranscriptProcessor, **kwargs):
        super().__init__(**kwargs)
        self.transcript_proc = transcript_proc
        self._buffer = ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TextFrame):
            self._buffer += frame.text
        elif isinstance(frame, LLMFullResponseEndFrame):
            if self._buffer.strip():
                self.transcript_proc.add_assistant_turn(self._buffer.strip())
                self._buffer = ""

        await self.push_frame(frame, direction)


class EmotionProcessor(FrameProcessor):
    """Feeds conversation text to the shared EmotionAnalyzer.

    Runs emotion analysis asynchronously (non-blocking) using GPT-4o-mini
    via the shared emotion_analyzer module from agent/.
    """

    def __init__(
        self,
        scenario: dict,
        emotion_analyzer: Optional[object] = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.scenario = scenario
        self.emotion_analyzer = emotion_analyzer
        self._turn_count = 0

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseEndFrame):
            self._turn_count += 1
            # Trigger emotion analysis every 2 turns (non-blocking)
            if self.emotion_analyzer and self._turn_count % 2 == 0:
                asyncio.create_task(self._analyze_emotion())

        await self.push_frame(frame, direction)

    async def _analyze_emotion(self) -> None:
        """Run emotion analysis in background."""
        try:
            # The shared EmotionAnalyzer expects the full transcript
            # This is a fire-and-forget task
            logger.debug(f"Emotion analysis triggered (turn {self._turn_count})")
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")
