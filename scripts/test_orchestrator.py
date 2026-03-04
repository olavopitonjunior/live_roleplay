#!/usr/bin/env python3
"""
Live Roleplay - Coach Orchestrator Accuracy Test Script

Uses agent-to-agent simulation to test the orchestrator's scoring,
output determination, and coaching effectiveness.

A GPT-4o-mini "user simulator" plays the role of a vendor with configurable
behavior (obedient, rebellious, mixed, passive), and the production agent
acts as the roleplay avatar + orchestrator.

Usage:
    python scripts/test_orchestrator.py --all
    python scripts/test_orchestrator.py --persona vendedor_obediente
    python scripts/test_orchestrator.py --persona vendedor_rebelde --duration 300
    python scripts/test_orchestrator.py --all --report

Required env vars (from agent/.env):
    SUPABASE_URL, SUPABASE_SERVICE_KEY
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    OPENAI_API_KEY
    TEST_ACCESS_CODE, TEST_SCENARIO_ID (optional)
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
from typing import Any, Literal

sys.path.insert(0, str(Path(__file__).parent.parent / "agent"))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / "agent" / ".env")
except ImportError:
    pass

import aiohttp

try:
    from livekit import rtc
except ImportError:
    print("ERROR: livekit SDK not installed. Run: pip install livekit livekit-api")
    sys.exit(1)

try:
    from openai import AsyncOpenAI
except ImportError:
    print("ERROR: openai SDK not installed. Run: pip install openai")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("test_orchestrator")


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class TestConfig:
    supabase_url: str = ""
    supabase_key: str = ""
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    access_code: str = ""
    scenario_id: str = ""
    openai_api_key: str = ""

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
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        )

    def validate(self) -> list[str]:
        errors = []
        for field_name, env_name in [
            ("supabase_url", "SUPABASE_URL"),
            ("supabase_key", "SUPABASE_SERVICE_KEY"),
            ("livekit_url", "LIVEKIT_URL"),
            ("livekit_api_key", "LIVEKIT_API_KEY"),
            ("livekit_api_secret", "LIVEKIT_API_SECRET"),
            ("access_code", "TEST_ACCESS_CODE"),
            ("openai_api_key", "OPENAI_API_KEY"),
        ]:
            if not getattr(self, field_name):
                errors.append(f"{env_name} not set")
        return errors


# ============================================================================
# Persona Definitions
# ============================================================================

@dataclass
class SimulatorPersona:
    name: str
    behavior: Literal["obedient", "rebellious", "mixed", "passive"]
    expected_output: Literal["positive", "negative", "neutral"]
    expected_score_range: tuple[float, float]
    duration_seconds: int
    difficulty_level: int

PERSONAS: dict[str, SimulatorPersona] = {
    "vendedor_obediente": SimulatorPersona(
        name="Vendedor Obediente",
        behavior="obedient",
        expected_output="positive",
        expected_score_range=(65, 100),
        duration_seconds=180,
        difficulty_level=3,
    ),
    "vendedor_rebelde": SimulatorPersona(
        name="Vendedor Rebelde",
        behavior="rebellious",
        expected_output="negative",
        expected_score_range=(0, 40),
        duration_seconds=180,
        difficulty_level=5,
    ),
    "vendedor_misto": SimulatorPersona(
        name="Vendedor Misto",
        behavior="mixed",
        expected_output="neutral",
        expected_score_range=(35, 65),
        duration_seconds=300,
        difficulty_level=5,
    ),
    "vendedor_passivo_longo": SimulatorPersona(
        name="Vendedor Passivo (10min)",
        behavior="passive",
        expected_output="negative",
        expected_score_range=(0, 35),
        duration_seconds=600,
        difficulty_level=7,
    ),
    "vendedor_obediente_longo": SimulatorPersona(
        name="Vendedor Obediente (10min)",
        behavior="obedient",
        expected_output="positive",
        expected_score_range=(55, 85),
        duration_seconds=600,
        difficulty_level=7,
    ),
    "vendedor_rebelde_dificil": SimulatorPersona(
        name="Vendedor Rebelde Dificil",
        behavior="rebellious",
        expected_output="negative",
        expected_score_range=(0, 25),
        duration_seconds=300,
        difficulty_level=10,
    ),
}


# ============================================================================
# Data Collector
# ============================================================================

@dataclass
class OrchestratorDataCollector:
    """Captures all data channel messages from the agent."""
    all_messages: list[dict] = field(default_factory=list)
    transcriptions: list[dict] = field(default_factory=list)
    suggestions: list[dict] = field(default_factory=list)
    preloaded: list[dict] = field(default_factory=list)
    trajectories: list[dict] = field(default_factory=list)
    suggestion_updates: list[dict] = field(default_factory=list)
    coaching_hints: list[dict] = field(default_factory=list)
    emotions: list[dict] = field(default_factory=list)
    _greeting_event: asyncio.Event = field(default_factory=asyncio.Event)
    _latest_avatar_text: str = ""
    _avatar_event: asyncio.Event = field(default_factory=asyncio.Event)

    def record(self, msg: dict):
        self.all_messages.append(msg)
        msg_type = msg.get("type", "")

        if msg_type in ("transcription", "transcript"):
            self.transcriptions.append(msg)
            speaker = msg.get("speaker", "")
            if speaker in ("agent", "avatar"):
                text = msg.get("text", msg.get("content", ""))
                if text and msg.get("isFinal", True):
                    self._latest_avatar_text = text
                    self._avatar_event.set()
                    if len(self.transcriptions) <= 2:
                        self._greeting_event.set()

        elif msg_type == "ai_suggestion":
            self.suggestions.append(msg)
        elif msg_type == "preloaded_suggestions":
            self.preloaded.append(msg)
        elif msg_type == "session_trajectory":
            self.trajectories.append(msg)
        elif msg_type == "suggestion_update":
            self.suggestion_updates.append(msg)
        elif msg_type == "coaching_hint":
            self.coaching_hints.append(msg)
        elif msg_type == "emotion":
            self.emotions.append(msg)

    async def wait_for_greeting(self, timeout: float = 30) -> str:
        try:
            await asyncio.wait_for(self._greeting_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Agent greeting not received within {timeout}s")
        return self._latest_avatar_text

    async def wait_for_avatar_response(self, timeout: float = 20) -> str | None:
        self._avatar_event.clear()
        self._latest_avatar_text = ""
        try:
            await asyncio.wait_for(self._avatar_event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            return None
        return self._latest_avatar_text

    def get_active_suggestion(self) -> dict | None:
        if self.suggestions:
            return self.suggestions[-1]
        # Check preloaded for active
        if self.preloaded:
            for s in self.preloaded[-1].get("suggestions", []):
                if s.get("status") == "active":
                    return s
        return None


# ============================================================================
# User Simulator
# ============================================================================

BEHAVIOR_INSTRUCTIONS = {
    "obedient": (
        "SEMPRE siga a sugestao do coach se houver uma ativa. "
        "Faca perguntas SPIN na ordem correta. "
        "Responda objecoes com empatia e dados. "
        "Demonstre profissionalismo e escuta ativa."
    ),
    "rebellious": (
        "IGNORE todas as sugestoes do coach. "
        "Tente empurrar o produto imediatamente. "
        "Nao faca perguntas de descoberta. "
        "Fale mais que o cliente. Interrompa."
    ),
    "mixed": (
        "Siga a sugestao do coach 50% das vezes (alterne). "
        "As vezes faca perguntas boas, as vezes empurre o produto. "
        "Simule um vendedor inexperiente que as vezes acerta."
    ),
    "passive": (
        "De respostas muito curtas (3-5 palavras). "
        "Nao faca perguntas. Nao demonstre interesse. "
        "Espere o cliente conduzir a conversa. "
        "Responda com 'sim', 'entendo', 'ok' na maioria das vezes."
    ),
}


class UserSimulator:
    """Simulates a vendor using GPT-4o-mini."""

    def __init__(self, persona: SimulatorPersona, scenario_context: str):
        self.persona = persona
        self.scenario_context = scenario_context
        self._client = AsyncOpenAI()
        self._history: list[dict] = []
        self._active_suggestion: dict | None = None
        self._turn_count = 0

    def set_active_suggestion(self, suggestion: dict | None):
        self._active_suggestion = suggestion

    async def generate_response(self, avatar_text: str) -> str:
        self._history.append({"role": "assistant", "content": avatar_text})
        self._turn_count += 1

        suggestion_text = ""
        if self._active_suggestion:
            msg = self._active_suggestion.get("message", "")
            suggestion_text = f"\nSUGESTAO DO COACH: \"{msg}\""

        prompt = f"""Voce e um vendedor em treinamento em um roleplay. O cliente (avatar IA) esta falando com voce.

