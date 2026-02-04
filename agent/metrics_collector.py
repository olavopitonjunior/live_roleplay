"""
Metrics Collector Module

Collects API usage metrics during roleplay sessions for cost monitoring.
Tracks usage of Gemini Live, Gemini Flash, Simli, and LiveKit.
"""

import os
import logging
import aiohttp
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Cost constants (USD cents per unit)
# Prices as of 2025 - update as needed
COSTS = {
    # Gemini Live: $0.025/1K input, $0.10/1K output tokens
    "gemini_live_input_per_1k": 2.5,  # cents
    "gemini_live_output_per_1k": 10.0,  # cents
    # Gemini Flash: $0.0075/1K input, $0.03/1K output tokens
    "gemini_flash_input_per_1k": 0.75,  # cents
    "gemini_flash_output_per_1k": 3.0,  # cents
    # Claude Sonnet: $3/1M input, $15/1M output tokens
    "claude_input_per_1m": 300,  # cents
    "claude_output_per_1m": 1500,  # cents
    # LiveKit: ~$0.004/minute
    "livekit_per_minute": 0.4,  # cents
}

# Avatar provider costs (USD cents per minute)
# Update with actual pricing as providers change rates
AVATAR_COSTS = {
    "simli": 2.0,       # ~$0.02/min - Simli API
    "hedra": 1.5,       # ~$0.015/min - Hedra (estimate, verify actual pricing)
    "liveavatar": 1.0,  # ~$0.01/min - LiveAvatar (estimate, verify actual pricing)
    "unknown": 2.0,     # Fallback to Simli pricing
}


