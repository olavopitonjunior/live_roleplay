"""
Agent Roleplay - LiveKit Agents 1.3.x Implementation

This agent orchestrates real-time voice conversations with an AI avatar
for sales and negotiation training scenarios.

Improvements:
- Timestamps in transcript for better analysis
- AI-powered emotion analysis (Gemini Flash) with keyword fallback
- Emotion meter reflects CLIENT (avatar) satisfaction, not user
- Avatar synchronized after session start for better latency
"""

import os
import re
import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    UserStateChangedEvent,
    WorkerOptions,
    cli,
    room_io,
)
from google.genai.types import Modality
from livekit.plugins import google, silero, simli, elevenlabs

# Optional avatar providers - import with fallback
try:
    from livekit.plugins import liveavatar
    LIVEAVATAR_AVAILABLE = True
    print(f"[STARTUP] LiveAvatar plugin loaded successfully: {liveavatar}")
except ImportError as e:
    LIVEAVATAR_AVAILABLE = False
    liveavatar = None
    print(f"[STARTUP] LiveAvatar plugin NOT available: {e}")

try:
    from livekit.plugins import hedra
    HEDRA_AVAILABLE = True
    print(f"[STARTUP] Hedra plugin loaded successfully: {hedra}")
except ImportError as e:
    HEDRA_AVAILABLE = False
    hedra = None
    print(f"[STARTUP] Hedra plugin NOT available: {e}")

from prompts import build_agent_instructions
from emotion_analyzer import (
    analyze_emotion,
    analyze_emotion_sync,
    analyze_emotion_with_intensity,
    analyze_emotion_streaming,
    reset_emotion_history,
    EmotionResult,
)
from metrics_collector import get_metrics_collector, remove_metrics_collector, MetricsCollector
from coaching import get_coaching_engine, reset_coaching_engine, CoachingHint, HintType
from ai_coach import get_ai_coach, reset_ai_coach, AISuggestion
from conversation_coach import ConversationCoach

# Load environment variables
load_dotenv()

# Configure logging with DEBUG level
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configuration from environment
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Avatar providers configuration
SIMLI_API_KEY = os.getenv("SIMLI_API_KEY", "")
SIMLI_FACE_ID = os.getenv("SIMLI_FACE_ID", "")
LIVEAVATAR_API_KEY = os.getenv("LIVEAVATAR_API_KEY", "")
LIVEAVATAR_AVATAR_ID = os.getenv("LIVEAVATAR_AVATAR_ID", "")
HEDRA_API_KEY = os.getenv("HEDRA_API_KEY", "")
HEDRA_AVATAR_ID = os.getenv("HEDRA_AVATAR_ID", "")

# ElevenLabs TTS configuration (half-cascade: Gemini TEXT + ElevenLabs TTS)
ELEVEN_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", "")

# Lista de avatares Hedra disponíveis para seleção aleatória
HEDRA_AVATAR_IDS = [
    "a962cefb-57f3-4ed8-acd9-7260eef703b1",
    "f47a3167-01f8-45a3-b72e-7c36fa097e98",
    "0a1c73e8-887d-4cfe-84f4-4ec11d087e45",
]


# Regex to extract emotion tags from Gemini output (e.g., "[receptivo] Que interessante...")
EMOTION_TAG_PATTERN = re.compile(
    r'^\[(neutro|receptivo|curioso|entusiasmado|satisfeito|hesitante|cetico|frustrado)\]\s*',
    re.IGNORECASE
)

# Map emotion tag to intensity (0-100) for EmotionMeter
EMOTION_TAG_INTENSITY = {
    "entusiasmado": 95, "satisfeito": 80, "receptivo": 70, "curioso": 60,
    "neutro": 50, "hesitante": 35, "cetico": 20, "frustrado": 5,
}

# Translate PT-BR emotion tags to EN for frontend compatibility
# Frontend expects: enthusiastic, happy, receptive, curious, neutral, hesitant, skeptical, frustrated
EMOTION_PT_TO_EN = {
    "entusiasmado": "enthusiastic",
    "satisfeito": "happy",
    "receptivo": "receptive",
    "curioso": "curious",
    "neutro": "neutral",
    "hesitante": "hesitant",
    "cetico": "skeptical",
    "frustrado": "frustrated",
}


class EmotionStrippingAgent(Agent):
    """Agent subclass that strips emotion tags (e.g. [receptivo]) from text before TTS.

    In half-cascade mode (Gemini TEXT + ElevenLabs TTS), the LLM outputs text with
    emotion tags like "[receptivo] Olá!". These tags are parsed by conversation_item_added
    for the emotion system, but must NOT reach the TTS engine.
    """

    async def tts_node(self, text, model_settings):
        async def _strip_emotion_tags(source):
            async for chunk in source:
                cleaned = EMOTION_TAG_PATTERN.sub('', chunk)
                if cleaned:
                    yield cleaned

        async for frame in Agent.default.tts_node(self, _strip_emotion_tags(text), model_settings):
            yield frame


def format_transcript_line(speaker: str, text: str) -> str:
    """
    Format a transcript line with ISO timestamp.

    Args:
        speaker: 'Usuario' or 'Avatar'
        text: The spoken text

    Returns:
        Formatted line like '[2024-01-15T14:32:45.123Z] Usuario: Hello'
    """
    timestamp = datetime.now(timezone.utc).isoformat(timespec='milliseconds')
    return f"[{timestamp}] {speaker}: {text}"


async def with_retry(
    func,
    *args,
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    operation_name: str = "operation",
    **kwargs
):
    """
    Execute an async function with exponential backoff retry.

    Args:
        func: Async function to execute
        max_retries: Maximum number of retry attempts (default: 3)
        delay: Initial delay between retries in seconds (default: 1.0)
        backoff: Multiplier for delay after each retry (default: 2.0)
        operation_name: Name for logging purposes

    Returns:
        Result of the function or None if all retries failed
    """
    last_error = None
    current_delay = delay

    for attempt in range(max_retries + 1):
        try:
            result = await func(*args, **kwargs)
            if result is not None:
                if attempt > 0:
                    logger.info(f"{operation_name} succeeded on attempt {attempt + 1}")
                return result
            # Result is None, treat as failure
            if attempt < max_retries:
                logger.warning(f"{operation_name} returned None, retrying in {current_delay:.1f}s (attempt {attempt + 1}/{max_retries + 1})")
                await asyncio.sleep(current_delay)
                current_delay *= backoff
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                logger.warning(f"{operation_name} failed: {e}, retrying in {current_delay:.1f}s (attempt {attempt + 1}/{max_retries + 1})")
                await asyncio.sleep(current_delay)
                current_delay *= backoff
            else:
                logger.error(f"{operation_name} failed after {max_retries + 1} attempts. Last error: {e}")

    return None


async def _fetch_session_impl(session_id: str) -> dict[str, Any] | None:
    """Internal implementation of fetch_session."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return None

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{SUPABASE_URL}/rest/v1/sessions"
    params = {"id": f"eq.{session_id}", "select": "*"}

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    logger.error(f"Failed to fetch session: {response.status}")
                    return None
                data = await response.json()
                return data[0] if data else None
    except Exception as e:
        logger.error(f"Error fetching session: {e}")
        return None


async def fetch_session(session_id: str) -> dict[str, Any] | None:
    """Fetch session details from Supabase with retry."""
    return await with_retry(
        _fetch_session_impl,
        session_id,
        max_retries=3,
        delay=1.0,
        operation_name="fetch_session"
    )


async def _fetch_scenario_impl(scenario_id: str) -> dict[str, Any] | None:
    """Internal implementation of fetch_scenario."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return None

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{SUPABASE_URL}/rest/v1/scenarios"
    params = {"id": f"eq.{scenario_id}", "select": "*"}

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    logger.error(f"Failed to fetch scenario: {response.status}")
                    return None
                data = await response.json()
                return data[0] if data else None
    except Exception as e:
        logger.error(f"Error fetching scenario: {e}")
        return None


async def fetch_scenario(scenario_id: str) -> dict[str, Any] | None:
    """Fetch scenario details from Supabase with retry."""
    return await with_retry(
        _fetch_scenario_impl,
        scenario_id,
        max_retries=3,
        delay=1.0,
        operation_name="fetch_scenario"
    )