CENARIO: {self.scenario_context}

COMPORTAMENTO: {BEHAVIOR_INSTRUCTIONS[self.persona.behavior]}
{suggestion_text}

Turno {self._turn_count}. Responda ao cliente de forma natural em 1-3 frases. Use portugues brasileiro.
NAO use aspas. NAO adicione prefixos como "Vendedor:" ou "Eu:". Apenas a fala."""

        try:
            response = await self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    *self._history[-10:],  # Last 10 messages for context
                ],
                temperature=0.7,
                max_tokens=150,
            )
            text = response.choices[0].message.content or "Entendo."
            self._history.append({"role": "user", "content": text})
            return text.strip()
        except Exception as e:
            logger.error(f"Simulator error: {e}")
            return "Entendo, pode continuar."


# ============================================================================
# Audio Helpers
# ============================================================================

AUDIO_DIR = Path(__file__).parent / "test_audio_samples"


async def text_to_audio_frames_openai(text: str, client: AsyncOpenAI) -> list[rtc.AudioFrame]:
    """Convert text to audio frames using OpenAI TTS API (pcm output, no ffmpeg needed)."""
    try:
        response = await client.audio.speech.create(
            model="tts-1",
            voice="onyx",
            input=text,
            response_format="pcm",  # raw 24kHz 16-bit mono PCM
        )
        raw_pcm = response.content

        # OpenAI PCM is 24kHz 16-bit mono — resample to 48kHz for LiveKit
        samples_24k = struct.unpack(f"<{len(raw_pcm)//2}h", raw_pcm)

        # Simple 2x upsample (24k→48k) via sample duplication
        samples_48k = []
        for s in samples_24k:
            samples_48k.append(s)
            samples_48k.append(s)

        # Pack into 20ms frames at 48kHz
        samples_per_frame = 48000 * 20 // 1000  # 960 samples per 20ms
        frames = []
        for i in range(0, len(samples_48k), samples_per_frame):
            chunk = samples_48k[i:i + samples_per_frame]
            if len(chunk) < samples_per_frame:
                chunk = list(chunk) + [0] * (samples_per_frame - len(chunk))
            # Pack chunk as raw int16 LE bytes and create frame from bytes
            chunk_bytes = struct.pack(f"<{len(chunk)}h", *chunk)
            frame = rtc.AudioFrame(
                data=chunk_bytes,
                sample_rate=48000,
                num_channels=1,
                samples_per_channel=samples_per_frame,
            )
            frames.append(frame)

        return frames
    except Exception as e:
        logger.warning(f"OpenAI TTS failed: {e}")
        return generate_silence_frames(3.0)


def load_wav_frames(filepath: str, frame_duration_ms: int = 20) -> list[rtc.AudioFrame]:
    """Load WAV file as AudioFrame list."""
    frames = []
    with wave.open(filepath, "r") as wf:
        sample_rate = wf.getframerate()
        n_channels = wf.getnchannels()
        sample_width = wf.getsampwidth()
        n_frames = wf.getnframes()
        raw_data = wf.readframes(n_frames)

    if sample_width == 2:
        samples = list(struct.unpack(f"<{n_frames * n_channels}h", raw_data))
    else:
        samples = [0] * (n_frames * n_channels)

    if n_channels == 2:
        samples = [(samples[i] + samples[i + 1]) // 2 for i in range(0, len(samples), 2)]

    # Resample to 48kHz
    if sample_rate != 48000:
        ratio = 48000 / sample_rate
        new_len = int(len(samples) * ratio)
        samples = [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]
        sample_rate = 48000

    samples_per_frame = int(sample_rate * frame_duration_ms / 1000)
    for i in range(0, len(samples), samples_per_frame):
        chunk = samples[i:i + samples_per_frame]
        if len(chunk) < samples_per_frame:
            chunk.extend([0] * (samples_per_frame - len(chunk)))

        frame = rtc.AudioFrame.create(sample_rate, 1, samples_per_frame)
        frame_data = frame.data
        for j, s in enumerate(chunk):
            frame_data[j] = max(-32768, min(32767, int(s)))
        frames.append(frame)

    return frames


def generate_silence_frames(duration_s: float) -> list[rtc.AudioFrame]:
    """Generate silence frames as fallback."""
    sample_rate = 48000
    samples_per_frame = 960  # 20ms at 48kHz
    n_frames = int(sample_rate * duration_s / samples_per_frame)
    frames = []
    for _ in range(n_frames):
        frame = rtc.AudioFrame.create(sample_rate, 1, samples_per_frame)
        # Frame is already zero-initialized
        frames.append(frame)
    return frames


# ============================================================================
# Supabase Helpers (reused from test_production.py)
# ============================================================================

async def supabase_get(config: TestConfig, table: str, query: str = "") -> Any:
    url = f"{config.supabase_url}/rest/v1/{table}?{query}"
    headers = {
        "apikey": config.supabase_key,
        "Authorization": f"Bearer {config.supabase_key}",
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status == 200:
                return await resp.json()
            return None


async def supabase_post(config: TestConfig, function: str, body: dict) -> tuple[int, Any]:
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


async def get_first_scenario(config: TestConfig) -> tuple[str, str]:
    """Get first scenario ID and context."""
    result = await supabase_get(
        config, "scenarios",
        "select=id,context&limit=1&is_active=eq.true"
    )
    if result and len(result) > 0:
        return result[0]["id"], result[0].get("context", "")
    return "", ""


async def fetch_session(session_id: str, config: TestConfig) -> dict | None:
    result = await supabase_get(config, "sessions", f"id=eq.{session_id}&select=*")
    if result and len(result) > 0:
        return result[0]
    return None


async def fetch_feedback(session_id: str, config: TestConfig) -> dict | None:
    result = await supabase_get(config, "feedbacks", f"session_id=eq.{session_id}&select=*")
    if result and len(result) > 0:
        return result[0]
    return None


# ============================================================================
# Accuracy Metrics
# ============================================================================

@dataclass
class Validation:
    name: str
    expected: str
    actual: str
    passed: bool
    critical: bool = False

@dataclass
class CoachAccuracyMetrics:
    expected_output: str = ""
    actual_output: str = ""
    output_correct: bool = False
    expected_score_range: tuple[float, float] = (0, 100)
    actual_score: float = 0.0
    score_in_range: bool = False
    total_suggestions: int = 0
    suggestions_followed: int = 0
    suggestions_ignored: int = 0
    adherence_rate: float = 0.0
    total_injections: int = 0
    anchoring_events: int = 0
    role_inversions_detected: int = 0
    coherence_breaks: int = 0
    avg_suggestion_latency_ms: float = 0.0
    trajectory_transitions: list = field(default_factory=list)

@dataclass
class SimulationResult:
    persona: SimulatorPersona
    metrics: CoachAccuracyMetrics
    validations: list[Validation]
    session_id: str = ""
    duration_actual: float = 0.0
    error: str | None = None

    @property
    def passed(self) -> bool:
        return all(v.passed for v in self.validations if v.critical)

    @property
    def total_passed(self) -> int:
        return sum(1 for v in self.validations if v.passed)


# ============================================================================
# Simulation Runner
# ============================================================================

async def run_simulation(
    persona: SimulatorPersona,
    config: TestConfig,
    scenario_context: str = "",
) -> SimulationResult:
    """Run a full simulation with the given persona."""

    logger.info(f"\n{'='*60}")
    logger.info(f"Starting simulation: {persona.name}")
    logger.info(f"Behavior: {persona.behavior}, Duration: {persona.duration_seconds}s, Difficulty: {persona.difficulty_level}")
    logger.info(f"{'='*60}")

    # 1. Create session via Edge Function
    status, data = await supabase_post(config, "create-livekit-token", {
        "scenario_id": config.scenario_id,
        "access_code": config.access_code,
        "session_mode": "training",
    })

    if status != 200 or not isinstance(data, dict) or "token" not in data:
        return SimulationResult(
            persona=persona,
            metrics=CoachAccuracyMetrics(),
            validations=[],
            error=f"Token fetch failed: {status} {data}",
        )

    token = data["token"]
    session_id = data["session_id"]
    room_name = data.get("room_name", "")
    logger.info(f"Session created: {session_id}, Room: {room_name}")

    # 2. Connect to LiveKit
    room = rtc.Room()
    collector = OrchestratorDataCollector()
    simulator = UserSimulator(persona, scenario_context)

    @room.on("data_received")
    def on_data(packet: rtc.DataPacket):
        try:
            msg = json.loads(packet.data.decode())
            collector.record(msg)
            # Feed suggestion to simulator
            if msg.get("type") == "ai_suggestion":
                simulator.set_active_suggestion(msg)
            elif msg.get("type") == "preloaded_suggestions":
                for s in msg.get("suggestions", []):
                    if s.get("status") == "active":
                        simulator.set_active_suggestion(s)
                        break
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass

    duration_actual = 0.0
    try:
        await room.connect(config.livekit_url, token)
        logger.info("Connected to LiveKit room")

        # Publish audio track
        audio_source = rtc.AudioSource(sample_rate=48000, num_channels=1)
        audio_track = rtc.LocalAudioTrack.create_audio_track("microphone", audio_source)
        audio_options = rtc.TrackPublishOptions()
        audio_options.source = rtc.TrackSource.SOURCE_MICROPHONE
        await room.local_participant.publish_track(audio_track, audio_options)
        logger.info("Audio track published")

        # 3. Wait for greeting
        try:
            greeting = await collector.wait_for_greeting(timeout=45)
            logger.info(f"Greeting received: {greeting[:80]}...")
        except TimeoutError:
            return SimulationResult(
                persona=persona,
                metrics=CoachAccuracyMetrics(),
                validations=[],
                session_id=session_id,
                error="Agent greeting timeout",
            )

        # 4. Conversation loop
        start_time = time.time()
        turn_count = 0

        while time.time() - start_time < persona.duration_seconds:
            # Wait for avatar to finish speaking
            avatar_text = await collector.wait_for_avatar_response(timeout=20)
            if not avatar_text:
                logger.warning("No avatar response, continuing...")
                await asyncio.sleep(2)
                continue

            logger.info(f"[Avatar] {avatar_text[:80]}...")

            # Generate simulator response
            user_text = await simulator.generate_response(avatar_text)
            logger.info(f"[Simulator] {user_text[:80]}...")
            turn_count += 1

            # Convert to audio and send
            audio_frames = await text_to_audio_frames_openai(user_text, simulator._client)
            for frame in audio_frames:
                await audio_source.capture_frame(frame)
                await asyncio.sleep(0.018)  # ~20ms per frame

            # Brief pause between turns
            await asyncio.sleep(1.5)

        duration_actual = time.time() - start_time
        logger.info(f"Simulation complete: {turn_count} turns in {duration_actual:.0f}s")

    except Exception as e:
        logger.error(f"Simulation error: {e}")
        return SimulationResult(
            persona=persona,
            metrics=CoachAccuracyMetrics(),
            validations=[],
            session_id=session_id,
            error=str(e),
        )
    finally:
        await room.disconnect()

    # 5. Wait for session cleanup + feedback generation
    logger.info("Waiting for feedback generation...")
    await asyncio.sleep(10)

    # 6. Fetch results from DB
    session = await fetch_session(session_id, config)
    feedback = await fetch_feedback(session_id, config)

    # 7. Compute metrics and validate
    metrics = compute_metrics(persona, session, feedback, collector)
    validations = validate_results(persona, metrics)

    return SimulationResult(
        persona=persona,
        metrics=metrics,
        validations=validations,
        session_id=session_id,
        duration_actual=duration_actual,
    )


def compute_metrics(
    persona: SimulatorPersona,
    session: dict | None,
    feedback: dict | None,
    collector: OrchestratorDataCollector,
) -> CoachAccuracyMetrics:
    """Compute accuracy metrics from simulation data."""
    metrics = CoachAccuracyMetrics()

    # Score from session trajectory
    if session and session.get("session_trajectory"):
        traj = session["session_trajectory"]
        if isinstance(traj, str):
            traj = json.loads(traj)
        metrics.actual_score = traj.get("cumulative", 0)
        metrics.actual_output = traj.get("trajectory", "neutral")
    elif collector.trajectories:
        last_traj = collector.trajectories[-1]
        metrics.actual_score = last_traj.get("score", 0)
        metrics.actual_output = last_traj.get("trajectory", "neutral")

    # Output from session
    if session and session.get("final_output_type"):
        metrics.actual_output = session["final_output_type"]

    metrics.expected_output = persona.expected_output
    metrics.output_correct = metrics.actual_output == persona.expected_output
    metrics.expected_score_range = persona.expected_score_range
    metrics.score_in_range = (
        persona.expected_score_range[0] <= metrics.actual_score <= persona.expected_score_range[1]
    )

    # Suggestion metrics
    metrics.total_suggestions = len(collector.suggestions)
    for update in collector.suggestion_updates:
        status = update.get("status", "")
        if status == "followed":
            metrics.suggestions_followed += 1
        elif status in ("ignored", "skipped"):
            metrics.suggestions_ignored += 1

    total = metrics.suggestions_followed + metrics.suggestions_ignored
    metrics.adherence_rate = metrics.suggestions_followed / max(1, total)

    # Trajectory transitions
    for t in collector.trajectories:
        metrics.trajectory_transitions.append((
            t.get("timestamp", time.time()),
            t.get("trajectory", "neutral"),
        ))

    return metrics


def validate_results(
    persona: SimulatorPersona,
    metrics: CoachAccuracyMetrics,
) -> list[Validation]:
    """Validate simulation results against persona expectations."""
    validations = []

    # 1. Output prediction
    validations.append(Validation(
        name="output_prediction",
        expected=persona.expected_output,
        actual=metrics.actual_output or "unknown",
        passed=metrics.output_correct,
        critical=True,
    ))

    # 2. Score range
    validations.append(Validation(
        name="score_range",
        expected=f"{persona.expected_score_range}",
        actual=f"{metrics.actual_score:.1f}",
        passed=metrics.score_in_range,
        critical=True,
    ))

    # 3. Adherence rate per persona behavior
    if persona.behavior == "obedient":
        validations.append(Validation(
            name="adherence_rate",
            expected=">0.6",
            actual=f"{metrics.adherence_rate:.2f}",
            passed=metrics.adherence_rate > 0.6,
        ))
    elif persona.behavior == "rebellious":
        validations.append(Validation(
            name="adherence_rate",
            expected="<0.4",
            actual=f"{metrics.adherence_rate:.2f}",
            passed=metrics.adherence_rate < 0.4,
        ))

    # 4. Coherence for long sessions
    if persona.duration_seconds >= 300:
        validations.append(Validation(
            name="role_inversions",
            expected="0",
            actual=str(metrics.role_inversions_detected),
            passed=metrics.role_inversions_detected == 0,
            critical=True,
        ))
        validations.append(Validation(
            name="coherence_breaks",
            expected="<2",
            actual=str(metrics.coherence_breaks),
            passed=metrics.coherence_breaks < 2,
        ))

    return validations


# ============================================================================
# Report
# ============================================================================

def print_report(results: list[SimulationResult]):
    """Print accuracy report."""
    print()
    print("=" * 70)
    print("              ORCHESTRATOR ACCURACY REPORT")
    print("=" * 70)
    print(f" {'Persona':<22} | {'Output':^8} | {'Score':^8} | {'Adherence':^10} | {'Status':^8}")
    print("-" * 70)

    for r in results:
        if r.error:
            print(f" {r.persona.name:<22} | {'ERR':^8} | {'ERR':^8} | {'ERR':^10} | ERROR")
            continue

        output_ok = any(v.name == "output_prediction" and v.passed for v in r.validations)
        score_ok = any(v.name == "score_range" and v.passed for v in r.validations)

        output_str = f"{'OK' if output_ok else 'FAIL':^8}"
        score_str = f"{r.metrics.actual_score:>5.1f}{'':>3}"
        adherence_str = f"{r.metrics.adherence_rate:>6.2f}{'':>4}"
        status_str = "PASS" if r.passed else "FAIL"

        print(f" {r.persona.name:<22} | {output_str} | {score_str} | {adherence_str} | {status_str}")

    print("-" * 70)

    total = len(results)
    passed = sum(1 for r in results if r.passed and not r.error)
    errors = sum(1 for r in results if r.error)

    print(f" OVERALL: {passed}/{total - errors} passed", end="")
    if errors:
        print(f" ({errors} errors)")
    else:
        print()
    print("=" * 70)

    # Warnings
    for r in results:
        if r.error:
            print(f"\n  ERROR {r.persona.name}: {r.error}")
        elif not r.passed:
            failed = [v for v in r.validations if not v.passed]
            for v in failed:
                print(f"\n  WARNING {r.persona.name}/{v.name}: expected={v.expected}, actual={v.actual}")


# ============================================================================
# Main
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description="Test Coach Orchestrator accuracy")
    parser.add_argument("--all", action="store_true", help="Run all personas")
    parser.add_argument("--persona", type=str, help="Run specific persona")
    parser.add_argument("--duration", type=int, help="Override duration (seconds)")
    parser.add_argument("--report", action="store_true", help="Print detailed report")
    parser.add_argument("--quick", action="store_true", help="Run only 3-min personas")
    args = parser.parse_args()

    config = TestConfig.from_env()
    errors = config.validate()
    if errors:
        for e in errors:
            logger.error(e)
        sys.exit(1)

    # Get scenario
    if not config.scenario_id:
        scenario_id, scenario_context = await get_first_scenario(config)
        if not scenario_id:
            logger.error("No scenarios found")
            sys.exit(1)
        config.scenario_id = scenario_id
    else:
        scenarios = await supabase_get(
            config, "scenarios",
            f"id=eq.{config.scenario_id}&select=id,context"
        )
        scenario_context = scenarios[0].get("context", "") if scenarios else ""

    # Select personas
    if args.all or args.report:
        if args.quick:
            selected = {k: v for k, v in PERSONAS.items() if v.duration_seconds <= 180}
        else:
            selected = PERSONAS
    elif args.persona:
        if args.persona not in PERSONAS:
            logger.error(f"Unknown persona: {args.persona}. Available: {list(PERSONAS.keys())}")
            sys.exit(1)
        selected = {args.persona: PERSONAS[args.persona]}
    else:
        # Default: quick personas
        selected = {
            "vendedor_obediente": PERSONAS["vendedor_obediente"],
            "vendedor_rebelde": PERSONAS["vendedor_rebelde"],
        }

    # Override duration
    if args.duration:
        for p in selected.values():
            p.duration_seconds = args.duration

    # Run simulations
    results: list[SimulationResult] = []
    for name, persona in selected.items():
        result = await run_simulation(persona, config, scenario_context)
        results.append(result)

        if result.error:
            logger.error(f"FAILED: {name} - {result.error}")
        else:
            status = "PASS" if result.passed else "FAIL"
            logger.info(f"[{status}] {name}: score={result.metrics.actual_score:.1f}, "
                        f"output={result.metrics.actual_output}")

        # Wait between simulations (rate limit)
        await asyncio.sleep(6)

    # Print report
    print_report(results)

    # Exit code
    all_passed = all(r.passed for r in results if not r.error)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    asyncio.run(main())
