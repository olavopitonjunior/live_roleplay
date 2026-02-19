"""
Session cost estimation benchmark test.

Calculates the estimated cost of a 3-minute roleplay session for each
agent type based on known pricing constants. This test does NOT require
a live agent — it uses the pricing model from metrics_collector.py to
compute expected costs analytically.

Pricing model (Feb 2026):
    - OpenAI Realtime: $40/1M input tokens, $200/1M output tokens
    - GPT-4o-mini: $0.15/1M input, $0.60/1M output tokens
    - Claude Sonnet (feedback): $3/1M input, $15/1M output tokens
    - LiveKit: ~$0.004/minute (2 participants)
    - Hedra: ~$0.015/minute (currently disabled)

Assumptions for a 3-minute session:
    - ~60 tokens/second for Realtime audio (estimated)
    - ~5 GPT-4o-mini calls (emotion analysis + AI coach)
    - ~1 Claude call for feedback (post-session)
    - 2 LiveKit participants for 3 minutes
"""
import pytest
from conftest import save_result

# Pricing constants from metrics_collector.py (USD cents per unit)
COSTS = {
    # OpenAI Realtime: $40/1M input, $200/1M output tokens
    "realtime_input_per_1k": 40.0,   # cents
    "realtime_output_per_1k": 200.0, # cents
    # GPT-4o-mini: $0.15/1M input, $0.60/1M output tokens
    "text_api_input_per_1k": 1.5,    # cents
    "text_api_output_per_1k": 6.0,   # cents
    # Claude Sonnet: $3/1M input, $15/1M output tokens
    "claude_input_per_1m": 300,      # cents
    "claude_output_per_1m": 1500,    # cents
    # LiveKit: ~$0.004/minute
    "livekit_per_minute": 0.4,       # cents
    # Hedra: ~$0.015/minute
    "hedra_per_minute": 1.5,         # cents
}

# Session assumptions for 3-minute roleplay
SESSION_DURATION_MIN = 3
SESSION_ASSUMPTIONS = {
    "openai_realtime": {
        "description": "OpenAI Realtime (unified STT+LLM+TTS)",
        # Estimated tokens for 3-min conversation
        "realtime_input_tokens": 10800,   # ~60 tok/s * 180s * 0.5 (user speaking ~50%)
        "realtime_output_tokens": 10800,  # ~60 tok/s * 180s * 0.5 (agent speaking ~50%)
        # GPT-4o-mini calls (emotion analyzer + AI coach)
        "text_api_calls": 5,
        "text_api_input_tokens_per_call": 800,
        "text_api_output_tokens_per_call": 200,
        # Claude feedback (post-session, one call)
        "claude_input_tokens": 3000,
        "claude_output_tokens": 1500,
        # LiveKit (2 participants * 3 minutes)
        "livekit_participant_minutes": 6,
        # Hedra (disabled by default)
        "hedra_minutes": 0,
    },
    "pipecat_modular": {
        "description": "Pipecat modular (separate STT + LLM + TTS)",
        # Separate STT (Deepgram/Whisper): included in STT pricing
        # LLM tokens (GPT-4o or similar)
        "realtime_input_tokens": 5000,    # Text-only LLM, fewer tokens
        "realtime_output_tokens": 3000,   # Text-only LLM output
        # Additional STT cost (Deepgram ~$0.0043/min or Whisper API)
        "stt_minutes": 1.5,              # User speaking ~50% of 3 min
        "stt_cost_per_minute_cents": 0.43, # Deepgram Nova-2
        # Additional TTS cost (ElevenLabs ~$0.30/1K chars)
        "tts_characters": 1500,           # ~500 chars/min agent output
        "tts_cost_per_1k_chars_cents": 30, # ElevenLabs
        # GPT-4o-mini calls (same as Realtime stack)
        "text_api_calls": 5,
        "text_api_input_tokens_per_call": 800,
        "text_api_output_tokens_per_call": 200,
        # Claude feedback (same)
        "claude_input_tokens": 3000,
        "claude_output_tokens": 1500,
        # LiveKit (same)
        "livekit_participant_minutes": 6,
        # Hedra (disabled)
        "hedra_minutes": 0,
    },
}


def calculate_cost_openai_realtime(assumptions: dict) -> dict:
    """Calculate total cost for OpenAI Realtime stack in USD cents."""
    cost_breakdown = {}

    # OpenAI Realtime (voice)
    realtime_input = (assumptions["realtime_input_tokens"] / 1000) * COSTS["realtime_input_per_1k"]
    realtime_output = (assumptions["realtime_output_tokens"] / 1000) * COSTS["realtime_output_per_1k"]
    cost_breakdown["openai_realtime"] = round(realtime_input + realtime_output, 2)

    # GPT-4o-mini (analysis)
    text_input = (
        assumptions["text_api_calls"]
        * assumptions["text_api_input_tokens_per_call"]
        / 1000
        * COSTS["text_api_input_per_1k"]
    )
    text_output = (
        assumptions["text_api_calls"]
        * assumptions["text_api_output_tokens_per_call"]
        / 1000
        * COSTS["text_api_output_per_1k"]
    )
    cost_breakdown["gpt4o_mini"] = round(text_input + text_output, 2)

    # Claude feedback
    claude_input = (assumptions["claude_input_tokens"] / 1_000_000) * COSTS["claude_input_per_1m"]
    claude_output = (assumptions["claude_output_tokens"] / 1_000_000) * COSTS["claude_output_per_1m"]
    cost_breakdown["claude_feedback"] = round(claude_input + claude_output, 2)

    # LiveKit
    cost_breakdown["livekit"] = round(
        assumptions["livekit_participant_minutes"] * COSTS["livekit_per_minute"], 2
    )

    # Hedra (if enabled)
    cost_breakdown["hedra"] = round(
        assumptions["hedra_minutes"] * COSTS["hedra_per_minute"], 2
    )

    cost_breakdown["total_cents"] = round(sum(cost_breakdown.values()), 2)
    cost_breakdown["total_usd"] = round(cost_breakdown["total_cents"] / 100, 4)

    return cost_breakdown