async def _fetch_scenario_outcomes_impl(scenario_id: str) -> list[dict[str, Any]] | None:
    """Internal implementation of fetch_scenario_outcomes."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return []

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{SUPABASE_URL}/rest/v1/scenario_outcomes"
    params = {"scenario_id": f"eq.{scenario_id}", "select": "*", "order": "display_order"}

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(url, headers=headers, params=params) as response:
                if response.status != 200:
                    logger.warning(f"Failed to fetch scenario outcomes: {response.status}")
                    return []
                data = await response.json()
                return data if data else []
    except Exception as e:
        logger.warning(f"Error fetching scenario outcomes: {e}")
        return []


async def fetch_scenario_outcomes(scenario_id: str) -> list[dict[str, Any]]:
    """Fetch possible outcomes for a scenario from Supabase."""
    result = await with_retry(
        _fetch_scenario_outcomes_impl,
        scenario_id,
        max_retries=2,
        delay=1.0,
        operation_name="fetch_scenario_outcomes"
    )
    return result if result is not None else []


async def _fetch_difficulty_profile_impl(access_code_id: str) -> dict[str, Any] | None:
    """Internal implementation of fetch_difficulty_profile."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return None

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    # Use the RPC function to get or create profile
    url = f"{SUPABASE_URL}/rest/v1/rpc/get_or_create_difficulty_profile"
    payload = {"p_access_code_id": access_code_id}

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.post(url, headers=headers, json=payload) as response:
                if response.status != 200:
                    # Fallback to direct query if RPC fails
                    logger.warning(f"RPC failed ({response.status}), trying direct query")
                    query_url = f"{SUPABASE_URL}/rest/v1/user_difficulty_profiles"
                    params = {"access_code_id": f"eq.{access_code_id}", "select": "*"}
                    async with http_session.get(query_url, headers=headers, params=params) as query_response:
                        if query_response.status == 200:
                            data = await query_response.json()
                            if data and len(data) > 0:
                                return data[0]
                    return {"current_level": 3}  # Default

                data = await response.json()
                return data if data else {"current_level": 3}
    except Exception as e:
        logger.warning(f"Error fetching difficulty profile: {e}")
        return {"current_level": 3}


async def fetch_difficulty_profile(access_code_id: str) -> dict[str, Any]:
    """Fetch difficulty profile for a user from Supabase."""
    result = await with_retry(
        _fetch_difficulty_profile_impl,
        access_code_id,
        max_retries=2,
        delay=1.0,
        operation_name="fetch_difficulty_profile"
    )
    return result if result else {"current_level": 3}


async def _fetch_learning_profile_impl(access_code_id: str) -> dict[str, Any] | None:
    """Internal implementation of fetch_learning_profile."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return None

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }

    # Query the learning profiles table directly
    url = f"{SUPABASE_URL}/rest/v1/user_learning_profiles"
    params = {
        "access_code_id": f"eq.{access_code_id}",
        "select": "recurring_weaknesses,recurring_strengths,spin_proficiency,average_score,total_sessions,objection_handling"
    }

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 0:
                        logger.info(f"Found learning profile for user: {data[0].get('total_sessions', 0)} sessions")
                        return data[0]
                    else:
                        logger.info("No learning profile found for user (new user)")
                        return {}
                else:
                    logger.warning(f"Failed to fetch learning profile: {response.status}")
                    return {}
    except Exception as e:
        logger.warning(f"Error fetching learning profile: {e}")
        return {}


async def fetch_learning_profile(access_code_id: str) -> dict[str, Any]:
    """Fetch learning profile for a user from Supabase."""
    result = await with_retry(
        _fetch_learning_profile_impl,
        access_code_id,
        max_retries=2,
        delay=1.0,
        operation_name="fetch_learning_profile"
    )
    return result if result else {}


async def _update_session_transcript_impl(
    session_id: str,
    transcript: str,
    status: str = "completed",
    has_avatar_fallback: bool = False
) -> bool:
    """Internal implementation of update_session_transcript."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase credentials not configured")
        return False

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    url = f"{SUPABASE_URL}/rest/v1/sessions"
    params = {"id": f"eq.{session_id}"}
    payload = {
        "transcript": transcript,
        "status": status,
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "has_avatar_fallback": has_avatar_fallback,
    }

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.patch(url, headers=headers, params=params, json=payload) as response:
                if response.status not in (200, 204):
                    logger.error(f"Failed to update session: {response.status}")
                    return False
                return True
    except Exception as e:
        logger.error(f"Error updating session: {e}")
        return False


async def update_session_transcript(
    session_id: str,
    transcript: str,
    status: str = "completed",
    has_avatar_fallback: bool = False
) -> bool:
    """Update session with transcript with retry."""
    result = await with_retry(
        _update_session_transcript_impl,
        session_id,
        transcript,
        status,
        has_avatar_fallback,
        max_retries=3,
        delay=1.0,
        operation_name="update_session_transcript"
    )
    return result if result is not None else False


async def save_intermediate_transcript(
    session_id: str,
    transcript_lines: list[str],
    status: str = "active"
) -> bool:
    """
    Save intermediate transcript during session to prevent data loss on crash.
    Uses 'active' status to indicate session is still in progress.
    """
    if not session_id or not transcript_lines:
        return True  # Nothing to save

    full_transcript = "\n".join(transcript_lines)

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    url = f"{SUPABASE_URL}/rest/v1/sessions"
    params = {"id": f"eq.{session_id}"}
    payload = {
        "transcript": full_transcript,
        "status": status,
        "last_transcript_update": datetime.now(timezone.utc).isoformat(),
    }

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.patch(url, headers=headers, params=params, json=payload) as response:
                if response.status in (200, 204):
                    logger.debug(f"Intermediate transcript saved: {len(transcript_lines)} lines")
                    return True
                return False
    except Exception as e:
        logger.warning(f"Failed to save intermediate transcript: {e}")
        return False


async def _trigger_feedback_impl(session_id: str) -> bool:
    """Internal implementation of trigger_feedback_generation."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    url = f"{SUPABASE_URL}/functions/v1/generate-feedback"

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.post(url, headers=headers, json={"session_id": session_id}) as response:
                if response.status != 200:
                    body = await response.text()
                    logger.warning(f"Feedback generation returned {response.status}: {body[:500]}")
                    return False
                return True
    except Exception as e:
        logger.error(f"Error triggering feedback: {e}")
        return False


async def trigger_feedback_generation(session_id: str) -> bool:
    """Trigger the feedback generation Edge Function with retry."""
    result = await with_retry(
        _trigger_feedback_impl,
        session_id,
        max_retries=2,
        delay=2.0,
        operation_name="trigger_feedback_generation"
    )
    return result if result is not None else False


async def set_feedback_requested(session_id: str) -> bool:
    """
    Mark that feedback generation has been requested by the agent.
    This prevents the frontend from triggering a duplicate request.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    url = f"{SUPABASE_URL}/rest/v1/sessions"
    params = {"id": f"eq.{session_id}"}
    payload = {"feedback_requested": True}

    try:
        async with aiohttp.ClientSession() as http_session:
            async with http_session.patch(url, headers=headers, params=params, json=payload) as response:
                if response.status in (200, 204):
                    logger.debug(f"Feedback requested flag set for session {session_id}")
                    return True
                return False
    except Exception as e:
        logger.warning(f"Failed to set feedback_requested flag: {e}")
        return False


_END_PHRASES_STRICT = [
    re.compile(r"\btchau\b", re.IGNORECASE),
    re.compile(r"\badeus\b", re.IGNORECASE),
    re.compile(r"\bate logo\b", re.IGNORECASE),
    re.compile(r"\bate mais\b", re.IGNORECASE),
    re.compile(r"\bvamos encerrar\b", re.IGNORECASE),
    re.compile(r"\bpode encerrar\b", re.IGNORECASE),
    re.compile(r"\bfinalizamos\b", re.IGNORECASE),
    re.compile(r"\bfinalizar\b", re.IGNORECASE),
    re.compile(r"\bfoi um prazer\b", re.IGNORECASE),
    re.compile(r"\bpor hoje e so\b", re.IGNORECASE),
    re.compile(r"\bvou nessa\b", re.IGNORECASE),
    re.compile(r"\bencerramos\b", re.IGNORECASE),
]


def detect_session_end(text: str) -> bool:
    """
    Detect if user wants to end the session based on their message.
    Uses word boundary regex to avoid false positives from substring matching.
    Only triggers on short phrases (< 10 words) to avoid matching goodbye words
    embedded in longer sentences like "obrigado pela informação".
    """
    text_lower = text.lower().strip()
    # Only accept short phrases as goodbye (long sentences are likely mid-conversation)
    if len(text_lower.split()) > 10:
        return False
    return any(p.search(text_lower) for p in _END_PHRASES_STRICT)


