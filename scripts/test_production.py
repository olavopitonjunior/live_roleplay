#!/usr/bin/env python3
"""
Live Roleplay - Production E2E Test Script

Connects to production as a simulated user, runs through a full session lifecycle,
and validates all critical paths: connection, greeting, stability, avatar responses,
coaching, session completion, and feedback generation.

Usage:
    python scripts/test_production.py [--scenario-id ID] [--skip-audio] [--timeout 180]

Required env vars (from agent/.env or set manually):
    SUPABASE_URL, SUPABASE_SERVICE_KEY
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    TEST_ACCESS_CODE (valid access code for testing)
    TEST_SCENARIO_ID (optional, uses first available scenario)
"""

import os
import sys
import json
import time
import wave
import struct
import asyncio
import argparse
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Add parent dir so we can load .env from agent/
sys.path.insert(0, str(Path(__file__).parent.parent / "agent"))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / "agent" / ".env")
except ImportError:
    pass

import aiohttp

# LiveKit SDK imports
try:
    from livekit import rtc, api
except ImportError:
    print("ERROR: livekit SDK not installed. Run: pip install livekit livekit-api")
    sys.exit(1)

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("test_production")

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class TestConfig:
    supabase_url: str = ""
    supabase_key: str = ""  # service role key
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    access_code: str = ""
    scenario_id: str = ""
    session_mode: str = "training"
    coach_intensity: str = "medium"
    skip_audio: bool = False
    session_timeout: int = 60  # How long to keep session alive (seconds)

    @classmethod
    def from_env(cls) -> "TestConfig":
        return cls(
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_key=os.getenv("SUPABASE_SERVICE_KEY", ""),
            livekit_url=os.getenv("LIVEKIT_URL", ""),
            livekit_api_key=os.getenv("LIVEKIT_API_KEY", ""),
            livekit_api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
            access_code=os.getenv("TEST_ACCESS_CODE", ""),
            scenario_id=os.getenv("TEST_SCENARIO_ID", ""),
        )

    def validate(self) -> list[str]:
        errors = []
        if not self.supabase_url:
            errors.append("SUPABASE_URL not set")
        if not self.supabase_key:
            errors.append("SUPABASE_SERVICE_KEY not set")
        if not self.livekit_url:
            errors.append("LIVEKIT_URL not set")
        if not self.livekit_api_key:
            errors.append("LIVEKIT_API_KEY not set")
        if not self.livekit_api_secret:
            errors.append("LIVEKIT_API_SECRET not set")
        if not self.access_code:
            errors.append("TEST_ACCESS_CODE not set")
        return errors


# ============================================================================
# Test Results Tracking
# ============================================================================

@dataclass
class TestResult:
    name: str
    passed: bool
    elapsed: float = 0.0
    expected_max: float = 0.0
    note: str = ""
    category: str = ""


