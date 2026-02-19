"""
Role stability benchmark test (semi-automatic).

Tests the agent's ability to maintain its character (CLIENT/PROSPECT)
when the user sends provocative inputs that historically caused role
inversion. This was a critical bug fixed in 2026-02-14.

The test uses provocative inputs from fixtures/provocative_inputs.txt
and analyzes the agent's transcript with GPT-4o-mini to detect
any role inversion.

Test procedure:
    1. Load provocative inputs from fixtures/provocative_inputs.txt
    2. For each input, run a short session:
        a. Connect to LiveKit room with benchmark scenario
        b. Wait for agent greeting
        c. Send the provocative input as user speech
        d. Record agent's response (transcript)
    3. Analyze each response with GPT-4o-mini:
        - Did the agent stay in character as CLIENT?
        - Did the agent start acting as VENDOR/SUPPORT?
        - Did the agent offer solutions instead of requesting them?
    4. Report: number of inversions / total inputs
    5. Assert 0 inversions (100% stability)

Role inversion indicators (detected by GPT-4o-mini):
    - Agent starts asking "How can I help you?"
    - Agent offers products or solutions
    - Agent acts as the seller instead of buyer
    - Agent breaks character explicitly

Requirements:
    - Live agent running
    - LiveKit room accessible
    - OPENAI_API_KEY set (for GPT-4o-mini analysis)
    - fixtures/provocative_inputs.txt available
    - fixtures/scenario_retention.json for benchmark scenario
"""
import pytest
from pathlib import Path
from conftest import save_result

pytestmark = pytest.mark.skip(
    reason="Requires live agent and LiveKit room. "
           "Run with --run-live --run-semi-auto to enable."
)

NUM_SESSIONS_PER_INPUT = 2  # Run each provocative input N times for reliability


def test_role_stability(agent_type, results_dir, fixtures_dir):
    """
    Run sessions with provocative inputs and analyze for role inversion.

    Pseudocode:
        provocative_file = fixtures_dir / "provocative_inputs.txt"
        inputs = load_provocative_inputs(provocative_file)
        scenario = load_json(fixtures_dir / "scenario_retention.json")

        results = []
        inversions = 0

        for input_data in inputs:
            for attempt in range(NUM_SESSIONS_PER_INPUT):
                room = connect_to_livekit_room(scenario)
                wait_for_agent_greeting(room)

                # Send provocative input
                send_text_as_speech(room, input_data["text"])
                agent_response = wait_for_agent_response(room, timeout=10000)

                # Analyze with GPT-4o-mini
                analysis = analyze_role_stability(
                    provocative_input=input_data["text"],
                    agent_response=agent_response,
                    expected_role="client",
                )

                is_inverted = analysis["role_inverted"]
                if is_inverted:
                    inversions += 1

                results.append({
                    "input": input_data["text"],
                    "input_description": input_data["description"],
                    "attempt": attempt + 1,
                    "agent_response": agent_response,
                    "role_inverted": is_inverted,
                    "analysis_reasoning": analysis["reasoning"],
                })

                leave_room(room)

        total_tests = len(inputs) * NUM_SESSIONS_PER_INPUT
        stability_rate = 1.0 - (inversions / total_tests) if total_tests > 0 else 1.0

        save_result("role_stability", agent_type, {
            "total_tests": total_tests,
            "inversions": inversions,
            "stability_rate": round(stability_rate, 4),
            "results": results,
        }, results_dir)

        assert inversions == 0, (
            f"Detected {inversions}/{total_tests} role inversions. "
            f"Stability rate: {stability_rate:.2%}"
        )
    """
    pass
