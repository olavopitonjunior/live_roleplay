"""
Provider factory functions for STT, LLM, and TTS services.

Supports swapping providers via --provider-preset CLI flag for A/B latency testing.
Each factory does a lazy import so unused providers don't need to be installed.

Presets:
    default     — Deepgram Nova-3 + Gemini 2.5 Flash + ElevenLabs Flash v2.5
    aws-full    — AWS Transcribe + Bedrock Claude + Polly Camila
    aws-polly   — Deepgram + Gemini + Polly Camila
    aws-bedrock — Deepgram + Bedrock Claude + ElevenLabs
    nova-sonic  — Amazon Nova Sonic (speech-to-speech, replaces all three)
"""

import os
import logging

logger = logging.getLogger("pipecat-poc")


def _require_aws_credentials() -> None:
    """Validate AWS credentials are set before constructing AWS services."""
    if not os.getenv("AWS_ACCESS_KEY_ID") or not os.getenv("AWS_SECRET_ACCESS_KEY"):
        raise ValueError(
            "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set for AWS providers"
        )


# ── Provider preset definitions ─────────────────────────────────────────────
PROVIDER_PRESETS = {
    "default": {"stt": "deepgram", "llm": "gemini", "tts": "elevenlabs"},
    "aws-full": {"stt": "transcribe", "llm": "bedrock", "tts": "polly"},
    "aws-polly": {"stt": "deepgram", "llm": "gemini", "tts": "polly"},
    "aws-bedrock": {"stt": "deepgram", "llm": "bedrock", "tts": "elevenlabs"},
    "nova-sonic": {"stt": "nova-sonic", "llm": "nova-sonic", "tts": "nova-sonic"},
}


def is_speech_to_speech(preset: str) -> bool:
    """Check if a preset uses a speech-to-speech model (no separate STT/TTS)."""
    return preset == "nova-sonic"


# ── STT Factories ────────────────────────────────────────────────────────────

def create_stt(provider: str):
    """Create STT service based on provider name.

    Returns None for speech-to-speech presets (Nova Sonic handles STT internally).
    """
    if provider == "deepgram":
        from deepgram import LiveOptions
        from pipecat.services.deepgram.stt import DeepgramSTTService

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
        logger.info("STT: Deepgram Nova-3 (pt-BR)")
        return stt

    elif provider == "transcribe":
        from pipecat.services.aws.stt import AWSTranscribeSTTService
        from pipecat.transcriptions.language import Language

        _require_aws_credentials()
        stt = AWSTranscribeSTTService(
            region=os.getenv("AWS_REGION", "us-east-1"),
            language=Language.PT_BR,
        )
        logger.info(f"STT: AWS Transcribe (pt-BR, region={os.getenv('AWS_REGION', 'us-east-1')})")
        return stt

    elif provider == "nova-sonic":
        logger.info("STT: handled by Nova Sonic S2S")
        return None

    else:
        raise ValueError(f"Unknown STT provider: {provider}")


# ── LLM Factories ────────────────────────────────────────────────────────────

def create_llm(provider: str, instructions: str):
    """Create LLM service based on provider name.

    For Nova Sonic, the instructions are passed directly to the S2S model.
    Returns the LLM service and its context aggregator.
    """
    from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

    messages = [{"role": "system", "content": instructions}]

    if provider == "gemini":
        from pipecat.services.google.llm import GoogleLLMService

        llm = GoogleLLMService(
            api_key=os.getenv("GOOGLE_API_KEY"),
            model="gemini-2.5-flash",
        )
        context = OpenAILLMContext(messages=messages)
        context_aggregator = llm.create_context_aggregator(context)
        logger.info("LLM: Gemini 2.5 Flash")
        return llm, context_aggregator

    elif provider == "bedrock":
        from pipecat.services.aws.llm import AWSBedrockLLMService

        _require_aws_credentials()
        llm = AWSBedrockLLMService(
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            model="anthropic.claude-3-5-sonnet-20241022-v2:0",
        )
        context = OpenAILLMContext(messages=messages)
        context_aggregator = llm.create_context_aggregator(context)
        logger.info(f"LLM: AWS Bedrock Claude 3.5 Sonnet (region={os.getenv('AWS_REGION', 'us-east-1')})")
        return llm, context_aggregator

    elif provider == "nova-sonic":
        from pipecat.services.aws.nova_sonic.llm import AWSNovaSonicLLMService

        _require_aws_credentials()
        llm = AWSNovaSonicLLMService(
            access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            session_token=os.getenv("AWS_SESSION_TOKEN"),
            region=os.getenv("AWS_REGION", "us-east-1"),
            model="amazon.nova-sonic-v1:0",
            voice_id="tiffany",
            system_instruction=instructions,
        )
        context_aggregator = None  # Nova Sonic manages its own context
        logger.info("LLM: Amazon Nova Sonic S2S (replaces STT+LLM+TTS)")
        return llm, context_aggregator

    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


# ── TTS Factories ────────────────────────────────────────────────────────────

def create_tts(provider: str):
    """Create TTS service based on provider name.

    Returns None for speech-to-speech presets (Nova Sonic handles TTS internally).
    """
    if provider == "elevenlabs":
        from pipecat.services.elevenlabs.tts import ElevenLabsTTSService

        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVEN_API_KEY"),
            voice_id=os.getenv("ELEVEN_VOICE_ID", ""),
            model="eleven_flash_v2_5",
            params=ElevenLabsTTSService.InputParams(
                language="pt",
                stability=0.5,
                similarity_boost=0.75,
            ),
        )
        logger.info(f"TTS: ElevenLabs Flash v2.5 (voice={os.getenv('ELEVEN_VOICE_ID', '?')[:8]}...)")
        return tts

    elif provider == "polly":
        from pipecat.services.aws.tts import AWSPollyTTSService

        _require_aws_credentials()
        voice_id = os.getenv("AWS_POLLY_VOICE_ID", "Camila")
        tts = AWSPollyTTSService(
            region=os.getenv("AWS_REGION", "us-east-1"),
            voice_id=voice_id,
            params=AWSPollyTTSService.InputParams(
                engine="neural",  # Camila is a neural voice
            ),
        )
        logger.info(f"TTS: AWS Polly {voice_id} (neural, region={os.getenv('AWS_REGION', 'us-east-1')})")
        return tts

    elif provider == "nova-sonic":
        logger.info("TTS: handled by Nova Sonic S2S")
        return None

    else:
        raise ValueError(f"Unknown TTS provider: {provider}")