@dataclass
class MetricsCollector:
    """
    Collects and aggregates API usage metrics during a session.

    Usage:
        metrics = MetricsCollector(session_id)
        metrics.start_session()

        # During session:
        metrics.add_gemini_live_tokens(input_tokens, output_tokens)
        metrics.record_gemini_flash_call(input_tokens, output_tokens)

        # At end:
        await metrics.save_to_database()
    """

    session_id: str

    # Gemini Live metrics
    gemini_live_input_tokens: int = 0
    gemini_live_output_tokens: int = 0
    gemini_live_start_time: Optional[datetime] = None

    # Gemini Flash metrics
    gemini_flash_calls: int = 0
    gemini_flash_input_tokens: int = 0
    gemini_flash_output_tokens: int = 0

    # Avatar metrics (generic - supports Simli/Hedra/LiveAvatar)
    avatar_start_time: Optional[datetime] = None
    avatar_provider: str = "unknown"

    # Legacy alias for backwards compatibility
    simli_start_time: Optional[datetime] = None

    # LiveKit metrics
    livekit_start_time: Optional[datetime] = None

    def start_session(self) -> None:
        """Mark the start of a session for duration tracking."""
        now = datetime.now(timezone.utc)
        self.gemini_live_start_time = now
        self.livekit_start_time = now
        logger.info(f"Metrics collection started for session {self.session_id}")

    def start_avatar(self, provider: str = "simli") -> None:
        """Mark when the avatar starts and record the provider."""
        now = datetime.now(timezone.utc)
        self.avatar_start_time = now
        self.avatar_provider = provider
        # Keep simli_start_time for backwards compatibility
        self.simli_start_time = now
        logger.debug(f"Avatar metrics tracking started: provider={provider}")

    def add_gemini_live_tokens(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        """Add tokens from Gemini Live API usage."""
        self.gemini_live_input_tokens += input_tokens
        self.gemini_live_output_tokens += output_tokens

    def record_gemini_flash_call(self, input_tokens: int, output_tokens: int) -> None:
        """Record a Gemini Flash API call (emotion analysis)."""
        self.gemini_flash_calls += 1
        self.gemini_flash_input_tokens += input_tokens
        self.gemini_flash_output_tokens += output_tokens

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Estimate token count from text.

        Approximation: ~4 characters per token for Portuguese text.
        This is a rough estimate since we don't have direct token counting.
        """
        if not text:
            return 0
        return max(1, len(text) // 4)

    def get_gemini_live_duration(self) -> float:
        """Get Gemini Live session duration in seconds."""
        if not self.gemini_live_start_time:
            return 0.0
        now = datetime.now(timezone.utc)
        return (now - self.gemini_live_start_time).total_seconds()

    def get_avatar_duration(self) -> float:
        """Get avatar duration in seconds (generic for any provider)."""
        if not self.avatar_start_time:
            return 0.0
        now = datetime.now(timezone.utc)
        return (now - self.avatar_start_time).total_seconds()

    def get_simli_duration(self) -> float:
        """Get avatar duration in seconds (legacy alias for backwards compatibility)."""
        return self.get_avatar_duration()

    def get_livekit_minutes(self) -> float:
        """Get LiveKit usage in participant-minutes (2 participants)."""
        if not self.livekit_start_time:
            return 0.0
        now = datetime.now(timezone.utc)
        duration_minutes = (now - self.livekit_start_time).total_seconds() / 60
        # 2 participants: user + agent
        return duration_minutes * 2

    def calculate_cost_cents(self) -> int:
        """Calculate estimated total cost in USD cents."""
        cost = 0.0

        # Gemini Live cost
        cost += (self.gemini_live_input_tokens / 1000) * COSTS["gemini_live_input_per_1k"]
        cost += (self.gemini_live_output_tokens / 1000) * COSTS["gemini_live_output_per_1k"]

        # Gemini Flash cost
        cost += (self.gemini_flash_input_tokens / 1000) * COSTS["gemini_flash_input_per_1k"]
        cost += (self.gemini_flash_output_tokens / 1000) * COSTS["gemini_flash_output_per_1k"]

        # Avatar cost (provider-specific pricing)
        avatar_minutes = self.get_avatar_duration() / 60
        avatar_rate = AVATAR_COSTS.get(self.avatar_provider, AVATAR_COSTS["unknown"])
        cost += avatar_minutes * avatar_rate

        # LiveKit cost (participant-minutes)
        cost += self.get_livekit_minutes() * COSTS["livekit_per_minute"]

        return round(cost)

    def get_metrics_summary(self) -> dict:
        """Get a summary of all collected metrics."""
        avatar_duration = round(self.get_avatar_duration(), 2)
        return {
            "session_id": self.session_id,
            "gemini_live_input_tokens": self.gemini_live_input_tokens,
            "gemini_live_output_tokens": self.gemini_live_output_tokens,
            "gemini_live_duration_seconds": round(self.get_gemini_live_duration(), 2),
            "gemini_flash_calls": self.gemini_flash_calls,
            "gemini_flash_input_tokens": self.gemini_flash_input_tokens,
            "gemini_flash_output_tokens": self.gemini_flash_output_tokens,
            # New generic avatar fields
            "avatar_duration_seconds": avatar_duration,
            "avatar_provider": self.avatar_provider,
            # Legacy field for backwards compatibility
            "simli_duration_seconds": avatar_duration,
            "livekit_participant_minutes": round(self.get_livekit_minutes(), 2),
            "estimated_cost_cents": self.calculate_cost_cents(),
        }

    async def save_to_database(self) -> bool:
        """
        Save metrics to Supabase database.

        Returns:
            True if successful, False otherwise.
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            logger.warning("Supabase not configured, skipping metrics save")
            return False

        metrics = self.get_metrics_summary()

        # Remove session_id from payload (it's used in the insert)
        payload = {k: v for k, v in metrics.items() if k != "session_id"}
        payload["session_id"] = self.session_id

        try:
            async with aiohttp.ClientSession() as http:
                url = f"{SUPABASE_URL}/rest/v1/api_metrics"
                headers = {
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }

                async with http.post(url, json=payload, headers=headers) as resp:
                    if resp.status in (200, 201, 204):
                        logger.info(f"Metrics saved for session {self.session_id}: ${metrics['estimated_cost_cents']/100:.4f}")
                        return True
                    else:
                        error_text = await resp.text()
                        logger.error(f"Failed to save metrics: {resp.status} - {error_text}")
                        return False

        except Exception as e:
            logger.error(f"Error saving metrics: {e}")
            return False

    async def update_claude_tokens(self, input_tokens: int, output_tokens: int) -> bool:
        """
        Update Claude token counts in the database.
        Called from Edge Function after feedback generation.

        Note: This is typically called by the Edge Function directly,
        but provided here for completeness.
        """
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            return False

        try:
            async with aiohttp.ClientSession() as http:
                url = f"{SUPABASE_URL}/rest/v1/api_metrics?session_id=eq.{self.session_id}"
                headers = {
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal",
                }

                payload = {
                    "claude_input_tokens": input_tokens,
                    "claude_output_tokens": output_tokens,
                }

                async with http.patch(url, json=payload, headers=headers) as resp:
                    return resp.status in (200, 204)

        except Exception as e:
            logger.error(f"Error updating Claude tokens: {e}")
            return False


# Singleton instance management
_collectors: dict[str, MetricsCollector] = {}


def get_metrics_collector(session_id: str) -> MetricsCollector:
    """Get or create a MetricsCollector for a session."""
    if session_id not in _collectors:
        _collectors[session_id] = MetricsCollector(session_id=session_id)
    return _collectors[session_id]


def remove_metrics_collector(session_id: str) -> None:
    """Remove a MetricsCollector after session ends."""
    _collectors.pop(session_id, None)