def create_avatar_session(scenario: dict[str, Any]) -> Any | None:
    """
    Factory function to create an AvatarSession based on the scenario's avatar provider.

    Supports multiple providers:
    - simli: Simli avatar with lip-sync (default)
    - liveavatar: HeyGen LiveAvatar
    - hedra: Hedra expressive avatars

    Args:
        scenario: Scenario dict from Supabase with avatar_provider and avatar_id fields

    Returns:
        AvatarSession instance or None if provider not configured
    """
    # Allow disabling avatar via environment variable (for testing or when credits depleted)
    if os.getenv('DISABLE_AVATAR', '').lower() in ('true', '1', 'yes'):
        logger.info("Avatar disabled via DISABLE_AVATAR environment variable - running audio only")
        return None

    provider = scenario.get('avatar_provider', 'hedra')
    avatar_id = scenario.get('avatar_id')

    logger.info(f"Creating avatar session: provider={provider}, avatar_id={avatar_id[:8] if avatar_id else 'None'}...")

    if provider == 'simli':
        # Simli: Use avatar_id or fall back to simli_face_id or env var
        face_id = avatar_id or scenario.get('simli_face_id') or SIMLI_FACE_ID
        if SIMLI_API_KEY and face_id:
            try:
                avatar = simli.AvatarSession(
                    simli_config=simli.SimliConfig(
                        api_key=SIMLI_API_KEY,
                        face_id=face_id,
                    ),
                )
                logger.info(f"Simli avatar initialized with face_id: {face_id[:8]}...")
                return avatar
            except Exception as e:
                logger.error(f"Failed to initialize Simli avatar: {e}")
        else:
            logger.warning("Simli not configured: missing API key or face_id")

    elif provider == 'liveavatar':
        logger.info(f"[AVATAR] Attempting LiveAvatar: AVAILABLE={LIVEAVATAR_AVAILABLE}, API_KEY={'SET' if LIVEAVATAR_API_KEY else 'NOT SET'}")
        if not LIVEAVATAR_AVAILABLE:
            logger.error("LiveAvatar plugin not installed. Run: pip install livekit-plugins-liveavatar")
            return None
        aid = avatar_id or LIVEAVATAR_AVATAR_ID
        logger.info(f"[AVATAR] LiveAvatar avatar_id: {aid}")
        if LIVEAVATAR_API_KEY and aid:
            try:
                logger.info(f"[AVATAR] Creating LiveAvatar AvatarSession...")
                avatar = liveavatar.AvatarSession(avatar_id=aid)
                logger.info(f"[AVATAR] LiveAvatar initialized successfully with avatar_id: {aid}")
                return avatar
            except Exception as e:
                logger.error(f"[AVATAR] Failed to initialize LiveAvatar: {e}", exc_info=True)
        else:
            logger.error(f"[AVATAR] LiveAvatar not configured: API_KEY={'SET' if LIVEAVATAR_API_KEY else 'MISSING'}, avatar_id={aid or 'MISSING'}")

    elif provider == 'hedra':
        if not HEDRA_AVAILABLE:
            logger.warning("Hedra plugin not installed. Run: pip install livekit-plugins-hedra")
            return None
        # Seleção aleatória se não especificado no cenário
        if avatar_id:
            aid = avatar_id
        elif HEDRA_AVATAR_IDS:
            aid = random.choice(HEDRA_AVATAR_IDS)
            logger.info(f"Randomly selected Hedra avatar: {aid[:8]}...")
        else:
            aid = HEDRA_AVATAR_ID
        if HEDRA_API_KEY and aid:
            try:
                avatar = hedra.AvatarSession(avatar_id=aid)
                logger.info(f"Hedra avatar initialized with avatar_id: {aid[:8]}...")
                return avatar
            except Exception as e:
                logger.error(f"Failed to initialize Hedra avatar: {e}")
        else:
            logger.warning("Hedra not configured: missing API key or avatar_id")

    else:
        logger.warning(f"Unknown avatar provider: {provider}")

    return None


