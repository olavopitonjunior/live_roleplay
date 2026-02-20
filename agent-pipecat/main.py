"""
Pipecat PoC Agent — Modular Voice Pipeline

Implements a modular STT → LLM → TTS pipeline using Pipecat framework
with LiveKit as the WebRTC transport layer.

Pipeline: Deepgram Nova-3 (STT) → Gemini 2.5 Flash (LLM) → ElevenLabs Flash v2.5 (TTS) → Simli Avatar (video)

This is a PoC for ADR-005. It runs in parallel with the main agent (agent/)
and connects to the same LiveKit Cloud rooms. The frontend works with either
agent without modification.

Usage:
    # Self-service test mode with avatar (auto-generates tokens, prints join URL):
    python main.py --scenario-id <uuid>

    # Audio-only mode (no avatar, for latency comparison):
    python main.py --scenario-id <uuid> --no-avatar

    # Explicit mode (bring your own token):
    python main.py --room-url wss://... --token <jwt> --room-name <name> --scenario-id <uuid>

    # With Pipecat Flows (structured FSM for retention scenario):
    python main.py --scenario-id <uuid> --use-flows
"""

import argparse
import asyncio
import logging
import os
import sys
import time

from dotenv import load_dotenv

# Load env BEFORE any imports that might read env vars
load_dotenv()

# Add parent agent/ to PYTHONPATH for shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agent"))

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.simli.video import SimliVideoService
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

# Shared modules from agent/
from prompts import build_agent_instructions

# Local modules
from processors import (
    AssistantTranscriptProcessor,
    EmotionProcessor,
    TranscriptProcessor,
)
from supabase_client import fetch_scenario, save_transcript

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("pipecat-poc")


def generate_token(identity: str, name: str, room_name: str) -> str:
    """Generate a LiveKit JWT from env vars."""
    from livekit.api import AccessToken, VideoGrants

    api_key = os.getenv("LIVEKIT_API_KEY", "")
    api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    if not api_key or not api_secret:
        raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set for token generation")

    token = AccessToken(api_key=api_key, api_secret=api_secret)
    token.with_identity(identity).with_name(name).with_grants(VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))
    return token.to_jwt()


async def run_session(
    room_url: str,
    token: str,
    room_name: str,
    scenario_id: str,
    difficulty: int = 3,
    session_id: str | None = None,
    use_flows: bool = False,
    use_avatar: bool = True,
) -> None:
    """Run a single Pipecat voice session."""

    # ── Fetch scenario ──────────────────────────────────────────────
    scenario = await fetch_scenario(scenario_id)
    logger.info(
        f"Scenario: {scenario.get('title', '?')} (difficulty={difficulty})"
    )

    # ── Build system prompt ─────────────────────────────────────────
    instructions = build_agent_instructions(
        scenario=scenario,
        outcomes=scenario.get("outcomes", []),
        difficulty_level=difficulty,
    )

    # ── LiveKit Transport ───────────────────────────────────────────
    transport_params = LiveKitParams(
        audio_out_enabled=True,
        audio_in_enabled=True,
        vad_enabled=True,
        vad_analyzer=SileroVADAnalyzer(
            sample_rate=16000,
            params=VADParams(
                confidence=0.5,
                start_secs=0.2,
                stop_secs=0.8,
                min_volume=0.4,
            ),
        ),
    )

    # Enable video output when avatar is active
    if use_avatar:
        transport_params.camera_out_enabled = True
        transport_params.camera_out_is_live = True
        transport_params.camera_out_width = 512
        transport_params.camera_out_height = 512
        logger.info("Avatar enabled — camera_out active (512x512)")

    transport = LiveKitTransport(
        url=room_url,
        token=token,
        room_name=room_name,
        params=transport_params,
    )

    # ── STT: Deepgram Nova-3 ────────────────────────────────────────
    from deepgram import LiveOptions

    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        live_options=LiveOptions(
            model="nova-3",
            language="pt-BR",
            smart_format=True,
            punctuate=True,
            endpointing=300,
            utterance_end_ms="1500",
            encoding="linear16",
            sample_rate=16000,
        ),
    )

    # ── LLM: Gemini 2.5 Flash ──────────────────────────────────────
    llm = GoogleLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        model="gemini-2.5-flash",
    )

    # ── TTS: ElevenLabs Flash v2.5 ─────────────────────────────────
    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVEN_API_KEY"),
        voice_id=os.getenv("ELEVEN_VOICE_ID", ""),
        model="eleven_flash_v2_5",
    )

    # ── Context aggregator ──────────────────────────────────────────
    messages = [{"role": "system", "content": instructions}]
    context = OpenAILLMContext(messages=messages)
    context_aggregator = llm.create_context_aggregator(context)

    # ── Avatar: Simli (optional) ────────────────────────────────────
    simli = None
    if use_avatar:
        simli_api_key = os.getenv("SIMLI_API_KEY")
        simli_face_id = os.getenv("SIMLI_FACE_ID", "")
        if simli_api_key and simli_face_id:
            simli = SimliVideoService(
                api_key=simli_api_key,
                face_id=simli_face_id,
            )
            logger.info(f"Simli avatar initialized (face_id={simli_face_id[:8]}...)")
        else:
            logger.warning("SIMLI_API_KEY or SIMLI_FACE_ID not set — running without avatar")

    # ── Custom processors ───────────────────────────────────────────
    transcript_proc = TranscriptProcessor(scenario=scenario)
    assistant_transcript_proc = AssistantTranscriptProcessor(
        transcript_proc=transcript_proc,
    )
    emotion_proc = EmotionProcessor(scenario=scenario)

    # ── Pipeline ────────────────────────────────────────────────────
    # Order: input → STT → user_transcript → context.user → LLM →
    #        assistant_transcript → emotion → TTS → [Simli] → output → context.assistant
    pipeline_stages = [
        transport.input(),
        stt,
        transcript_proc,
        context_aggregator.user(),
        llm,
        assistant_transcript_proc,
        emotion_proc,
        tts,
    ]
    if simli:
        pipeline_stages.append(simli)
    pipeline_stages.extend([
        transport.output(),
        context_aggregator.assistant(),
    ])

    pipeline = Pipeline(pipeline_stages)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
    )

    # ── Optional: Pipecat Flows ─────────────────────────────────────
    if use_flows:
        try:
            from pipecat_flows import FlowManager

            from flows.retention_flow import get_retention_flow_config

            flow_config = get_retention_flow_config(scenario)
            flow_manager = FlowManager(
                task=task,
                llm=llm,
                context_aggregator=context_aggregator,
                flow_config=flow_config,
            )
            logger.info("Pipecat Flows enabled — using retention FSM")
        except ImportError:
            logger.warning("pipecat-ai-flows not installed — running without flows")
            use_flows = False

    # ── Event handlers ──────────────────────────────────────────────
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant_id):
        logger.info(f"First participant joined: {participant_id}")

        if use_flows:
            logger.info("Initializing flow...")
            await flow_manager.initialize()
        else:
            # Without flows, append a nudge message and trigger the LLM
            from pipecat.frames.frames import LLMMessagesAppendFrame

            await task.queue_frame(
                LLMMessagesAppendFrame(
                    messages=[
                        {
                            "role": "user",
                            "content": (
                                "O usuario acabou de entrar na sala. Cumprimente-o "
                                "brevemente como o personagem descrito e inicie a conversa."
                            ),
                        },
                    ],
                    run_llm=True,
                )
            )

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant_id, reason):
        logger.info(f"Participant {participant_id} left: {reason}")
        from pipecat.frames.frames import EndFrame

        await task.queue_frame(EndFrame())

    # ── Run ─────────────────────────────────────────────────────────
    logger.info("Starting Pipecat pipeline...")
    runner = PipelineRunner(handle_sigint=True)
    await runner.run(task)

    # ── Post-session ────────────────────────────────────────────────
    transcript = transcript_proc.get_transcript()
    logger.info(f"Session complete — {len(transcript)} transcript entries")

    if session_id and transcript:
        await save_transcript(session_id, transcript)


