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
    WorkerOptions,
    cli,
    room_io,
)
from livekit.plugins import google, silero, simli

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
from coaching import get_coaching_engine, reset_coaching_engine, CoachingHint
from ai_coach import get_ai_coach, reset_ai_coach, AISuggestion

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

# Lista de avatares Hedra disponíveis para seleção aleatória
HEDRA_AVATAR_IDS = [
    "a962cefb-57f3-4ed8-acd9-7260eef703b1",
    "f47a3167-01f8-45a3-b72e-7c36fa097e98",
    "0a1c73e8-887d-4cfe-84f4-4ec11d087e45",
]


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
        "ended_at": "now()",
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
                    logger.warning(f"Feedback generation returned {response.status}")
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


def detect_session_end(text: str) -> bool:
    """
    Detect if user wants to end the session based on their message.
    Returns True if session should end.
    """
    text_lower = text.lower()

    end_keywords = [
        "tchau", "adeus", "ate logo", "ate mais", "obrigado", "obrigada",
        "muito obrigado", "muito obrigada", "foi um prazer", "encerramos",
        "vamos encerrar", "pode encerrar", "finalizamos", "finalizar",
        "era isso", "e isso", "por hoje e so", "vou nessa", "falou"
    ]

    return any(kw in text_lower for kw in end_keywords)


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

    provider = scenario.get('avatar_provider', 'simli')
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

    # Create agent session with Gemini Live API and optimized VAD
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            voice=voice,  # Dynamic: Puck, Charon, Kore, Fenrir, Aoede
            temperature=0.6,  # Lower for faster, more focused responses
            instructions=full_instructions,
        ),
        vad=silero.VAD.load(
            min_speech_duration=0.1,  # Detect shorter speech
            min_silence_duration=0.2,  # Respond faster after silence (reduced from 0.3)
        ),
    )

    # Transcript collection
    transcript_lines: list[str] = []

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
        await asyncio.sleep(1)
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
                # Add timestamped line to transcript
                transcript_lines.append(format_transcript_line("Usuario", text))
                logger.info(f"Added user line to transcript, total lines: {len(transcript_lines)}")
                # Check for early session end
                if detect_session_end(text) and not early_end_triggered:
                    early_end_triggered = True
                    logger.info("User requested session end, will terminate after response")
                    asyncio.create_task(handle_early_end())

                # Analyze user message for coaching hints (keyword-based) - only in training mode
                if coaching_enabled:
                    async def analyze_user_coaching():
                        try:
                            coaching = get_coaching_engine()
                            hints = coaching.analyze_user_message(text)
                            for hint in hints:
                                await send_coaching_hint(hint)
                            # Send updated state periodically
                            await send_coaching_state()
                        except Exception as e:
                            logger.warning(f"Coaching analysis failed: {e}")

                    asyncio.create_task(analyze_user_coaching())

                    # AI Coach final analysis for specific suggestions
                    async def analyze_user_ai_coach():
                        try:
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
                            if suggestion:
                                await send_ai_suggestion(suggestion)
                                # Track Gemini Flash call for AI coaching
                                metrics.record_gemini_flash_call(input_tokens=200, output_tokens=50)
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
                # Add timestamped line to transcript
                transcript_lines.append(format_transcript_line("Avatar", text))
                logger.info(f"Avatar said: {text[:100]}... (added to transcript, total lines: {len(transcript_lines)})")

                # Track output tokens for metrics
                output_tokens = metrics.estimate_tokens(text)
                metrics.add_gemini_live_tokens(output_tokens=output_tokens)

                # Send to frontend
                asyncio.create_task(send_transcription_to_room("avatar", text))
                asyncio.create_task(send_status_to_room("Ouvindo..."))

                # Analyze CLIENT (avatar) emotion using AI with fallback
                # This reflects how satisfied the client is with the user's approach
                # Now includes intensity (0-100) and trend for smoother UI updates
                async def analyze_and_send_emotion():
                    try:
                        result = await analyze_emotion_with_intensity(text, transcript_lines)
                        await send_emotion_to_room(
                            result["state"],
                            result["intensity"],
                            result["trend"],
                            result.get("reason")  # Include reason if state changed
                        )
                        # Track Gemini Flash call for emotion analysis
                        # Estimate: prompt ~100 tokens, response ~5 tokens
                        metrics.record_gemini_flash_call(input_tokens=100, output_tokens=5)
                    except Exception as e:
                        logger.warning(f"AI emotion analysis failed, using fallback: {e}")
                        emotion = analyze_emotion_sync(text)
                        await send_emotion_to_room(emotion)

                asyncio.create_task(analyze_and_send_emotion())

                # Analyze avatar message for coaching (objection detection) - only in training mode
                if coaching_enabled:
                    async def analyze_avatar_coaching():
                        try:
                            coaching = get_coaching_engine()
                            hints = coaching.analyze_avatar_message(text)
                            for hint in hints:
                                await send_coaching_hint(hint)
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
                            suggestion = await ai_coach.analyze_final(text, "avatar")
                            if suggestion:
                                await send_ai_suggestion(suggestion)
                                # Track Gemini Flash call
                                metrics.record_gemini_flash_call(input_tokens=200, output_tokens=50)
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

            await trigger_feedback_generation(session_id)
            logger.info("Feedback generation triggered")
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
    session_timeout_seconds = scenario.get('duration_max_seconds', 180)
    logger.info(f"Session timeout configured: {session_timeout_seconds}s (from scenario)")
    timeout_task: asyncio.Task | None = None

    async def session_timeout():
        """End session after timeout period."""
        try:
            await asyncio.sleep(session_timeout_seconds)
            logger.info(f"Session timeout reached ({session_timeout_seconds}s)")
            await send_status_to_room("Tempo esgotado! Encerrando sessao...")
            # Give time for the message to be sent
            await asyncio.sleep(1)
            shutdown_event.set()
        except asyncio.CancelledError:
            logger.debug("Timeout task cancelled")

    # Listen for room disconnect
    @ctx.room.on("disconnected")
    def on_room_disconnected():
        logger.info("Room disconnected, shutting down")
        if timeout_task and not timeout_task.done():
            timeout_task.cancel()
        shutdown_event.set()

    try:
        # Send initial status
        await send_status_to_room("Iniciando sessao...")

        # Reset emotion history for fresh session
        reset_emotion_history()

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

            await send_avatar_status("connecting")

            for attempt in range(max_attempts):
                timeout = base_timeout + (attempt * 5.0)  # 5s, 10s, 15s
                try:
                    await asyncio.wait_for(av.start(sess, room=room), timeout=timeout)
                    logger.info(f"Avatar started successfully on attempt {attempt + 1}")
                    await send_avatar_status("ready")
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
        await session.start(
            room=ctx.room,
            agent=Agent(instructions=full_instructions),
            room_input_options=room_io.RoomInputOptions(
                audio_enabled=True,
                video_enabled=False,
                close_on_disconnect=False,
            ),
        )
        logger.info("Session started successfully")
        logger.info(f"Event handlers registered: user_input_transcribed, conversation_item_added")
        logger.info(f"Transcript collection initialized, current lines: {len(transcript_lines)}")

        # Start metrics collection
        metrics.start_session()

        # Start avatar in parallel (with timeout)
        if avatar:
            await send_status_to_room("Iniciando avatar...")
            avatar_result = await start_avatar_with_timeout(avatar, session, ctx.room)
            if avatar_result:
                metrics.start_avatar()
            else:
                avatar = None  # Disable avatar if failed
                avatar_failed = True  # PRD 08: Track avatar failure
                logger.info("Avatar failed flag set - will be recorded in session")

        await send_status_to_room("Conectado! Aguardando...")

        # Start the session timeout timer
        timeout_task = asyncio.create_task(session_timeout())
        logger.info(f"Session timeout started: {session_timeout_seconds} seconds")

        # Trigger greeting immediately (no delay needed)
        try:
            logger.info("Triggering greeting...")
            await send_status_to_room("Avatar iniciando...")
            session.generate_reply(user_input="Ola, estou pronto para comecar")
            logger.info("Greeting triggered successfully")
        except Exception as e:
            logger.warning(f"Failed to trigger greeting: {e}")

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

        await send_status_to_room("Ouvindo...")
        logger.info("Session ready and listening")

        # Keep the session running until room disconnects
        await shutdown_event.wait()

    except Exception as e:
        logger.error(f"Session error: {e}")
        await send_status_to_room(f"Erro: {str(e)}")
        raise


if __name__ == "__main__":
    # Agent name for explicit dispatch - agents with a name require
    # explicit dispatch via token or API
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="roleplay-agent",  # Named agent for explicit dispatch
    ))