async def entrypoint(ctx: JobContext):
    """
    Main entry point for the LiveKit agent.

    This function is called when a new room is created and the agent
    needs to join and start the conversation session.
    """
    logger.info(f"Agent starting for room: {ctx.room.name}")
    import time as _time_mod_early
    _session_start_time = _time_mod_early.time()

    # Connect to the room
    await ctx.connect()

    # Extract session_id from room name (format: roleplay_{session_id})
    room_name = ctx.room.name
    if not room_name.startswith("roleplay_"):
        logger.error(f"Invalid room name format: {room_name}")
        return

    session_id = room_name.replace("roleplay_", "")
    logger.info(f"Extracted session_id: {session_id}")

    # Initialize metrics collector for this session
    metrics = get_metrics_collector(session_id)

    # Fetch session from Supabase to get scenario_id
    session_data = await fetch_session(session_id)
    if not session_data:
        logger.error(f"Session {session_id} not found")
        return

    scenario_id = session_data.get("scenario_id")
    if not scenario_id:
        logger.error("No scenario_id in session")
        return

    # PRD 08: Get session mode and coach intensity
    session_mode = session_data.get("session_mode", "training")
    coach_intensity = session_data.get("coach_intensity", "medium")
    coaching_enabled = session_mode == "training"

    # Get access_code_id for difficulty profile
    access_code_id = session_data.get("access_code_id")

    logger.info(f"Session ID: {session_id}, Scenario ID: {scenario_id}")
    logger.info(f"Session mode: {session_mode}, Coach intensity: {coach_intensity}, Coaching enabled: {coaching_enabled}")

    # Fetch scenario from Supabase
    scenario = await fetch_scenario(scenario_id)
    if not scenario:
        logger.error(f"Scenario {scenario_id} not found")
        return

    logger.info(f"Loaded scenario: {scenario.get('title', 'Unknown')}")

    # Fetch possible outcomes for this scenario
    outcomes = await fetch_scenario_outcomes(scenario_id)
    logger.info(f"Loaded {len(outcomes)} possible outcomes for scenario")

    # Fetch difficulty level - from session or user profile
    difficulty_level = session_data.get("difficulty_level")
    if difficulty_level is None and access_code_id:
        profile = await fetch_difficulty_profile(access_code_id)
        difficulty_level = profile.get("current_level", 3)
    elif difficulty_level is None:
        difficulty_level = 3  # Default

    logger.info(f"Difficulty level: {difficulty_level}/10")

    # Fetch learning profile for AI coach (cross-session learning)
    learning_profile = {}
    if access_code_id and coaching_enabled:
        learning_profile = await fetch_learning_profile(access_code_id)
        if learning_profile.get("recurring_weaknesses"):
            logger.info(f"Learning profile loaded with weaknesses: {learning_profile.get('recurring_weaknesses')}")
        else:
            logger.info("Learning profile empty or new user")

    # Get voice setting from scenario (with fallback)
    voice = scenario.get('gemini_voice') or 'Puck'
    avatar_provider = scenario.get('avatar_provider', 'simli')

    logger.info(f"Using voice: {voice}, avatar_provider: {avatar_provider}")

    # Build dynamic instructions with outcomes and difficulty
    instructions = build_agent_instructions(scenario, outcomes, difficulty_level)

    # Add greeting instruction to make agent start conversation
    greeting_instruction = "\n\nIMPORTANTE: Ao iniciar a conversa, cumprimente o usuario de forma breve e natural, como 'Ola! Em que posso ajudar?' Seja direto e amigavel."
    full_instructions = instructions + greeting_instruction

    # Half-cascade architecture: Gemini Realtime (STT+LLM) + ElevenLabs (TTS)
    # - Gemini receives user audio natively (streaming STT) and outputs TEXT
    # - ElevenLabs Flash v2.5 synthesizes speech (~75ms TTFB)
    # - Faster than Gemini native audio output (text generation < audio generation)
    use_elevenlabs = bool(ELEVEN_VOICE_ID)

    # Native-audio models reject TEXT modality — use gemini-2.0-flash-live-001 for half-cascade
    if use_elevenlabs:
        gemini_model = "gemini-2.0-flash-live-001"
    else:
        gemini_model = "gemini-2.5-flash-native-audio-preview-12-2025"

    realtime_kwargs: dict[str, Any] = {
        "model": gemini_model,
        "temperature": 0.4,
        "instructions": full_instructions,
    }
    if use_elevenlabs:
        realtime_kwargs["modalities"] = [Modality.TEXT]
        logger.info(f"Half-cascade mode: Gemini TEXT + ElevenLabs TTS (voice_id={ELEVEN_VOICE_ID})")
    else:
        realtime_kwargs["voice"] = voice
        logger.info(f"Voice-to-voice mode: Gemini native audio (voice={voice})")

    session_kwargs: dict[str, Any] = {
        "llm": google.realtime.RealtimeModel(**realtime_kwargs),
        "vad": silero.VAD.load(
            min_speech_duration=0.1,
            min_silence_duration=0.15,
        ),
        "user_away_timeout": 60.0,
        "resume_false_interruption": True,
        "false_interruption_timeout": 1.0,
    }
    if use_elevenlabs:
        session_kwargs["tts"] = elevenlabs.TTS(
            model="eleven_flash_v2_5",
            voice_id=ELEVEN_VOICE_ID,
            language="pt",
        )

    session = AgentSession(**session_kwargs)

    # Proactive conversation coach (Layer 2: silence/hesitation, zero LLM cost)
    proactive_coach = ConversationCoach(stuck_timeout=10.0, hesitation_tokens=3)

    # Transcript collection
    transcript_lines: list[str] = []

    # Debounced transcript save - saves at most every 5 seconds
    import time as _time_mod
    _last_transcript_save_time: float = 0.0

    async def save_transcript_debounced():
        """Save transcript if at least 5s since last save (prevents DB overload)."""
        nonlocal _last_transcript_save_time
        now = _time_mod.time()
        if now - _last_transcript_save_time < 5:
            return  # debounce
        if not transcript_lines or not session_id:
            return
        _last_transcript_save_time = now
        try:
            _save_start = _time_mod.time()
            await save_intermediate_transcript(session_id, transcript_lines)
            _save_ms = (_time_mod.time() - _save_start) * 1000
            asyncio.create_task(send_latency_event("transcript_save", _save_ms, "Transcript Save", f"{len(transcript_lines)} lines"))
        except Exception as e:
            logger.warning(f"Debounced transcript save failed: {e}")

    # Evidence saving for session_evidences table
    _last_evidence_save: dict[str, float] = {}

    async def _save_evidence_to_db(sid: str, evidence_type: str, data: dict):
        """Fire-and-forget save to session_evidences table."""
        try:
            import json
            url = f"{SUPABASE_URL}/rest/v1/session_evidences"
            headers = {
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "session_id": sid,
                "evidence_type": evidence_type,
                "evidence_data": data,
                "turn_number": len(transcript_lines),
            }
            async with aiohttp.ClientSession() as http:
                async with http.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status in (200, 201):
                        logger.debug(f"Evidence saved: {evidence_type}")
                    else:
                        logger.warning(f"Evidence save failed: {resp.status}")
        except Exception as e:
            logger.warning(f"Evidence save error: {e}")

    async def save_evidence_if_needed(evidence_type: str, data: dict):
        """Save evidence with debounce of 5s per type."""
        now = _time_mod.time()
        if now - _last_evidence_save.get(evidence_type, 0) < 5:
            return  # debounce
        _last_evidence_save[evidence_type] = now
        if session_id:
            asyncio.create_task(_save_evidence_to_db(session_id, evidence_type, data))

    async def send_transcription_to_room(speaker: str, text: str, is_final: bool = True) -> bool:
        """Send transcription data to the frontend via data channel with retry."""
        if not text.strip():
            return True

        import json
        import time as time_module
        data = {
            "type": "transcription",
            "speaker": speaker,
            "text": text,
            "isFinal": is_final,
            "timestamp": int(time_module.time() * 1000)
        }

        max_retries = 3
        for attempt in range(max_retries):
            try:
                await ctx.room.local_participant.publish_data(
                    json.dumps(data).encode('utf-8'),
                    reliable=True
                )
                logger.debug(f"Transcription sent: {speaker}: {text[:50]}...")
                return True
            except Exception as e:
                logger.warning(f"Transcription attempt {attempt+1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.1 * (attempt + 1))

        logger.error(f"Failed to send transcription after {max_retries} attempts: {text[:100]}")
        return False

    async def send_status_to_room(status: str):
        """Send status update to the frontend."""
        try:
            import json
            data = json.dumps({
                "type": "status",
                "message": status
            })
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
        except Exception as e:
            logger.warning(f"Failed to send status: {e}")

    async def send_emotion_to_room(
        emotion: str,
        intensity: int | None = None,
        trend: str | None = None,
        reason: str | None = None
    ):
        """Send emotion state with intensity, trend, and reason to the frontend."""
        try:
            import json
            payload = {
                "type": "emotion",
                "value": emotion
            }
            # Add intensity and trend if provided (new format)
            if intensity is not None:
                payload["intensity"] = intensity
            if trend is not None:
                payload["trend"] = trend
            if reason is not None:
                payload["reason"] = reason

            data = json.dumps(payload)
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))

            # Also set participant attributes for persistent state (Fase 2B)
            # Attributes persist across reconnections, unlike data channel messages
            attrs = {"emotion": emotion}
            if intensity is not None:
                attrs["emotion_intensity"] = str(intensity)
            if trend is not None:
                attrs["emotion_trend"] = trend
            attrs["turn_count"] = str(len(transcript_lines))
            try:
                await ctx.room.local_participant.set_attributes(attrs)
            except Exception as attr_err:
                logger.debug(f"Participant attributes update failed: {attr_err}")

            logger.debug(f"Sent emotion: {emotion}, intensity={intensity}, trend={trend}, reason={reason}")
        except Exception as e:
            logger.warning(f"Failed to send emotion: {e}")

    async def send_emotion_processing():
        """Send processing state to frontend while analyzing emotion."""
        try:
            import json
            data = json.dumps({"type": "emotion_processing"})
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
        except Exception as e:
            logger.warning(f"Failed to send emotion processing: {e}")

    async def send_coaching_hint(hint: CoachingHint):
        """Send a coaching hint to the frontend."""
        try:
            import json
            # Build payload avoiding type field collision
            # hint.to_dict() has "type" (e.g. "encouragement"), we need "type": "coaching_hint"
            hint_data = hint.to_dict()
            hint_data["hintType"] = hint_data.pop("type")  # Rename to hintType
            data = json.dumps({
                "type": "coaching_hint",
                **hint_data
            })
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
            logger.debug(f"Sent coaching hint: {hint.title}")
        except Exception as e:
            logger.warning(f"Failed to send coaching hint: {e}")

    async def send_coaching_state():
        """Send current coaching state to frontend."""
        try:
            import json
            coaching = get_coaching_engine()
            state = coaching.get_state()
            data = json.dumps({
                "type": "coaching_state",
                **state
            })
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
            logger.debug(f"Sent coaching state: methodology={state['methodology']['completion_percentage']}%")

            # Also update participant attributes with SPIN stage (Fase 2B)
            methodology = state.get("methodology", {})
            spin_stage = "need_payoff"
            if not methodology.get("situation"):
                spin_stage = "situation"
            elif not methodology.get("problem"):
                spin_stage = "problem"
            elif not methodology.get("implication"):
                spin_stage = "implication"
            try:
                await ctx.room.local_participant.set_attributes({
                    "spin_stage": spin_stage,
                    "spin_completion": str(methodology.get("completion_percentage", 0)),
                })
            except Exception as attr_err:
                logger.debug(f"SPIN attributes update failed: {attr_err}")

        except Exception as e:
            logger.warning(f"Failed to send coaching state: {e}")

    async def send_ai_suggestion(suggestion: AISuggestion):
        """Send an AI-generated coaching suggestion to the frontend."""
        try:
            import json
            # Build payload avoiding type field collision
            # suggestion.to_dict() has "type" (e.g. "question"), we need "type": "ai_suggestion"
            suggestion_data = suggestion.to_dict()
            suggestion_data["suggestionType"] = suggestion_data.pop("type")  # Rename to suggestionType
            data = json.dumps({
                "type": "ai_suggestion",
                **suggestion_data
            })
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
            logger.debug(f"Sent AI suggestion: {suggestion.title} (streaming={suggestion.is_streaming})")
        except Exception as e:
            logger.warning(f"Failed to send AI suggestion: {e}")

    async def send_coaching_processing():
        """Send processing state to frontend while AI coach is analyzing."""
        try:
            import json
            data = json.dumps({"type": "coaching_processing"})
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
        except Exception as e:
            logger.warning(f"Failed to send coaching processing: {e}")

    # Latency measurement helper
    async def send_latency_event(event: str, duration_ms: float, label: str, details: str = ""):
        """Send latency measurement to frontend via data channel."""
        try:
            import json
            data = json.dumps({
                "type": "latency_event",
                "event": event,
                "duration_ms": round(duration_ms, 1),
                "label": label,
                "details": details,
                "timestamp": int(_time_mod.time() * 1000)
            })
            await ctx.room.local_participant.publish_data(data.encode('utf-8'))
            logger.info(f"[Latency] {event}: {duration_ms:.0f}ms {details}")
        except Exception:
            pass

    # Latency tracking state
    _last_user_speech_end_time: float = 0.0
    _greeting_trigger_time: float = 0.0
    _greeting_received: bool = False
    _response_turn_counter: int = 0

    # Streaming analysis tracking
    import time
    last_partial_analysis_time = {"user": 0.0, "avatar": 0.0}
    PARTIAL_ANALYSIS_INTERVAL = 0.5  # seconds

    async def handle_early_end():
        """Handle early session termination when user says goodbye."""
        # Wait a bit for the avatar to respond to the goodbye
        await asyncio.sleep(5)
        logger.info("Ending session early due to user request")
        await send_status_to_room("Encerrando sessao...")
        try:
            session.shutdown(drain=True)
        except Exception as e:
            logger.warning(f"Failed to drain session on early end: {e}")
            logger.warning(
                f"SHUTDOWN_TRIGGER: source='early_end_drain_fail', "
                f"elapsed={time.time() - _session_start_time:.1f}s, "
                f"lines={len(transcript_lines)}, "
                f"greeting={_greeting_received}, "
                f"participants={len(ctx.room.remote_participants)}"
            )
            shutdown_event.set()

    # Flag to track if early end was triggered
    early_end_triggered = False

    @session.on("user_input_transcribed")
    def on_user_input(event):
        """Called when user speech is transcribed."""
        nonlocal early_end_triggered
        logger.debug(f"user_input_transcribed event received: {event}")
        # event is UserInputTranscribedEvent with transcript, is_final, etc.
        text = event.transcript
        is_final = event.is_final
        if text:
            # Signal that we're processing when user starts speaking
            if not is_final:
                # User is speaking, show processing state on emotion meter
                asyncio.create_task(send_emotion_processing())

                # NEW: Streaming analysis for partial transcripts
                now = time.time()
                if (now - last_partial_analysis_time["user"] >= PARTIAL_ANALYSIS_INTERVAL
                    and len(text) >= 15):
                    last_partial_analysis_time["user"] = now

                    # Streaming AI coach analysis (only in training mode)
                    if coaching_enabled:
                        async def analyze_streaming_user():
                            try:
                                ai_coach = get_ai_coach()
                                suggestion = await ai_coach.analyze_streaming(text, "user")
                                if suggestion:
                                    await send_ai_suggestion(suggestion)
                            except Exception as e:
                                logger.warning(f"Streaming AI coach analysis failed: {e}")

                        asyncio.create_task(analyze_streaming_user())

                    # Streaming emotion analysis (fast keyword-based)
                    async def analyze_streaming_emotion():
                        try:
                            result = await analyze_emotion_streaming(text, transcript_lines)
                            # Send with lower confidence indicator
                            await send_emotion_to_room(
                                result["state"],
                                result["intensity"],
                                result["trend"],
                                None  # No reason for streaming
                            )
                        except Exception as e:
                            logger.warning(f"Streaming emotion analysis failed: {e}")

                    asyncio.create_task(analyze_streaming_emotion())

            if is_final:
                # Record timestamp for response latency measurement
                nonlocal _last_user_speech_end_time
                _last_user_speech_end_time = time.time()

                # Add timestamped line to transcript
                transcript_lines.append(format_transcript_line("Usuario", text))
                logger.info(f"Added user line to transcript, total lines: {len(transcript_lines)}")
                # Save transcript immediately (debounced to prevent DB overload)
                asyncio.create_task(save_transcript_debounced())
                # Check for early session end (with 15s cooldown after greeting to avoid echo)
                _greeting_elapsed = time.time() - _greeting_trigger_time if _greeting_trigger_time > 0 else 999
                if _greeting_elapsed > 15 and detect_session_end(text) and not early_end_triggered:
                    early_end_triggered = True
                    logger.info("User requested session end, will terminate after response")
                    asyncio.create_task(handle_early_end())

                # Layer 2: Proactive coach — hesitation detection (zero LLM cost)
                if coaching_enabled:
                    proactive_coach.reset_timer()  # User spoke → reset silence watchdog
                    # Get current SPIN stage for context-aware nudge
                    _spin_stage = "default"
                    try:
                        _methodology = get_coaching_engine()._methodology
                        if not _methodology.situation:
                            _spin_stage = "situation"
                        elif not _methodology.problem:
                            _spin_stage = "problem"
                        elif not _methodology.implication:
                            _spin_stage = "implication"
                        elif not _methodology.need_payoff:
                            _spin_stage = "need_payoff"
                    except Exception:
                        pass

                    _hesitation_hint = proactive_coach.check_hesitation(text, _spin_stage)
                    if _hesitation_hint:
                        _h = CoachingHint(
                            id=f"proactive_hesitation_{int(time.time())}",
                            type=HintType.SUGGESTION,
                            title="Elabore mais",
                            message=_hesitation_hint.text,
                            priority=3,
                        )
                        asyncio.create_task(send_coaching_hint(_h))
                        logger.info(f"Proactive hesitation nudge: {_hesitation_hint.reason}")

                # Layer 1: Keyword coaching hints - only in training mode
                if coaching_enabled:
                    async def analyze_user_coaching():
                        try:
                            _coach_kw_start = time.time()
                            coaching = get_coaching_engine()
                            hints = coaching.analyze_user_message(text)
                            _coach_kw_ms = (time.time() - _coach_kw_start) * 1000
                            asyncio.create_task(send_latency_event("coach_keyword", _coach_kw_ms, "Coach Keyword", f"{len(hints)} hints"))
                            for hint in hints:
                                await send_coaching_hint(hint)
                                # Save evidence for each detected hint
                                await save_evidence_if_needed(
                                    f"coaching_hint_{hint.hint_type}",
                                    {"type": hint.hint_type, "text": hint.text, "speaker": "user"}
                                )
                            # Save SPIN progress as evidence
                            methodology = coaching._methodology.to_dict()
                            completed_steps = [k for k, v in methodology.items() if v]
                            if completed_steps:
                                await save_evidence_if_needed(
                                    "spin_progress",
                                    {"completed": completed_steps, "speaker": "user"}
                                )
                            # Send updated state periodically
                            await send_coaching_state()
                        except Exception as e:
                            logger.warning(f"Coaching analysis failed: {e}")

                    asyncio.create_task(analyze_user_coaching())

                    # AI Coach final analysis for specific suggestions
                    async def analyze_user_ai_coach():
                        try:
                            _coach_ai_start = time.time()
                            await send_coaching_processing()
                            ai_coach = get_ai_coach()
                            # Update AI coach context from keyword engine
                            coaching = get_coaching_engine()
                            ai_coach.update_context(
                                methodology_progress=coaching._methodology.to_dict(),
                                pending_objections=[obj.text for obj in coaching._objections if not obj.addressed],
                                talk_ratio=coaching.get_talk_ratio()
                            )
                            suggestion = await ai_coach.analyze_final(text, "user")
                            _coach_ai_ms = (time.time() - _coach_ai_start) * 1000
                            if suggestion:
                                await send_ai_suggestion(suggestion)
                                # Track Gemini Flash call for AI coaching
                                metrics.record_gemini_flash_call(input_tokens=200, output_tokens=50)
                                asyncio.create_task(send_latency_event("coach_ai", _coach_ai_ms, "Coach AI", f"suggestion: {suggestion.title[:30]}"))
                            else:
                                asyncio.create_task(send_latency_event("coach_ai", _coach_ai_ms, "Coach AI", "skipped/no suggestion"))
                                logger.warning(f"AI Coach returned None for user input: {text[:50]}...")
                        except Exception as e:
                            logger.warning(f"AI coach analysis failed: {e}")

                    asyncio.create_task(analyze_user_ai_coach())

            logger.info(f"User said: {text} (final={is_final})")
            # Track input tokens for metrics
            if is_final:
                input_tokens = metrics.estimate_tokens(text)
                metrics.add_gemini_live_tokens(input_tokens=input_tokens)
            # Send to frontend (fire and forget)
            asyncio.create_task(send_transcription_to_room("user", text, is_final))
            asyncio.create_task(send_status_to_room("Processando resposta..."))

    # Agent state tracking for latency diagnostics (Fase 1B)
    _agent_thinking_start: float = 0.0

    @session.on("agent_state_changed")
    def on_agent_state_changed(ev):
        nonlocal _agent_thinking_start
        if ev.new_state == "thinking":
            _agent_thinking_start = time.time()
        elif ev.new_state == "speaking" and _agent_thinking_start > 0:
            thinking_ms = (time.time() - _agent_thinking_start) * 1000
            _agent_thinking_start = 0.0
            asyncio.create_task(send_latency_event(
                "agent_thinking", thinking_ms, "Agent Think→Speak",
                f"state={ev.new_state}"
            ))
            if thinking_ms > 2000:
                logger.warning(f"[Latency] Agent thinking took {thinking_ms:.0f}ms (>2s)")

    @session.on("conversation_item_added")
    def on_conversation_item(event):
        """Called when a new conversation item is added (user or assistant message)."""
        logger.info(f"conversation_item_added event received")
        try:
            # event is ConversationItemAddedEvent with item being a ChatMessage
            item = event.item
            role = item.role  # "user" or "assistant"
            text = item.text_content  # property that returns text or None

            logger.info(f"conversation_item_added: role={role}, text_length={len(text) if text else 0}")

            # Only process assistant messages (agent/avatar responses)
            # The avatar represents the CLIENT in the roleplay scenario
            if role == "assistant" and text:
                # Latency: measure greeting or response time
                nonlocal _greeting_received, _last_user_speech_end_time, _response_turn_counter
                _now = time.time()
                if not _greeting_received:
                    _greeting_received = True
                    if _greeting_trigger_time > 0:
                        _greeting_ms = (_now - _greeting_trigger_time) * 1000
                        asyncio.create_task(send_latency_event("greeting", _greeting_ms, "Greeting", f"{len(text)} chars"))
                elif _last_user_speech_end_time > 0:
                    _response_ms = (_now - _last_user_speech_end_time) * 1000
                    _response_turn_counter += 1
                    asyncio.create_task(send_latency_event("response_time", _response_ms, "Response Time", f"turn {_response_turn_counter}"))
                    _last_user_speech_end_time = 0.0  # Reset for next turn

                # Extract emotion tag from Gemini output (e.g., "[receptivo] Texto...")
                clean_text = text
                emotion_tag_match = EMOTION_TAG_PATTERN.match(text)
                if emotion_tag_match:
                    emotion_tag = emotion_tag_match.group(1).lower()
                    clean_text = text[emotion_tag_match.end():]  # Remove tag from text
                    # Send emotion INSTANTLY (no wait for Gemini Flash analysis)
                    tag_intensity = EMOTION_TAG_INTENSITY.get(emotion_tag, 50)
                    # Translate PT-BR tag to EN for frontend compatibility
                    emotion_en = EMOTION_PT_TO_EN.get(emotion_tag, "neutral")
                    asyncio.create_task(send_emotion_to_room(
                        emotion_en, tag_intensity, None, f"Avatar: {emotion_en}"
                    ))
                    logger.debug(f"Emotion tag extracted: [{emotion_tag}] -> {emotion_en}, intensity {tag_intensity}")

                # Add timestamped line to transcript (WITHOUT emotion tag)
                transcript_lines.append(format_transcript_line("Avatar", clean_text))
                logger.info(f"Avatar said: {clean_text[:100]}... (added to transcript, total lines: {len(transcript_lines)})")

                # Save transcript incrementally every 3 messages to minimize data loss
                if len(transcript_lines) % 3 == 0:
                    asyncio.create_task(save_intermediate_transcript(session_id, transcript_lines))

                # Track output tokens for metrics
                output_tokens = metrics.estimate_tokens(clean_text)
                metrics.add_gemini_live_tokens(output_tokens=output_tokens)

                # Send to frontend (clean text without emotion tag)
                asyncio.create_task(send_transcription_to_room("avatar", clean_text))
                asyncio.create_task(send_status_to_room("Ouvindo..."))

                # Background emotion analysis via Gemini Flash
                # Skip if emotion tag was already extracted (saves 1 API call per turn)
                if not emotion_tag_match:
                    async def analyze_and_send_emotion():
                        try:
                            _emo_start = time.time()
                            result = await analyze_emotion_with_intensity(clean_text, transcript_lines)
                            _emo_ms = (time.time() - _emo_start) * 1000
                            asyncio.create_task(send_latency_event("emotion_analysis", _emo_ms, "Emotion AI", result.get("state", "?")))
                            await send_emotion_to_room(
                                result["state"],
                                result["intensity"],
                                result["trend"],
                                result.get("reason")
                            )
                            metrics.record_gemini_flash_call(input_tokens=100, output_tokens=5)
                        except Exception as e:
                            logger.warning(f"AI emotion analysis failed, using fallback: {e}")
                            emotion = analyze_emotion_sync(clean_text)
                            await send_emotion_to_room(emotion)

                    asyncio.create_task(analyze_and_send_emotion())

                # Analyze avatar message for coaching (objection detection) - only in training mode
                if coaching_enabled:
                    async def analyze_avatar_coaching():
                        try:
                            coaching = get_coaching_engine()
                            hints = coaching.analyze_avatar_message(clean_text)
                            for hint in hints:
                                await send_coaching_hint(hint)
                                # Save evidence for detected objections
                                await save_evidence_if_needed(
                                    f"coaching_hint_{hint.hint_type}",
                                    {"type": hint.hint_type, "text": hint.text, "speaker": "avatar"}
                                )
                            # Send updated state with objections
                            await send_coaching_state()
                        except Exception as e:
                            logger.warning(f"Coaching analysis failed: {e}")

                    asyncio.create_task(analyze_avatar_coaching())

                    # AI Coach analysis for avatar (client) responses
                    async def analyze_avatar_ai_coach():
                        try:
                            ai_coach = get_ai_coach()
                            # Update context from keyword engine
                            coaching = get_coaching_engine()
                            ai_coach.update_context(
                                methodology_progress=coaching._methodology.to_dict(),
                                pending_objections=[obj.text for obj in coaching._objections if not obj.addressed],
                                talk_ratio=coaching.get_talk_ratio()
                            )
                            suggestion = await ai_coach.analyze_final(clean_text, "avatar")
                            if suggestion:
                                await send_ai_suggestion(suggestion)
                                # Track Gemini Flash call
                                metrics.record_gemini_flash_call(input_tokens=200, output_tokens=50)
                            else:
                                logger.warning(f"AI Coach returned None for avatar response: {clean_text[:50]}...")
                        except Exception as e:
                            logger.warning(f"AI coach avatar analysis failed: {e}")

                    asyncio.create_task(analyze_avatar_ai_coach())
        except Exception as e:
            logger.error(f"Error in conversation_item_added handler: {e}", exc_info=True)

    # Initialize avatar using factory (supports simli, liveavatar, hedra)
    avatar = create_avatar_session(scenario)

    # Track if avatar failed (for has_avatar_fallback flag)
    avatar_failed = False

    # Shutdown callback to save transcript and metrics
    async def on_shutdown():
        """Called when session ends."""
        nonlocal avatar_failed
        logger.info(f"on_shutdown called: session_id={session_id}, transcript_lines={len(transcript_lines)}, avatar_failed={avatar_failed}")

        if not session_id:
            logger.warning("No session_id available, cannot save transcript")
            return

        if not transcript_lines:
            logger.warning("No transcript lines captured - session may have ended before conversation started")
            # Still mark session as completed even without transcript
            await update_session_transcript(session_id, "", "completed", has_avatar_fallback=avatar_failed)
            remove_metrics_collector(session_id)
            logger.info("Agent session ended (no transcript)")
            return

        full_transcript = "\n".join(transcript_lines)
        logger.info(f"Saving transcript ({len(transcript_lines)} lines, {len(full_transcript)} chars)")

        success = await update_session_transcript(session_id, full_transcript, has_avatar_fallback=avatar_failed)
        if success:
            logger.info("Transcript saved successfully")

            # Save API usage metrics
            metrics_saved = await metrics.save_to_database()
            if metrics_saved:
                logger.info(f"Metrics saved: ${metrics.calculate_cost_cents()/100:.4f} estimated cost")
            else:
                logger.warning("Failed to save metrics")

            # Validate transcript before triggering feedback (avoids wasting Claude API calls)
            user_lines = [l for l in transcript_lines if "Usuario:" in l]
            avatar_lines = [l for l in transcript_lines if "Avatar:" in l]
            if len(user_lines) >= 3 and len(avatar_lines) >= 3 and len(full_transcript) >= 500:
                # Set flag to prevent frontend from triggering duplicate feedback
                await set_feedback_requested(session_id)
                await trigger_feedback_generation(session_id)
                logger.info("Feedback generation triggered")
            else:
                logger.warning(
                    f"Transcript too short for feedback: "
                    f"{len(user_lines)} user lines, {len(avatar_lines)} avatar lines, "
                    f"{len(full_transcript)} chars - skipping feedback generation"
                )
        else:
            logger.error("Failed to save transcript")

        # Clean up metrics collector
        remove_metrics_collector(session_id)
        logger.info("Agent session ended")

    # Register shutdown callback
    ctx.add_shutdown_callback(on_shutdown)

    # Event to signal when session should end
    shutdown_event = asyncio.Event()

    # PRD 08, US-14: Session timeout from scenario config (fallback to 3 minutes)
    # Null safety: duration_max_seconds may be None in DB even if key exists
    _raw_timeout = scenario.get('duration_max_seconds')
    session_timeout_seconds = (
        _raw_timeout if isinstance(_raw_timeout, (int, float)) and _raw_timeout > 0
        else 180
    )
    logger.info(f"Session timeout configured: {session_timeout_seconds}s (from scenario)")
    timeout_task: asyncio.Task | None = None

    async def session_timeout():
        """End session after timeout period with 30s warning and farewell."""
        try:
            # Wait until 30s before timeout, then warn user
            if session_timeout_seconds > 30:
                await asyncio.sleep(session_timeout_seconds - 30)
                await send_status_to_room("30 segundos restantes!")
                await asyncio.sleep(30)
            else:
                await asyncio.sleep(session_timeout_seconds)

            logger.info(f"Session timeout reached ({session_timeout_seconds}s)")
            await send_status_to_room("Tempo esgotado! Encerrando sessao...")
            # Farewell message before shutting down
            try:
                session.say("Foi otimo conversar com voce! Obrigado pelo seu tempo.")
            except Exception as e:
                logger.warning(f"Failed to say farewell: {e}")
            # Drain pending speech then shutdown
            try:
                session.shutdown(drain=True)
            except Exception as e:
                logger.warning(f"Failed to drain session on timeout: {e}")
                logger.warning(
                    f"SHUTDOWN_TRIGGER: source='timeout_drain_fail', "
                    f"elapsed={time.time() - _session_start_time:.1f}s, "
                    f"lines={len(transcript_lines)}, "
                    f"greeting={_greeting_received}, "
                    f"participants={len(ctx.room.remote_participants)}"
                )
                shutdown_event.set()
        except asyncio.CancelledError:
            logger.debug("Timeout task cancelled")

    # Listen for room disconnect
    @ctx.room.on("disconnected")
    def on_room_disconnected():
        logger.warning(
            f"SHUTDOWN_TRIGGER: source='room_disconnected', "
            f"elapsed={time.time() - _session_start_time:.1f}s, "
            f"lines={len(transcript_lines)}, "
            f"greeting={_greeting_received}, "
            f"participants={len(ctx.room.remote_participants)}"
        )
        if timeout_task and not timeout_task.done():
            timeout_task.cancel()
        shutdown_event.set()

    # Diagnostic: track participant disconnections
    @ctx.room.on("participant_disconnected")
    def on_participant_left(participant):
        logger.warning(
            f"DIAG: Participant left: {participant.identity}, "
            f"remaining={len(ctx.room.remote_participants)}, "
            f"elapsed={time.time() - _session_start_time:.1f}s"
        )

    try:
        # Send initial status
        await send_status_to_room("Iniciando sessao...")

        # Reset emotion history for fresh session
        reset_emotion_history()

        # Verify GOOGLE_API_KEY for AI Coach (early warning)
        if coaching_enabled:
            google_key = os.getenv("GOOGLE_API_KEY")
            if not google_key:
                logger.error("GOOGLE_API_KEY not set - AI Coach suggestions will be disabled")
            else:
                logger.info(f"GOOGLE_API_KEY configured (length: {len(google_key)} chars)")

        # Initialize coaching engine (keyword-based) - only in training mode
        if coaching_enabled:
            reset_coaching_engine()
            coaching = get_coaching_engine()
            coaching.start_session(scenario)

            # Initialize AI coach with scenario context, intensity, and learning profile
            reset_ai_coach()
            ai_coach = get_ai_coach()
            ai_coach.start_session(
                scenario_name=scenario.get('title', 'Cenario de vendas'),
                scenario_context=scenario.get('context', scenario.get('description', '')),
                avatar_profile=scenario.get('avatar_profile', scenario.get('avatar_persona', '')),
                expected_objections=scenario.get('expected_objections', ['preco', 'timing', 'necessidade']),
                objectives=scenario.get('coaching_objectives', []),
                intensity=coach_intensity,  # PRD 08, US-11
                learning_profile=learning_profile  # Cross-session learning
            )
            logger.info(f"AI Coach initialized with scenario context, intensity: {coach_intensity}, learning profile: {'loaded' if learning_profile else 'empty'}")

            # Send initial coaching state to frontend
            await send_coaching_state()
            logger.info("Initial coaching state sent to frontend")
        else:
            logger.info("Evaluation mode - coaching disabled")

        # Helper function to send avatar status to frontend
        async def send_avatar_status(status: str):
            """Send avatar status to frontend (connecting, ready, audio_only, failed)."""
            try:
                import json
                data = json.dumps({
                    "type": "avatar_status",
                    "status": status
                })
                await ctx.room.local_participant.publish_data(data.encode('utf-8'))
                logger.debug(f"Sent avatar status: {status}")
            except Exception as e:
                logger.warning(f"Failed to send avatar status: {e}")

        # Helper function to start avatar with timeout and retry
        async def start_avatar_with_timeout(av, sess, room):
            """Start avatar with timeout and retry logic."""
            if not av:
                return None

            max_attempts = 3
            base_timeout = 5.0  # Start with 5s, increase each attempt
            _avatar_load_start = _time_mod.time()

            await send_avatar_status("connecting")

            for attempt in range(max_attempts):
                timeout = base_timeout + (attempt * 5.0)  # 5s, 10s, 15s
                try:
                    await asyncio.wait_for(av.start(sess, room=room), timeout=timeout)
                    logger.info(f"Avatar started successfully on attempt {attempt + 1}")
                    _avatar_load_ms = (_time_mod.time() - _avatar_load_start) * 1000
                    await send_avatar_status("ready")
                    asyncio.create_task(send_latency_event("avatar_load", _avatar_load_ms, "Avatar Load", f"{avatar_provider}, attempt {attempt + 1}/{max_attempts}"))
                    return av
                except asyncio.TimeoutError:
                    logger.warning(f"Avatar timeout attempt {attempt + 1}/{max_attempts} (timeout={timeout}s)")
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(2.0)  # Backoff before retry
                except Exception as e:
                    logger.error(f"Avatar error attempt {attempt + 1}/{max_attempts}: {e}")
                    break  # Don't retry on non-timeout errors

            # All attempts failed - notify frontend
            logger.error(f"Avatar failed after {max_attempts} attempts - continuing with audio only")
            await send_avatar_status("audio_only")
            await send_status_to_room("Avatar indisponível - continuando com áudio")
            return None

        # Start session and avatar in PARALLEL for faster initialization
        logger.info("Starting session and avatar in parallel...")
        await send_status_to_room("Iniciando sessao...")

        # Start session (must be awaited!)
        # Start avatar BEFORE session (official LiveKit pattern from examples/avatars/hedra/)
        if avatar:
            await send_status_to_room("Iniciando avatar...")
            avatar_result = await start_avatar_with_timeout(avatar, session, ctx.room)
            if avatar_result:
                metrics.start_avatar(provider=avatar_provider)
            else:
                avatar = None  # Disable avatar if failed
                avatar_failed = True  # PRD 08: Track avatar failure
                logger.info("Avatar failed flag set - will be recorded in session")

        # ── Register session event handlers BEFORE session.start() ──
        # CRITICAL: These must be registered before session.start() to avoid
        # race condition where session closes before handlers are attached,
        # causing shutdown_event to never be set (agent process leak).

        _inactivity_task: asyncio.Task | None = None

        async def _user_presence_pings():
            """Ping inactive user twice, then shutdown if no response."""
            prompts_ptbr = [
                "Esta tudo bem? Quer continuar com o roleplay?",
                "Se quiser, podemos retomar. Estou aqui.",
            ]
            for prompt in prompts_ptbr:
                try:
                    session.generate_reply(
                        instructions=f"Diga ao usuario exatamente: '{prompt}'"
                    )
                except Exception as e:
                    logger.warning(f"Inactivity ping failed: {e}")
                await asyncio.sleep(30)
            # No response after 2 pings (60s total since away) — graceful shutdown
            logger.info("User unresponsive after inactivity pings — shutting down")
            await send_status_to_room("Encerrando por inatividade...")
            try:
                session.shutdown(drain=True)
            except Exception as e:
                logger.warning(f"Inactivity shutdown failed: {e}")
                shutdown_event.set()

        @session.on("close")
        def on_session_close():
            _elapsed = time.time() - _session_start_time
            logger.warning(
                f"SHUTDOWN_TRIGGER: source='session_close', "
                f"elapsed={_elapsed:.1f}s, "
                f"lines={len(transcript_lines)}, "
                f"greeting={_greeting_received}, "
                f"participants={len(ctx.room.remote_participants)}"
            )

            # Schedule final transcript save (fire-and-forget)
            async def _final_cleanup():
                try:
                    if transcript_lines and session_id:
                        await save_intermediate_transcript(
                            session_id, transcript_lines, status="completed"
                        )
                        logger.info(f"Final transcript saved on close: {len(transcript_lines)} lines")
                except Exception as e:
                    logger.warning(f"Final transcript save on close failed: {e}")

            asyncio.create_task(_final_cleanup())

            if not shutdown_event.is_set():
                shutdown_event.set()

        @session.on("error")
        def on_session_error(ev):
            logger.error(
                f"DIAG: Session error: {ev}, "
                f"elapsed={time.time() - _session_start_time:.1f}s, "
                f"lines={len(transcript_lines)}"
            )

        @session.on("user_state_changed")
        def on_user_state_changed(ev: UserStateChangedEvent):
            nonlocal _inactivity_task
            if ev.new_state == "away":
                # Cancel any existing inactivity task before creating new one
                if _inactivity_task and not _inactivity_task.done():
                    _inactivity_task.cancel()
                logger.info("User went away — starting inactivity pings")
                _inactivity_task = asyncio.create_task(_user_presence_pings())
            elif _inactivity_task is not None:
                # User came back — cancel inactivity flow
                logger.info(f"User returned (state={ev.new_state}) — cancelling inactivity pings")
                _inactivity_task.cancel()
                _inactivity_task = None

        logger.info("Session event handlers registered (close, error, user_state_changed)")

        # Use EmotionStrippingAgent in half-cascade mode to remove [tag] before TTS
        agent_cls = EmotionStrippingAgent if use_elevenlabs else Agent
        await session.start(
            room=ctx.room,
            agent=agent_cls(instructions=full_instructions),
            room_options=room_io.RoomOptions(
                audio_input=True,
                video_input=False,
                close_on_disconnect=False,
            ),
        )
        logger.info("Session started successfully")
        logger.info(f"Event handlers registered: user_input_transcribed, conversation_item_added")
        logger.info(f"Transcript collection initialized, current lines: {len(transcript_lines)}")

        # Start metrics collection
        metrics.start_session()

        await send_status_to_room("Conectado! Aguardando...")

        # Start periodic transcript save task (prevents data loss on crash)
        transcript_save_task: asyncio.Task | None = None

        async def periodic_transcript_save():
            """Save transcript every 30 seconds to prevent data loss on crash."""
            while not shutdown_event.is_set():
                try:
                    await asyncio.sleep(30)  # Save every 30 seconds
                    if transcript_lines and session_id:
                        await save_intermediate_transcript(session_id, transcript_lines)
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning(f"Periodic transcript save failed: {e}")

        transcript_save_task = asyncio.create_task(periodic_transcript_save())
        logger.info("Periodic transcript save enabled (every 30s)")

        # Heartbeat loop for diagnostics (frontend/test script can detect agent death)
        async def heartbeat_loop():
            """Send periodic heartbeat via data channel."""
            import json as _hb_json
            _hb_failures = 0
            while not shutdown_event.is_set():
                try:
                    hb_data = _hb_json.dumps({
                        "type": "heartbeat",
                        "ts": time.time(),
                        "elapsed": round(time.time() - _session_start_time, 1),
                        "lines": len(transcript_lines),
                        "greeting": _greeting_received
                    })
                    await ctx.room.local_participant.publish_data(hb_data.encode('utf-8'))
                    _hb_failures = 0
                except Exception as e:
                    _hb_failures += 1
                    if _hb_failures >= 3:
                        logger.warning(f"Heartbeat stopping after 3 failures: {e}")
                        break
                await asyncio.sleep(5)

        asyncio.create_task(heartbeat_loop())
        logger.info("Heartbeat loop started (every 5s)")

        # Trigger greeting immediately (no delay needed)
        try:
            logger.info("Triggering greeting...")
            await send_status_to_room("Avatar iniciando...")
            _greeting_trigger_time = _time_mod.time()
            session.generate_reply(user_input="Ola, estou pronto para comecar")
            logger.info("Greeting triggered successfully")
        except Exception as e:
            logger.warning(f"Failed to trigger greeting: {e}")

        # Start timeout AFTER greeting (so greeting doesn't eat into conversation time)
        timeout_task = asyncio.create_task(session_timeout())
        logger.info(f"Session timeout started: {session_timeout_seconds}s (after greeting)")

        # Generate initial coach suggestion proactively (no delay) - only in training mode
        if coaching_enabled:
            async def generate_initial_coach_suggestion():
                """Generate and send initial coach suggestion when session starts."""
                # REMOVED: await asyncio.sleep(2) - no delay needed
                try:
                    suggestion = await ai_coach.generate_initial_suggestion()
                    if suggestion:
                        await send_ai_suggestion(suggestion)
                        logger.info(f"Initial coach suggestion sent: {suggestion.title}")
                    else:
                        logger.warning("Coach: No initial suggestion generated")
                except Exception as e:
                    logger.error(f"Coach: Failed to generate initial suggestion: {e}")

            asyncio.create_task(generate_initial_coach_suggestion())

        # Start proactive coach watchdog (Layer 2: silence detection)
        if coaching_enabled:
            async def _on_silence_detected():
                """Called by ConversationCoach when user is silent > stuck_timeout."""
                nudge = proactive_coach.get_silence_nudge()
                hint = CoachingHint(
                    id=f"proactive_silence_{int(time.time())}",
                    type=HintType.SUGGESTION,
                    title="Retome a conversa",
                    message=nudge.text,
                    priority=2,
                )
                await send_coaching_hint(hint)
                logger.info(f"Proactive silence nudge sent: {nudge.text}")

            # Reset timer so watchdog counts from NOW (not from ConversationCoach.__init__)
            proactive_coach.reset_timer()
            _silence_guard_resets = 0
            _MAX_SILENCE_GUARD_RESETS = 6  # ~60s of resets before giving up

            async def _on_silence_detected_guarded():
                """Only fire silence nudge after greeting has been received."""
                nonlocal _silence_guard_resets
                if not _greeting_received:
                    _silence_guard_resets += 1
                    if _silence_guard_resets >= _MAX_SILENCE_GUARD_RESETS:
                        logger.warning("Silence watchdog: max guard resets reached, stopping")
                        proactive_coach.stop()
                        return
                    # Still waiting for greeting — reset and skip
                    proactive_coach.reset_timer()
                    return
                await _on_silence_detected()

            proactive_coach.start_watchdog(_on_silence_detected_guarded)

        await send_status_to_room("Ouvindo...")
        logger.info("Session ready and listening")

        # Keep the session running until room disconnects
        await shutdown_event.wait()

    except Exception as e:
        logger.error(
            f"SHUTDOWN_TRIGGER: source='exception', error='{e}', "
            f"elapsed={time.time() - _session_start_time:.1f}s, "
            f"lines={len(transcript_lines)}, "
            f"greeting={_greeting_received}",
            exc_info=True
        )
        await send_status_to_room(f"Erro: {str(e)}")
        raise

    finally:
        # Guaranteed cleanup — runs on normal shutdown, exceptions, and cancellation
        # Each step is individually wrapped to ensure later steps still execute
        logger.info("Entering finally cleanup block...")

        # Cancel background tasks (individually wrapped)
        try:
            if transcript_save_task and not transcript_save_task.done():
                transcript_save_task.cancel()
        except Exception as e:
            logger.warning(f"Finally: transcript task cancel failed: {e}")

        try:
            if _inactivity_task and not _inactivity_task.done():
                _inactivity_task.cancel()
        except Exception as e:
            logger.warning(f"Finally: inactivity task cancel failed: {e}")

        try:
            proactive_coach.stop()  # Stop silence watchdog
        except Exception as e:
            logger.warning(f"Finally: proactive coach stop failed: {e}")

        # Final transcript save with 'completed' status (belt-and-suspenders with close handler)
        try:
            if transcript_lines and session_id:
                await save_intermediate_transcript(
                    session_id, transcript_lines, status="completed"
                )
                logger.info(f"Finally: final transcript saved ({len(transcript_lines)} lines)")
        except Exception as e:
            logger.warning(f"Finally: transcript save failed: {e}")

        _total_elapsed = time.time() - _session_start_time
        logger.info(
            f"Session cleanup complete: elapsed={_total_elapsed:.1f}s, "
            f"lines={len(transcript_lines)}, greeting={_greeting_received}"
        )


if __name__ == "__main__":
    # Agent name for explicit dispatch - agents with a name require
    # explicit dispatch via token or API
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="roleplay-agent",  # Named agent for explicit dispatch
        shutdown_process_timeout=90,  # Extra time for farewell + drain + transcript save
    ))