def main():
    parser = argparse.ArgumentParser(
        description="Pipecat PoC Agent — Modular Voice Pipeline"
    )
    parser.add_argument(
        "--room-url",
        default=None,
        help="LiveKit server URL (wss://...). Falls back to LIVEKIT_URL env var.",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="LiveKit JWT token. If omitted, auto-generates from LIVEKIT_API_KEY/SECRET.",
    )
    parser.add_argument(
        "--room-name",
        default=None,
        help="LiveKit room name. If omitted, auto-generates pipecat_test_<timestamp>.",
    )
    parser.add_argument(
        "--scenario-id",
        required=True,
        help="Supabase scenario UUID",
    )
    parser.add_argument(
        "--difficulty",
        type=int,
        default=3,
        help="Difficulty level 1-10 (default: 3)",
    )
    parser.add_argument(
        "--session-id",
        default=None,
        help="Supabase session UUID for transcript saving (optional)",
    )
    parser.add_argument(
        "--use-flows",
        action="store_true",
        default=False,
        help="Enable Pipecat Flows FSM for structured conversation",
    )
    parser.add_argument(
        "--no-avatar",
        action="store_true",
        default=False,
        help="Disable Simli avatar (audio-only mode for latency comparison)",
    )
    args = parser.parse_args()

    # ── Resolve room URL ─────────────────────────────────────────────
    room_url = args.room_url or os.getenv("LIVEKIT_URL", "")
    if not room_url:
        parser.error("--room-url or LIVEKIT_URL env var is required")

    # ── Resolve room name ────────────────────────────────────────────
    room_name = args.room_name or f"pipecat_test_{int(time.time())}"

    # ── Resolve token (auto-generate if not provided) ────────────────
    if args.token:
        agent_token = args.token
    else:
        logger.info("No --token provided — auto-generating tokens...")
        agent_token = generate_token("pipecat-agent", "Pipecat Agent", room_name)
        user_token = generate_token("test-user", "Test User", room_name)

        print("\n" + "=" * 55)
        print("  PIPECAT PoC — Live Test Ready")
        print(f"  Room: {room_name}")
        print()
        print("  Join as user at: https://meet.livekit.io")
        print("    Tab: Custom")
        print(f"    Server URL: {room_url}")
        print(f"    Token: {user_token}")
        print()
        print(f"  User token (copy): {user_token}")
        print("=" * 55 + "\n")

    asyncio.run(
        run_session(
            room_url=room_url,
            token=agent_token,
            room_name=room_name,
            scenario_id=args.scenario_id,
            difficulty=args.difficulty,
            session_id=args.session_id,
            use_flows=args.use_flows,
            use_avatar=not args.no_avatar,
        )
    )


if __name__ == "__main__":
    main()