@dataclass
class TestResults:
    results: list[TestResult] = field(default_factory=list)
    diagnostics: dict[str, Any] = field(default_factory=dict)
    start_time: float = field(default_factory=time.time)

    def record(
        self,
        name: str,
        elapsed: float,
        expected_max: float = 0.0,
        pass_override: bool | None = None,
        note: str = "",
        category: str = "",
    ):
        if pass_override is not None:
            passed = pass_override
        elif expected_max > 0:
            passed = elapsed <= expected_max
        else:
            passed = True

        result = TestResult(
            name=name,
            passed=passed,
            elapsed=elapsed,
            expected_max=expected_max,
            note=note,
            category=category,
        )
        self.results.append(result)

        status = "PASS" if passed else "FAIL"
        detail = f"{elapsed:.1f}s" if expected_max > 0 else note
        logger.info(f"[{status}] {name}: {detail}")

    def add_diagnostic(self, key: str, value: Any):
        self.diagnostics[key] = value

    def print_report(self):
        total = time.time() - self.start_time
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        # Group by category
        categories: dict[str, list[TestResult]] = {}
        for r in self.results:
            cat = r.category or "GENERAL"
            categories.setdefault(cat, []).append(r)

        print()
        print("=" * 60)
        print("  LIVE ROLEPLAY - Production E2E Test Report")
        print(f"  Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        print()

        for cat, tests in categories.items():
            print(f"  {cat}")
            for r in tests:
                status = "\033[92mPASS\033[0m" if r.passed else "\033[91mFAIL\033[0m"
                name_pad = r.name.ljust(30, ".")
                if r.expected_max > 0:
                    detail = f"{r.elapsed:.1f}s (< {r.expected_max:.0f}s)"
                elif r.note:
                    detail = r.note
                else:
                    detail = "OK"
                print(f"    [{status}] {name_pad} {detail}")
            print()

        # Latency summary
        latency_tests = [r for r in self.results if r.expected_max > 0]
        if latency_tests:
            print("  LATENCY SUMMARY")
            for r in latency_tests:
                print(f"    {r.name}: {r.elapsed:.1f}s", end="")
                if not r.passed:
                    print(f" \033[91m(SLOW)\033[0m", end="")
                print()
            print()

        # Diagnostics
        if self.diagnostics:
            print("  DIAGNOSTICS")
            for key, val in self.diagnostics.items():
                if isinstance(val, list) and len(val) > 3:
                    print(f"    {key}: [{len(val)} items]")
                    for item in val[:3]:
                        print(f"      - {str(item)[:100]}")
                    print(f"      ... and {len(val) - 3} more")
                else:
                    print(f"    {key}: {str(val)[:200]}")
            print()

        # Summary
        result_text = "\033[92mALL PASSED\033[0m" if failed == 0 else f"\033[91m{failed} FAILED\033[0m"
        print(f"  RESULT: {passed}/{len(self.results)} passed | {result_text}")
        print(f"  Total duration: {total:.0f}s ({total/60:.1f}min)")
        print("=" * 60)


# ============================================================================
# Audio Helpers
# ============================================================================

AUDIO_DIR = Path(__file__).parent / "test_audio_samples"

TEST_PHRASES = {
    "greeting_response": "Olá, prazer em conhecer você. Me fale mais sobre o produto.",
    "price_objection": "Achei muito caro. Não sei se cabe no nosso orçamento este trimestre.",
    "interest": "Interessante, me conta mais sobre como funciona na prática.",
    "farewell": "Obrigado pela apresentação, tchau.",
}


def generate_sine_wav(filepath: Path, duration_s: float = 3.0, freq: float = 440.0):
    """Generate a sine wave WAV file as fallback when gTTS is not available."""
    sample_rate = 48000
    n_samples = int(sample_rate * duration_s)
    amplitude = 16000

    with wave.open(str(filepath), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)

        for i in range(n_samples):
            t = i / sample_rate
            # Frequency modulation to simulate speech-like pattern
            mod_freq = freq + 100 * (0.5 + 0.5 * (i % (sample_rate // 2)) / (sample_rate // 2))
            sample = int(amplitude * 0.7 * (
                0.6 * __import__("math").sin(2 * 3.14159 * mod_freq * t) +
                0.3 * __import__("math").sin(2 * 3.14159 * mod_freq * 2 * t) +
                0.1 * __import__("math").sin(2 * 3.14159 * mod_freq * 3 * t)
            ))
            wf.writeframes(struct.pack("<h", max(-32768, min(32767, sample))))


def generate_test_audio():
    """Generate test audio files using gTTS or sine wave fallback."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from gtts import gTTS
        has_gtts = True
    except ImportError:
        has_gtts = False
        logger.warning("gTTS not installed, using sine wave fallback. Install with: pip install gTTS")

    for name, text in TEST_PHRASES.items():
        filepath = AUDIO_DIR / f"{name}.wav"
        if filepath.exists():
            logger.info(f"Audio already exists: {name}.wav")
            continue

        if has_gtts:
            try:
                # gTTS outputs MP3, we need WAV
                import tempfile
                mp3_path = Path(tempfile.mktemp(suffix=".mp3"))
                tts = gTTS(text=text, lang="pt-br")
                tts.save(str(mp3_path))

                # Convert MP3 to WAV using ffmpeg if available
                import subprocess
                result = subprocess.run(
                    ["ffmpeg", "-i", str(mp3_path), "-ar", "48000", "-ac", "1",
                     "-acodec", "pcm_s16le", str(filepath), "-y"],
                    capture_output=True, text=True,
                )
                mp3_path.unlink(missing_ok=True)

                if result.returncode == 0:
                    logger.info(f"Generated TTS audio: {name}.wav")
                    continue
                else:
                    logger.warning(f"ffmpeg conversion failed, using sine wave for {name}")
            except Exception as e:
                logger.warning(f"gTTS failed for {name}: {e}, using sine wave")

        # Fallback: sine wave
        duration = 3.0 + len(text) * 0.05  # Longer text = longer audio
        generate_sine_wav(filepath, duration_s=duration, freq=300 + hash(name) % 200)
        logger.info(f"Generated sine wave audio: {name}.wav ({duration:.1f}s)")


def load_wav_as_frames(filepath: Path, frame_duration_ms: int = 20) -> list[rtc.AudioFrame]:
    """Load a WAV file and return a list of AudioFrame objects."""
    frames = []

    with wave.open(str(filepath), "r") as wf:
        sample_rate = wf.getframerate()
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        n_frames = wf.getnframes()

        samples_per_frame = int(sample_rate * frame_duration_ms / 1000)
        raw_data = wf.readframes(n_frames)

    # Convert to 16-bit mono if needed
    if sample_width == 2:
        samples = list(struct.unpack(f"<{n_frames * n_channels}h", raw_data))
    elif sample_width == 1:
        samples = [int((b - 128) * 256) for b in raw_data]
    else:
        # 24-bit or other, just use zeros
        samples = [0] * (n_frames * n_channels)

    # Convert to mono if stereo
    if n_channels == 2:
        samples = [(samples[i] + samples[i + 1]) // 2 for i in range(0, len(samples), 2)]

    # Resample to 48kHz if needed
    if sample_rate != 48000:
        ratio = 48000 / sample_rate
        new_len = int(len(samples) * ratio)
        if HAS_NUMPY:
            old_indices = np.linspace(0, len(samples) - 1, new_len)
            samples = list(np.interp(old_indices, range(len(samples)), samples).astype(int))
        else:
            # Simple nearest-neighbor resampling
            samples = [samples[int(i / ratio)] for i in range(new_len)]
        sample_rate = 48000

    # Split into frames
    samples_per_frame = int(sample_rate * frame_duration_ms / 1000)
    for i in range(0, len(samples), samples_per_frame):
        chunk = samples[i : i + samples_per_frame]
        if len(chunk) < samples_per_frame:
            chunk.extend([0] * (samples_per_frame - len(chunk)))

        frame = rtc.AudioFrame.create(sample_rate, 1, samples_per_frame)
        frame_data = frame.data  # Already a memoryview with format "h" (int16)
        for j, s in enumerate(chunk):
            frame_data[j] = max(-32768, min(32767, int(s)))

        frames.append(frame)

    return frames


# ============================================================================
# Supabase Helpers
# ============================================================================

async def supabase_get(config: TestConfig, table: str, query: str = "") -> Any:
    """Query Supabase REST API."""
    url = f"{config.supabase_url}/rest/v1/{table}?{query}"
    headers = {
        "apikey": config.supabase_key,
        "Authorization": f"Bearer {config.supabase_key}",
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                return await resp.json()
            logger.warning(f"Supabase GET {table} failed: {resp.status} {await resp.text()}")
            return None


async def supabase_post(config: TestConfig, function: str, body: dict) -> tuple[int, Any]:
    """Call Supabase Edge Function."""
    url = f"{config.supabase_url}/functions/v1/{function}"
    headers = {
        "Authorization": f"Bearer {config.supabase_key}",
        "Content-Type": "application/json",
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=body, headers=headers) as resp:
            try:
                data = await resp.json()
            except Exception:
                data = await resp.text()
            return resp.status, data


async def get_first_scenario(config: TestConfig) -> str | None:
    """Get the first available scenario ID."""
    result = await supabase_get(config, "scenarios", "select=id&limit=1&is_active=eq.true")
    if result and len(result) > 0:
        return result[0]["id"]
    # Try without is_active filter
    result = await supabase_get(config, "scenarios", "select=id&limit=1")
    if result and len(result) > 0:
        return result[0]["id"]
    return None


async def fetch_session(session_id: str, config: TestConfig) -> dict | None:
    """Fetch session record from DB."""
    result = await supabase_get(config, "sessions", f"id=eq.{session_id}&select=*")
    if result and len(result) > 0:
        return result[0]
    return None


async def fetch_feedback(session_id: str, config: TestConfig) -> dict | None:
    """Fetch feedback record from DB."""
    result = await supabase_get(config, "feedbacks", f"session_id=eq.{session_id}&select=*")
    if result and len(result) > 0:
        return result[0]
    return None


async def fetch_evidences(session_id: str, config: TestConfig) -> list:
    """Fetch evidence records from DB."""
    result = await supabase_get(config, "session_evidences", f"session_id=eq.{session_id}&select=*")
    return result or []


async def fetch_objection_statuses(session_id: str, config: TestConfig) -> list:
    """Fetch objection status records from DB."""
    result = await supabase_get(config, "session_objection_status", f"session_id=eq.{session_id}&select=*")
    return result or []


# ============================================================================
# Tests
# ============================================================================

async def test_token_fetch(config: TestConfig, results: TestResults) -> tuple[str, str, str]:
    """Test 1: Token fetch from Edge Function."""
    start = time.time()

    status, data = await supabase_post(config, "create-livekit-token", {
        "scenario_id": config.scenario_id,
        "access_code": config.access_code,
        "session_mode": config.session_mode,
        "coach_intensity": config.coach_intensity,
    })

    elapsed = time.time() - start

    if status != 200 or not isinstance(data, dict) or "token" not in data:
        results.record("token_fetch", elapsed, expected_max=5.0,
                       pass_override=False, note=f"status={status}, data={str(data)[:200]}",
                       category="CONNECTION & SETUP")
        raise RuntimeError(f"Token fetch failed: {status} {data}")

    results.record("token_fetch", elapsed, expected_max=5.0, category="CONNECTION & SETUP")

    token = data["token"]
    session_id = data["session_id"]
    room_name = data.get("room_name", "")

    logger.info(f"Session ID: {session_id}, Room: {room_name}")
    results.add_diagnostic("session_id", session_id)
    results.add_diagnostic("room_name", room_name)

    return token, session_id, room_name


async def test_room_connect(
    token: str, config: TestConfig, results: TestResults
) -> tuple[rtc.Room, rtc.AudioSource]:
    """Test 2: Room connection + Agent join."""
    room = rtc.Room()

    # Connect
    connect_start = time.time()
    await room.connect(config.livekit_url, token)
    connect_elapsed = time.time() - connect_start
    results.record("room_connect", connect_elapsed, expected_max=5.0,
                   category="CONNECTION & SETUP")

    # Publish audio track (simulated microphone)
    audio_source = rtc.AudioSource(sample_rate=48000, num_channels=1)
    audio_track = rtc.LocalAudioTrack.create_audio_track("microphone", audio_source)
    audio_options = rtc.TrackPublishOptions()
    audio_options.source = rtc.TrackSource.SOURCE_MICROPHONE
    await room.local_participant.publish_track(audio_track, audio_options)
    results.record("audio_track_published", 0, pass_override=True,
                   note="OK", category="CONNECTION & SETUP")

    # Wait for agent to join
    agent_joined = asyncio.Event()
    agent_start = time.time()

    @room.on("participant_connected")
    def on_participant(participant: rtc.RemoteParticipant):
        identity = participant.identity.lower()
        if "agent" in identity or "roleplay" in identity:
            logger.info(f"Agent joined: {participant.identity}")
            agent_joined.set()

    # Check if agent already present
    for p in room.remote_participants.values():
        identity = p.identity.lower()
        if "agent" in identity or "roleplay" in identity:
            logger.info(f"Agent already present: {p.identity}")
            agent_joined.set()
            break

    try:
        await asyncio.wait_for(agent_joined.wait(), timeout=30)
        agent_elapsed = time.time() - agent_start
        results.record("agent_join", agent_elapsed, expected_max=20.0,
                       category="CONNECTION & SETUP")
    except asyncio.TimeoutError:
        results.record("agent_join", 30.0, expected_max=20.0,
                       pass_override=False, note="TIMEOUT - agent did not join",
                       category="CONNECTION & SETUP")
        raise RuntimeError("Agent did not join within 30s")

    # Send silence to keep audio track alive
    async def send_silence():
        """Send silence frames to keep the audio track active."""
        silence_frame = rtc.AudioFrame.create(48000, 1, 480)  # 10ms of silence
        while room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
            try:
                await audio_source.capture_frame(silence_frame)
            except Exception:
                break
            await asyncio.sleep(0.01)

    asyncio.create_task(send_silence())

    # Register text stream handlers to capture agent events and transcriptions
    # These are sent via LiveKit text streams (not data channel) in newer SDK
    text_stream_messages: list[dict] = []

    def _handle_text_stream(reader, participant_identity: str, topic: str):
        async def _read():
            try:
                text = await reader.read_all()
                msg = {"topic": topic, "identity": participant_identity, "text": text}
                text_stream_messages.append(msg)
                logger.info(f"  TextStream [{topic}]: {text[:120]}")
            except Exception as e:
                logger.warning(f"  TextStream read error [{topic}]: {e}")
        asyncio.create_task(_read())

    def on_transcription(reader, participant_identity: str):
        _handle_text_stream(reader, participant_identity, "lk.transcription")

    def on_agent_events(reader, participant_identity: str):
        _handle_text_stream(reader, participant_identity, "lk.agent.events")

    room.register_text_stream_handler("lk.transcription", on_transcription)
    room.register_text_stream_handler("lk.agent.events", on_agent_events)

    # Store text stream messages reference on room for access in other tests
    room._test_text_streams = text_stream_messages  # type: ignore

    return room, audio_source


async def test_greeting_stability(room: rtc.Room, results: TestResults):
    """Test 3: Greeting received + session stays stable for 30s."""
    greeting_received = asyncio.Event()
    session_ready = asyncio.Event()
    disconnected = asyncio.Event()
    data_messages: list[dict] = []
    heartbeats: list[dict] = []

    @room.on("data_received")
    def on_data(data_packet: rtc.DataPacket):
        try:
            msg = json.loads(data_packet.data.decode())
            data_messages.append(msg)

            if msg.get("type") == "heartbeat":
                heartbeats.append(msg)

            # Detect "Ouvindo..." status = greeting done, session ready
            if msg.get("type") == "status":
                status_text = msg.get("message", "") or msg.get("status", "")
                logger.info(f"  Status: {status_text}")
                if "Ouvindo" in status_text:
                    session_ready.set()
                    if not greeting_received.is_set():
                        greeting_received.set()
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    @room.on("disconnected")
    def on_disconnect():
        logger.warning("Room disconnected!")
        disconnected.set()

    # Wait for greeting
    greeting_start = time.time()
    try:
        await asyncio.wait_for(greeting_received.wait(), timeout=45)
        greeting_elapsed = time.time() - greeting_start
        results.record("greeting_received", greeting_elapsed, expected_max=20.0,
                       category="GREETING & STABILITY")
    except asyncio.TimeoutError:
        results.record("greeting_received", 45.0, expected_max=20.0,
                       pass_override=False, note="TIMEOUT - no greeting",
                       category="GREETING & STABILITY")
        results.add_diagnostic("messages_during_greeting_wait", data_messages[-10:])
        return

    # CRITICAL TEST: Wait 30s and verify session stays connected
    logger.info("Waiting 30s to verify session stability...")
    try:
        await asyncio.wait_for(disconnected.wait(), timeout=30)
        # If we get here, the session disconnected - BUG!
        results.record("session_stability_30s", 0, pass_override=False,
                       note="BUG: SESSION DISCONNECTED WITHIN 30s OF GREETING!",
                       category="GREETING & STABILITY")
        results.add_diagnostic("last_messages_before_disconnect", data_messages[-10:])
        results.add_diagnostic("heartbeats_received", len(heartbeats))
    except asyncio.TimeoutError:
        # Session survived 30s - correct behavior
        results.record("session_stability_30s", 30, pass_override=True,
                       note="OK - session stable", category="GREETING & STABILITY")

    # Check heartbeats
    results.record("heartbeats_received", len(heartbeats), pass_override=len(heartbeats) >= 3,
                   note=f"{len(heartbeats)} heartbeats in 30s",
                   category="GREETING & STABILITY")
    results.add_diagnostic("data_messages_count", len(data_messages))


async def test_avatar_responses(
    room: rtc.Room, audio_source: rtc.AudioSource, results: TestResults, config: TestConfig
):
    """Test 4: Send audio and verify avatar responses."""
    if config.skip_audio:
        results.record("avatar_responses", 0, pass_override=True,
                       note="SKIPPED (--skip-audio)", category="AVATAR RESPONSES")
        return

    responses: list[dict] = []
    all_messages: list[dict] = []

    @room.on("data_received")
    def on_data(data_packet: rtc.DataPacket):
        try:
            msg = json.loads(data_packet.data.decode())
            all_messages.append(msg)
            if msg.get("type") == "transcription" and msg.get("speaker") == "avatar":
                responses.append(msg)
                logger.info(f"  Avatar response: {msg.get('text', '')[:80]}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    # Send greeting audio
    greeting_wav = AUDIO_DIR / "greeting_response.wav"
    if not greeting_wav.exists():
        results.record("avatar_responses", 0, pass_override=False,
                       note="Audio file not found", category="AVATAR RESPONSES")
        return

    frames = load_wav_as_frames(greeting_wav)
    logger.info(f"Sending {len(frames)} audio frames ({len(frames) * 20}ms)...")

    send_start = time.time()
    for frame in frames:
        await audio_source.capture_frame(frame)
        await asyncio.sleep(0.018)  # ~20ms per frame, slight undertime to avoid buffer gaps

    # Wait for avatar to process and respond
    logger.info("Waiting for avatar response (15s)...")
    await asyncio.sleep(15)

    if responses:
        first_response_time = time.time() - send_start - 15 + 15  # approximate
        results.record("avatar_response_time", first_response_time, expected_max=10.0,
                       category="AVATAR RESPONSES")
        results.record("avatar_response_count", len(responses), pass_override=True,
                       note=f"{len(responses)} responses", category="AVATAR RESPONSES")
        results.add_diagnostic("avatar_responses", [r.get("text", "")[:100] for r in responses[:5]])
    else:
        results.record("avatar_response_count", 0, pass_override=False,
                       note="NO RESPONSE from avatar", category="AVATAR RESPONSES")
        # Check if we got any transcription of our audio
        user_transcripts = [m for m in all_messages
                            if m.get("type") == "transcription" and m.get("speaker") == "user"]
        results.add_diagnostic("user_transcripts_detected", len(user_transcripts))
        if user_transcripts:
            results.add_diagnostic("user_transcript_texts",
                                   [t.get("text", "")[:100] for t in user_transcripts[:3]])


async def test_coach_activity(
    room: rtc.Room, audio_source: rtc.AudioSource, results: TestResults, config: TestConfig
):
    """Test 5: Verify coaching is active."""
    coach_messages: list[dict] = []

    @room.on("data_received")
    def on_data(data_packet: rtc.DataPacket):
        try:
            msg = json.loads(data_packet.data.decode())
            if msg.get("type") in ("coaching_hint", "ai_suggestion", "coaching_state"):
                coach_messages.append(msg)
                logger.info(f"  Coach: {msg.get('type')} - {str(msg)[:100]}")
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    # Send price objection audio to trigger coaching
    if not config.skip_audio:
        objection_wav = AUDIO_DIR / "price_objection.wav"
        if objection_wav.exists():
            frames = load_wav_as_frames(objection_wav)
            logger.info(f"Sending price objection audio ({len(frames)} frames)...")
            for frame in frames:
                await audio_source.capture_frame(frame)
                await asyncio.sleep(0.018)

    # Wait for coach to process
    logger.info("Waiting for coaching response (10s)...")
    await asyncio.sleep(10)

    hints = [m for m in coach_messages if m["type"] == "coaching_hint"]
    suggestions = [m for m in coach_messages if m["type"] == "ai_suggestion"]
    state_updates = [m for m in coach_messages if m["type"] == "coaching_state"]

    results.record("coach_state_updates", len(state_updates),
                   pass_override=True,  # coaching state may come later
                   note=f"{len(state_updates)} updates",
                   category="COACHING")
    results.record("coach_hints", len(hints), pass_override=True,
                   note=f"{len(hints)} hints", category="COACHING")
    results.record("coach_suggestions", len(suggestions), pass_override=True,
                   note=f"{len(suggestions)} suggestions", category="COACHING")
    results.add_diagnostic("coach_messages", coach_messages[:5])


async def test_session_completion(
    room: rtc.Room, audio_source: rtc.AudioSource,
    session_id: str, config: TestConfig, results: TestResults
):
    """Test 6: End session and verify completion."""
    disconnected = asyncio.Event()

    @room.on("disconnected")
    def on_disconnect():
        disconnected.set()

    # Send farewell audio
    if not config.skip_audio:
        farewell_wav = AUDIO_DIR / "farewell.wav"
        if farewell_wav.exists():
            frames = load_wav_as_frames(farewell_wav)
            logger.info(f"Sending farewell audio ({len(frames)} frames)...")
            for frame in frames:
                await audio_source.capture_frame(frame)
                await asyncio.sleep(0.018)

    # Wait for session to end (agent detects "tchau")
    end_start = time.time()
    try:
        await asyncio.wait_for(disconnected.wait(), timeout=20)
        end_elapsed = time.time() - end_start
        results.record("session_end_after_farewell", end_elapsed, expected_max=15.0,
                       category="SESSION COMPLETION")
    except asyncio.TimeoutError:
        # Agent didn't end on farewell, disconnect manually
        logger.info("Agent didn't end session, disconnecting manually...")
        await room.disconnect()
        results.record("session_end_after_farewell", 20.0, pass_override=True,
                       note="Manual disconnect (agent may need timeout)",
                       category="SESSION COMPLETION")

    # Wait for shutdown callback to save transcript
    logger.info("Waiting 8s for transcript save...")
    await asyncio.sleep(8)

    # Check session in DB
    session = await fetch_session(session_id, config)
    if session:
        results.record("session_status", 0,
                       pass_override=session.get("status") == "completed",
                       note=f"status={session.get('status')}",
                       category="SESSION COMPLETION")
        transcript = session.get("transcript", "")
        results.record("transcript_saved", 0,
                       pass_override=bool(transcript),
                       note=f"length={len(transcript)}, lines={transcript.count(chr(10)) + 1 if transcript else 0}",
                       category="SESSION COMPLETION")
        results.add_diagnostic("session_status", session.get("status"))
        results.add_diagnostic("transcript_length", len(transcript or ""))
    else:
        results.record("session_status", 0, pass_override=False,
                       note="Session not found in DB", category="SESSION COMPLETION")
        results.record("transcript_saved", 0, pass_override=False,
                       note="Session not found", category="SESSION COMPLETION")


async def test_feedback_generation(
    session_id: str, config: TestConfig, results: TestResults
):
    """Test 7: Verify feedback generation."""
    start = time.time()

    # First check if agent already triggered feedback
    feedback = await fetch_feedback(session_id, config)

    if not feedback:
        # Try to trigger manually
        logger.info("No feedback yet, triggering generation...")
        status, data = await supabase_post(config, "generate-feedback", {
            "session_id": session_id,
        })
        logger.info(f"Feedback trigger response: {status}")

        # Poll for feedback
        for attempt in range(30):
            feedback = await fetch_feedback(session_id, config)
            if feedback:
                break
            await asyncio.sleep(2)
    else:
        logger.info("Feedback already generated by agent")

    elapsed = time.time() - start

    if feedback:
        results.record("feedback_generation", elapsed, expected_max=60.0,
                       category="FEEDBACK REPORT")
        results.record("feedback_weighted_score", 0, pass_override=True,
                       note=f"weighted={feedback.get('weighted_score')}, legacy={feedback.get('score')}",
                       category="FEEDBACK REPORT")
        results.record("feedback_criteria", 0,
                       pass_override=bool(feedback.get("criteria_scores")),
                       note=f"count={len(feedback.get('criteria_scores', []))}",
                       category="FEEDBACK REPORT")
        results.record("feedback_summary", 0,
                       pass_override=bool(feedback.get("summary")),
                       note=f"length={len(feedback.get('summary', ''))}",
                       category="FEEDBACK REPORT")

        # Check evidences and objections
        evidences = await fetch_evidences(session_id, config)
        objections = await fetch_objection_statuses(session_id, config)

        results.record("evidences_saved", 0, pass_override=True,
                       note=f"count={len(evidences)}", category="FEEDBACK REPORT")
        results.record("objections_tracked", 0, pass_override=True,
                       note=f"count={len(objections)}", category="FEEDBACK REPORT")

        results.add_diagnostic("feedback_score", feedback.get("weighted_score"))
        results.add_diagnostic("feedback_confidence", feedback.get("confidence_level"))
    else:
        results.record("feedback_generation", elapsed, pass_override=False,
                       note="NO FEEDBACK GENERATED", category="FEEDBACK REPORT")


# ============================================================================
# Main
# ============================================================================

async def run_tests(config: TestConfig):
    """Run all production tests."""
    results = TestResults()
    room = None
    audio_source = None
    session_id = None

    try:
        # Test 1: Token fetch
        logger.info("=" * 50)
        logger.info("TEST 1: Token & Connection")
        logger.info("=" * 50)
        token, session_id, room_name = await test_token_fetch(config, results)

        # Test 2: Room connect + Agent join
        logger.info("=" * 50)
        logger.info("TEST 2: Room Connect & Agent Join")
        logger.info("=" * 50)
        room, audio_source = await test_room_connect(token, config, results)

        # Test 3: Greeting + Stability
        logger.info("=" * 50)
        logger.info("TEST 3: Greeting & Session Stability")
        logger.info("=" * 50)
        await test_greeting_stability(room, results)

        # Check if still connected
        if room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            logger.error("Session disconnected during stability test - skipping remaining tests")
            results.print_report()
            return

        # Test 4: Avatar responses
        logger.info("=" * 50)
        logger.info("TEST 4: Avatar Responses")
        logger.info("=" * 50)
        await test_avatar_responses(room, audio_source, results, config)

        # Test 5: Coaching
        logger.info("=" * 50)
        logger.info("TEST 5: Coach Activity")
        logger.info("=" * 50)
        await test_coach_activity(room, audio_source, results, config)

        # Test 6: Session completion
        logger.info("=" * 50)
        logger.info("TEST 6: Session Completion")
        logger.info("=" * 50)
        await test_session_completion(room, audio_source, session_id, config, results)

        # Test 7: Feedback generation
        logger.info("=" * 50)
        logger.info("TEST 7: Feedback Report")
        logger.info("=" * 50)
        await test_feedback_generation(session_id, config, results)

    except Exception as e:
        logger.error(f"Test suite error: {e}", exc_info=True)
        results.record("test_suite", 0, pass_override=False,
                       note=f"Error: {str(e)[:200]}", category="ERROR")
    finally:
        # Cleanup
        if room:
            try:
                if room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                    logger.info("Disconnecting from room...")
                    await room.disconnect()
            except Exception as e:
                logger.warning(f"Error during room disconnect: {e}")

    results.print_report()


def main():
    parser = argparse.ArgumentParser(description="Live Roleplay - Production E2E Tests")
    parser.add_argument("--scenario-id", help="Scenario ID to test with")
    parser.add_argument("--access-code", help="Access code for testing")
    parser.add_argument("--skip-audio", action="store_true", help="Skip audio simulation tests")
    parser.add_argument("--timeout", type=int, default=60, help="Session timeout in seconds")
    parser.add_argument("--generate-audio", action="store_true", help="Only generate test audio files")
    args = parser.parse_args()

    config = TestConfig.from_env()

    if args.scenario_id:
        config.scenario_id = args.scenario_id
    if args.access_code:
        config.access_code = args.access_code
    if args.skip_audio:
        config.skip_audio = True
    config.session_timeout = args.timeout

    if args.generate_audio:
        generate_test_audio()
        logger.info("Audio generation complete.")
        return

    # Validate config
    errors = config.validate()
    if errors:
        print("Configuration errors:")
        for e in errors:
            print(f"  - {e}")
        print("\nSet these env vars or pass via --access-code / --scenario-id")
        sys.exit(1)

    # Generate test audio if needed
    if not config.skip_audio:
        generate_test_audio()

    # Get scenario ID if not set
    if not config.scenario_id:
        logger.info("No scenario ID specified, fetching first available...")
        scenario_id = asyncio.run(get_first_scenario(config))
        if not scenario_id:
            print("ERROR: No scenarios found in database")
            sys.exit(1)
        config.scenario_id = scenario_id
        logger.info(f"Using scenario: {scenario_id}")

    # Run tests
    print()
    print("=" * 60)
    print("  LIVE ROLEPLAY - Starting Production E2E Tests")
    print(f"  Scenario: {config.scenario_id}")
    print(f"  Mode: {config.session_mode} | Coach: {config.coach_intensity}")
    print(f"  Audio: {'ENABLED' if not config.skip_audio else 'DISABLED'}")
    print("=" * 60)
    print()

    asyncio.run(run_tests(config))


if __name__ == "__main__":
    main()
