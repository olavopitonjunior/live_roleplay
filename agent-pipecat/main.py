"""
Pipecat PoC Agent — Modular Voice Pipeline

Implements a modular STT → LLM → TTS pipeline using Pipecat framework
with LiveKit as the WebRTC transport layer. Supports multiple provider
presets for A/B latency and quality comparison.

Pipelines:
    default     — Deepgram Nova-3 → Gemini 2.5 Flash → ElevenLabs Flash v2.5
    aws-full    — AWS Transcribe → Bedrock Claude → Polly Camila
    aws-polly   — Deepgram → Gemini → Polly Camila
    aws-bedrock — Deepgram → Bedrock Claude → ElevenLabs
    nova-sonic  — Amazon Nova Sonic (speech-to-speech, single model)

Avatar providers:
    simli       — Simli 2D avatar (lip-sync from audio)
    nvidia-a2f  — NVIDIA Audio2Face-3D + Three.js (blendshapes via data channel)
    none        — Audio-only mode

Emotion providers:
    gpt4o       — GPT-4o-mini text-based analysis (default)
    hume        — Hume AI prosody analysis (48 emotion dimensions from audio)

Usage:
    # Default preset (Deepgram + Gemini + ElevenLabs + Simli):
    python main.py --scenario-id <uuid>

    # AWS full pipeline:
    python main.py --scenario-id <uuid> --provider-preset aws-full

    # Nova Sonic speech-to-speech (no separate STT/TTS):
    python main.py --scenario-id <uuid> --provider-preset nova-sonic --no-avatar

    # Hume emotion detection:
    python main.py --scenario-id <uuid> --emotion-provider hume

    # Audio-only with AWS Polly TTS:
    python main.py --scenario-id <uuid> --provider-preset aws-polly --no-avatar

    # NVIDIA Audio2Face avatar:
    python main.py --scenario-id <uuid> --avatar-provider nvidia-a2f
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
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

# Shared modules from agent/
from prompts import build_agent_instructions

# Local modules
from processors import (
    AssistantTranscriptProcessor,
    Audio2FaceProcessor,
    EmotionProcessor,
    HumeEmotionProcessor,
    LazySimliVideoService,
    LiveKitVideoPublisher,
    TranscriptProcessor,
)
from providers import (
    PROVIDER_PRESETS,
    create_llm,
    create_stt,
    create_tts,
    is_speech_to_speech,
)
from supabase_client import (
    fetch_scenario,
    save_transcript,
    set_feedback_requested,
    trigger_feedback_generation,
)

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
    avatar_provider: str = "simli",
    emotion_provider: str = "gpt4o",
    provider_preset: str = "default",
) -> None:
    """Run a single Pipecat voice session."""

    preset = PROVIDER_PRESETS[provider_preset]
    use_avatar = avatar_provider != "none"
    is_s2s = is_speech_to_speech(provider_preset)

    logger.info(
        f"Session config: preset={provider_preset} "
        f"(stt={preset['stt']}, llm={preset['llm']}, tts={preset['tts']}) "
        f"avatar={avatar_provider} emotion={emotion_provider}"
    )

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

    # Append TTS-specific rules (LLMs tend to include stage directions
    # in parentheses which TTS would read aloud)
    if not is_s2s:
        instructions += (
            "\n\n--- FORMATO DE RESPOSTA (CRITICO) ---\n"
            "Suas respostas serao convertidas diretamente em audio por um sistema TTS.\n"
            "NUNCA inclua direcoes de cena, indicacoes de tom ou acoes entre parenteses "
            "como '(frustrado)', '(com calma)', '(sorrindo)', etc.\n"
            "Fale DIRETAMENTE sem metadados de atuacao. Expresse emocoes apenas "
            "pelo conteudo e escolha de palavras, nao por indicacoes entre parenteses."
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

    # Enable video output only for Simli (video-based avatar).
    # nvidia-a2f sends blendshapes via data channel — no video track needed.
    if avatar_provider == "simli":
        transport_params.camera_out_enabled = True
        transport_params.camera_out_is_live = True
        transport_params.camera_out_width = 512
        transport_params.camera_out_height = 512
        logger.info("Simli avatar — camera_out active (512x512)")

    transport = LiveKitTransport(
        url=room_url,
        token=token,
        room_name=room_name,
        params=transport_params,
    )

    # ── Create services via provider factories ──────────────────────
    stt = create_stt(preset["stt"]) if not is_s2s else None
    llm, context_aggregator = create_llm(preset["llm"], instructions)
    tts = create_tts(preset["tts"]) if not is_s2s else None

    # ── Avatar setup ────────────────────────────────────────────────
    simli = None
    a2f_proc = None
    if avatar_provider == "simli":
        simli_api_key = os.getenv("SIMLI_API_KEY")
        simli_face_id = os.getenv("SIMLI_FACE_ID", "")
        if simli_api_key and simli_face_id:
            simli = LazySimliVideoService.create(
                api_key=simli_api_key,
                face_id=simli_face_id,
                is_trinity_avatar=False,
            )
            logger.info(f"Simli avatar configured (lazy init, face_id={simli_face_id[:8]}...)")
        else:
            logger.warning("SIMLI_API_KEY or SIMLI_FACE_ID not set — running without avatar")
    elif avatar_provider == "nvidia-a2f":
        nvidia_api_key = os.getenv("NVIDIA_API_KEY", "")
        nvidia_function_id = os.getenv(
            "NVIDIA_A2F_FUNCTION_ID",
            Audio2FaceProcessor.DEFAULT_FUNCTION_ID,
        )
        if nvidia_api_key:
            a2f_proc = Audio2FaceProcessor(
                api_key=nvidia_api_key,
                transport=transport,
                function_id=nvidia_function_id,
            )
            logger.info(
                f"NVIDIA Audio2Face configured (function_id={nvidia_function_id[:12]}...)"
            )
        else:
            logger.warning("NVIDIA_API_KEY not set — running without avatar")

    # ── Custom processors ───────────────────────────────────────────
    transcript_proc = TranscriptProcessor(scenario=scenario)
    assistant_transcript_proc = AssistantTranscriptProcessor(
        transcript_proc=transcript_proc,
    )

    # Emotion processor — GPT-4o-mini (text) or Hume (prosody)
    emotion_proc = None
    hume_proc = None
    if emotion_provider == "gpt4o":
        emotion_proc = EmotionProcessor(
            scenario=scenario,
            transcript_proc=transcript_proc,
            transport=transport,
        )
        logger.info("Emotion: GPT-4o-mini text analysis (every 2 turns)")
    elif emotion_provider == "hume":
        hume_api_key = os.getenv("HUME_API_KEY", "")
        if hume_api_key:
            hume_proc = HumeEmotionProcessor(
                api_key=hume_api_key,
                transport=transport,
            )
            logger.info("Emotion: Hume AI prosody analysis (every 5s of audio)")
        else:
            logger.warning("HUME_API_KEY not set — falling back to GPT-4o-mini")
            emotion_proc = EmotionProcessor(
                scenario=scenario,
                transcript_proc=transcript_proc,
                transport=transport,
            )

    # ── Build pipeline ──────────────────────────────────────────────
    if is_s2s:
        # Nova Sonic speech-to-speech: simplified pipeline
        # Nova Sonic handles STT + LLM + TTS internally
        pipeline_stages = [
            transport.input(),
        ]
        if hume_proc:
            pipeline_stages.append(hume_proc)
        pipeline_stages.extend([
            llm,
            transport.output(),
        ])
        logger.info("Pipeline: transport.input → [hume] → nova_sonic → transport.output")
    else:
        # Standard modular pipeline: STT → LLM → TTS
        pipeline_stages = [
            transport.input(),
        ]
        # Hume emotion processor intercepts input audio before STT
        if hume_proc:
            pipeline_stages.append(hume_proc)
        pipeline_stages.extend([
            stt,
            transcript_proc,
            context_aggregator.user(),
            llm,
            assistant_transcript_proc,
        ])
        # GPT-4o emotion processor goes after LLM (text-based)
        if emotion_proc:
            pipeline_stages.append(emotion_proc)
        pipeline_stages.append(tts)
        # Avatar stages
        if simli:
            pipeline_stages.append(simli)
            video_publisher = LiveKitVideoPublisher(transport=transport)
            pipeline_stages.append(video_publisher)
        if a2f_proc:
            # A2F taps TTS audio and publishes blendshapes via data channel
            # Audio still passes through to transport for playback
            pipeline_stages.append(a2f_proc)
        pipeline_stages.extend([
            transport.output(),
            context_aggregator.assistant(),
        ])
        avatar_label = "simli → video_pub" if simli else ("a2f" if a2f_proc else "none")
        logger.info(
            f"Pipeline: input → {'hume → ' if hume_proc else ''}"
            f"stt → transcript → context.user → llm → "
            f"assistant_transcript → {'emotion → ' if emotion_proc else ''}"
            f"tts → [{avatar_label}] → output → context.assistant"
        )

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
    flow_manager = None
    if use_flows and not is_s2s:
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

    # ── Event handlers ──────────────────────────────────────────────
    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant_id):
        logger.info(f"First participant joined: {participant_id}")

        if is_s2s:
            # Nova Sonic starts automatically on audio input
            logger.info("Nova Sonic S2S — waiting for user audio input")
        elif flow_manager is not None:
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

    if is_s2s and not transcript:
        logger.warning(
            "Nova Sonic S2S: transcript is empty (TranscriptProcessor not in pipeline). "
            "Feedback generation skipped."
        )

    if session_id and transcript:
        await save_transcript(session_id, transcript)

        # Validate conversation quality before triggering feedback
        user_lines = [e for e in transcript if e["speaker"] == "user"]
        avatar_lines = [e for e in transcript if e["speaker"] == "avatar"]
        total_chars = sum(len(e["text"]) for e in transcript)

        if len(user_lines) >= 3 and len(avatar_lines) >= 3 and total_chars >= 500:
            await set_feedback_requested(session_id)
            await trigger_feedback_generation(session_id)
        else:
            logger.warning(
                f"Conversation too short for feedback "
                f"({len(user_lines)}u/{len(avatar_lines)}a/{total_chars}c)"
            )


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
    # Provider preset
    parser.add_argument(
        "--provider-preset",
        choices=list(PROVIDER_PRESETS.keys()),
        default="default",
        help=(
            "Provider preset for STT/LLM/TTS combination. "
            "Choices: default, aws-full, aws-polly, aws-bedrock, nova-sonic"
        ),
    )
    # Avatar provider
    parser.add_argument(
        "--avatar-provider",
        choices=["simli", "nvidia-a2f", "none"],
        default="simli",
        help="Avatar provider: simli (2D lip-sync), nvidia-a2f (3D blendshapes), none (audio-only)",
    )
    # Emotion provider
    parser.add_argument(
        "--emotion-provider",
        choices=["gpt4o", "hume"],
        default="gpt4o",
        help="Emotion detection: gpt4o (text-based), hume (prosody audio analysis)",
    )
    # Legacy flag (maps to --avatar-provider none)
    parser.add_argument(
        "--no-avatar",
        action="store_true",
        default=False,
        help="Disable avatar (shortcut for --avatar-provider none)",
    )
    args = parser.parse_args()

    # Handle --no-avatar legacy flag
    avatar_provider = args.avatar_provider
    if args.no_avatar:
        avatar_provider = "none"

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

        preset = PROVIDER_PRESETS[args.provider_preset]
        print("\n" + "=" * 60)
        print("  PIPECAT PoC — Live Test Ready")
        print(f"  Room: {room_name}")
        print(f"  Preset: {args.provider_preset} ({preset['stt']}/{preset['llm']}/{preset['tts']})")
        print(f"  Avatar: {avatar_provider} | Emotion: {args.emotion_provider}")
        print()
        print("  Join as user at: https://meet.livekit.io")
        print("    Tab: Custom")
        print(f"    Server URL: {room_url}")
        print(f"    Token: {user_token}")
        print()
        print(f"  User token (copy): {user_token}")
        print("=" * 60 + "\n")

    asyncio.run(
        run_session(
            room_url=room_url,
            token=agent_token,
            room_name=room_name,
            scenario_id=args.scenario_id,
            difficulty=args.difficulty,
            session_id=args.session_id,
            use_flows=args.use_flows,
            avatar_provider=avatar_provider,
            emotion_provider=args.emotion_provider,
            provider_preset=args.provider_preset,
        )
    )


if __name__ == "__main__":
    main()
