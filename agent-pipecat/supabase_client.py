"""
Supabase REST client for the Pipecat PoC agent.

Fetches scenarios and updates session status using the same
Supabase project as the main agent.
"""

import os
import logging

import aiohttp

logger = logging.getLogger(__name__)


def _get_config() -> tuple[str, str]:
    """Read Supabase config lazily (after dotenv is loaded)."""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    return url, key


def _headers() -> dict[str, str]:
    _, key = _get_config()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def fetch_scenario(scenario_id: str) -> dict:
    """Fetch a scenario by ID from Supabase."""
    base_url, _ = _get_config()
    url = f"{base_url}/rest/v1/scenarios?id=eq.{scenario_id}&select=*"
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=_headers()) as resp:
            if resp.status != 200:
                raise ValueError(f"Supabase error {resp.status}: {await resp.text()}")
            data = await resp.json()
            if not data:
                raise ValueError(f"Scenario {scenario_id} not found")
            logger.info(f"Fetched scenario: {data[0].get('title', scenario_id)}")
            return data[0]


async def save_transcript(session_id: str, transcript: list[dict]) -> None:
    """Save session transcript to Supabase."""
    import json

    base_url, _ = _get_config()
    url = f"{base_url}/rest/v1/sessions?id=eq.{session_id}"
    headers = _headers()
    headers["Prefer"] = "return=minimal"
    payload = {"transcript": json.dumps(transcript)}
    async with aiohttp.ClientSession() as session:
        async with session.patch(url, headers=headers, json=payload) as resp:
            if resp.status == 204:
                logger.info(f"Transcript saved for session {session_id}")
            else:
                logger.error(f"Failed to save transcript: {resp.status}")


async def update_session_status(session_id: str, status: str) -> None:
    """Update session status in Supabase."""
    base_url, _ = _get_config()
    url = f"{base_url}/rest/v1/sessions?id=eq.{session_id}"
    headers = _headers()
    headers["Prefer"] = "return=minimal"
    async with aiohttp.ClientSession() as session:
        async with session.patch(url, headers=headers, json={"status": status}) as resp:
            if resp.status == 204:
                logger.info(f"Session {session_id} status → {status}")
            else:
                logger.error(f"Failed to update session status: {resp.status}")