def calculate_cost_pipecat_modular(assumptions: dict) -> dict:
    """Calculate total cost for Pipecat modular stack in USD cents."""
    cost_breakdown = {}

    # LLM (text-only, e.g. GPT-4o)
    llm_input = (assumptions["realtime_input_tokens"] / 1000) * COSTS["realtime_input_per_1k"]
    llm_output = (assumptions["realtime_output_tokens"] / 1000) * COSTS["realtime_output_per_1k"]
    cost_breakdown["llm"] = round(llm_input + llm_output, 2)

    # Separate STT (e.g. Deepgram)
    cost_breakdown["stt"] = round(
        assumptions["stt_minutes"] * assumptions["stt_cost_per_minute_cents"], 2
    )

    # Separate TTS (e.g. ElevenLabs)
    cost_breakdown["tts"] = round(
        (assumptions["tts_characters"] / 1000) * assumptions["tts_cost_per_1k_chars_cents"], 2
    )

    # GPT-4o-mini (analysis — same as Realtime stack)
    text_input = (
        assumptions["text_api_calls"]
        * assumptions["text_api_input_tokens_per_call"]
        / 1000
        * COSTS["text_api_input_per_1k"]
    )
    text_output = (
        assumptions["text_api_calls"]
        * assumptions["text_api_output_tokens_per_call"]
        / 1000
        * COSTS["text_api_output_per_1k"]
    )
    cost_breakdown["gpt4o_mini"] = round(text_input + text_output, 2)

    # Claude feedback (same)
    claude_input = (assumptions["claude_input_tokens"] / 1_000_000) * COSTS["claude_input_per_1m"]
    claude_output = (assumptions["claude_output_tokens"] / 1_000_000) * COSTS["claude_output_per_1m"]
    cost_breakdown["claude_feedback"] = round(claude_input + claude_output, 2)

    # LiveKit (same)
    cost_breakdown["livekit"] = round(
        assumptions["livekit_participant_minutes"] * COSTS["livekit_per_minute"], 2
    )

    # Hedra (if enabled)
    cost_breakdown["hedra"] = round(
        assumptions["hedra_minutes"] * COSTS["hedra_per_minute"], 2
    )

    cost_breakdown["total_cents"] = round(sum(cost_breakdown.values()), 2)
    cost_breakdown["total_usd"] = round(cost_breakdown["total_cents"] / 100, 4)

    return cost_breakdown


def test_cost_openai_realtime(results_dir):
    """Calculate estimated cost per 3-minute session for OpenAI Realtime stack."""
    assumptions = SESSION_ASSUMPTIONS["openai_realtime"]
    cost = calculate_cost_openai_realtime(assumptions)

    save_result("cost_session", "openai_realtime", {
        "session_duration_min": SESSION_DURATION_MIN,
        "assumptions": assumptions,
        "cost_breakdown_cents": cost,
        "total_usd": cost["total_usd"],
    }, results_dir)

    # Assert reasonable cost per session (< $0.15 target)
    assert cost["total_usd"] < 0.50, (
        f"OpenAI Realtime session cost ${cost['total_usd']:.4f} exceeds $0.50 budget"
    )


def test_cost_pipecat_modular(results_dir):
    """Calculate estimated cost per 3-minute session for Pipecat modular stack."""
    assumptions = SESSION_ASSUMPTIONS["pipecat_modular"]
    cost = calculate_cost_pipecat_modular(assumptions)

    save_result("cost_session", "pipecat_modular", {
        "session_duration_min": SESSION_DURATION_MIN,
        "assumptions": assumptions,
        "cost_breakdown_cents": cost,
        "total_usd": cost["total_usd"],
    }, results_dir)

    # Assert reasonable cost per session (< $0.15 target)
    assert cost["total_usd"] < 0.50, (
        f"Pipecat modular session cost ${cost['total_usd']:.4f} exceeds $0.50 budget"
    )


def test_cost_comparison(results_dir):
    """Compare costs between stacks and report the difference."""
    realtime_cost = calculate_cost_openai_realtime(SESSION_ASSUMPTIONS["openai_realtime"])
    pipecat_cost = calculate_cost_pipecat_modular(SESSION_ASSUMPTIONS["pipecat_modular"])

    diff_cents = realtime_cost["total_cents"] - pipecat_cost["total_cents"]
    diff_pct = (diff_cents / realtime_cost["total_cents"]) * 100 if realtime_cost["total_cents"] > 0 else 0

    comparison = {
        "openai_realtime_usd": realtime_cost["total_usd"],
        "pipecat_modular_usd": pipecat_cost["total_usd"],
        "difference_cents": round(diff_cents, 2),
        "difference_pct": round(diff_pct, 1),
        "cheaper_stack": "pipecat_modular" if diff_cents > 0 else "openai_realtime",
    }

    save_result("cost_comparison", "comparison", comparison, results_dir)

    # This test always passes — it's informational
    assert True, f"Cost comparison: Realtime=${realtime_cost['total_usd']:.4f} vs Pipecat=${pipecat_cost['total_usd']:.4f}"
