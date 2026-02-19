"""
Agent startup time benchmark test.

Measures the time between joining a LiveKit room and receiving the
first byte of audio from the agent's greeting. This includes:
    - Agent detecting the new participant
    - Loading scenario from Supabase
    - Building dynamic prompt via prompts.py
    - Initializing OpenAI Realtime session
    - Generating first greeting via TTS
    - (Optional) Hedra avatar initialization

A long startup time leads to awkward silence when the user enters
the room, degrading the experience.

Test procedure:
    1. Create a new LiveKit room (or use existing test room)
    2. Record timestamp at room join
    3. Wait for first audio track from agent
    4. Record timestamp at first audio byte
    5. Calculate startup_time = first_audio - room_join
    6. Repeat 3 times to account for cold/warm starts
    7. Assert mean < 10000ms

Requirements:
    - Live agent running (openai_realtime or pipecat_modular)
    - LiveKit room accessible
    - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET env vars set
    - Test scenario available in Supabase
"""
import pytest
import statistics
from conftest import save_result

pytestmark = pytest.mark.skip(
    reason="Requires live agent and LiveKit room. Run with --run-live to enable."
)

NUM_REPETITIONS = 3
MAX_MEAN_STARTUP_MS = 10000


def test_startup_time(agent_type, results_dir):
    """
    Measure time from room join to first agent audio.

    Pseudocode:
        startup_times = []

        for i in range(NUM_REPETITIONS):
            room = create_livekit_room(f"benchmark-startup-{i}")
            token = create_livekit_token(room, scenario_id="benchmark")

            join_time = time.monotonic()
            participant = join_room(room, token)

            # Wait for agent to publish audio track
            agent_track = wait_for_agent_audio_track(room, timeout=15000)
            first_audio_time = time.monotonic()

            startup_ms = (first_audio_time - join_time) * 1000
            startup_times.append(startup_ms)

            leave_room(room)
            cleanup_room(room)

            # Wait between repetitions to avoid resource contention
            time.sleep(2)

        mean_startup = statistics.mean(startup_times)

        save_result("startup_time", agent_type, {
            "repetitions": NUM_REPETITIONS,
            "startup_times_ms": startup_times,
            "mean_ms": mean_startup,
            "max_ms": max(startup_times),
            "min_ms": min(startup_times),
            "includes_cold_start": True,
        }, results_dir)

        assert mean_startup < MAX_MEAN_STARTUP_MS
    """
    pass
