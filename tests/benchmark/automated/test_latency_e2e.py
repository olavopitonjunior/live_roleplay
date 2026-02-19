"""
End-to-end latency benchmark test.

Measures the time between the end of user speech and the first byte
of agent audio response. This is the most critical metric for
conversational UX — high latency breaks the illusion of real-time
conversation.

Test procedure:
    1. Connect to a LiveKit room with the agent
    2. Wait for the agent greeting to complete
    3. Send a reference audio phrase (from fixtures/reference_phrases.txt)
    4. Measure: user_speech_end → agent_first_audio_byte
    5. Repeat 5 times with different phrases
    6. Calculate mean and p95 latency
    7. Assert mean < 1500ms (target for natural conversation)

Requirements:
    - Live agent running (openai_realtime or pipecat_modular)
    - LiveKit room accessible
    - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET env vars set
    - Audio fixtures available in fixtures/reference_phrases.txt
"""
import pytest
import statistics
from pathlib import Path
from conftest import save_result

pytestmark = pytest.mark.skip(
    reason="Requires live agent and LiveKit room. Run with --run-live to enable."
)

NUM_REPETITIONS = 5
MAX_MEAN_LATENCY_MS = 1500
MAX_P95_LATENCY_MS = 2500


def test_latency_e2e(agent_type, results_dir, fixtures_dir):
    """
    Measure end-to-end voice latency across multiple turns.

    Pseudocode:
        latencies = []
        room = connect_to_livekit_room()
        wait_for_agent_greeting(room)

        for i in range(NUM_REPETITIONS):
            phrase = load_reference_phrase(fixtures_dir, i)
            audio = text_to_speech(phrase)  # Pre-recorded or TTS

            start_time = time.monotonic()
            send_audio_to_room(room, audio)
            wait_for_user_speech_end(room)  # VAD detects end of speech
            speech_end_time = time.monotonic()

            first_audio_byte = wait_for_agent_audio(room)
            latency_ms = (first_audio_byte - speech_end_time) * 1000
            latencies.append(latency_ms)

        mean_latency = statistics.mean(latencies)
        p95_latency = sorted(latencies)[int(0.95 * len(latencies))]

        save_result("latency_e2e", agent_type, {
            "repetitions": NUM_REPETITIONS,
            "latencies_ms": latencies,
            "mean_ms": mean_latency,
            "p95_ms": p95_latency,
            "max_ms": max(latencies),
            "min_ms": min(latencies),
        }, results_dir)

        assert mean_latency < MAX_MEAN_LATENCY_MS
        assert p95_latency < MAX_P95_LATENCY_MS
    """
    pass
