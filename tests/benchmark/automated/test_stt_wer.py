"""
Speech-to-Text Word Error Rate (WER) benchmark test.

Measures the accuracy of the STT component by playing pre-recorded
audio of known Brazilian Portuguese phrases and comparing the
transcription output against the reference text.

WER = (Substitutions + Deletions + Insertions) / Total Reference Words

This is important because PT-BR has colloquialisms and contractions
(e.g., "tô" instead of "estou", "pra" instead of "para") that may
not be handled well by all STT engines.

Test procedure:
    1. Load reference phrases from fixtures/reference_phrases.txt
    2. For each phrase, play the corresponding audio file to the agent
    3. Capture the STT transcription from the agent's transcript
    4. Calculate WER for each phrase
    5. Report mean WER across all phrases
    6. Assert mean WER < 15%

Requirements:
    - Live agent running with STT enabled
    - LiveKit room accessible
    - Pre-recorded audio files for each reference phrase
    - LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET env vars set
    - fixtures/reference_phrases.txt available
"""
import pytest
from pathlib import Path
from conftest import save_result

pytestmark = pytest.mark.skip(
    reason="Requires live agent, pre-recorded audio files, and LiveKit room. "
           "Run with --run-live to enable."
)

MAX_MEAN_WER = 0.15  # 15%


def calculate_wer(reference: str, hypothesis: str) -> float:
    """
    Calculate Word Error Rate using Levenshtein distance at word level.

    Args:
        reference: The correct transcription
        hypothesis: The STT output to evaluate

    Returns:
        WER as a float (0.0 = perfect, 1.0 = 100% error)
    """
    ref_words = reference.lower().strip().split()
    hyp_words = hypothesis.lower().strip().split()

    # Dynamic programming for edit distance
    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]

    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                substitution = d[i - 1][j - 1] + 1
                insertion = d[i][j - 1] + 1
                deletion = d[i - 1][j] + 1
                d[i][j] = min(substitution, insertion, deletion)

    if len(ref_words) == 0:
        return 0.0

    return d[len(ref_words)][len(hyp_words)] / len(ref_words)


def test_stt_wer(agent_type, results_dir, fixtures_dir):
    """
    Measure STT Word Error Rate with PT-BR reference phrases.

    Pseudocode:
        phrases_file = fixtures_dir / "reference_phrases.txt"
        phrases = load_reference_phrases(phrases_file)

        room = connect_to_livekit_room()
        wait_for_agent_greeting(room)

        wer_results = []
        for i, phrase in enumerate(phrases):
            audio_file = fixtures_dir / f"audio/phrase_{i+1}.wav"
            send_audio_to_room(room, audio_file)

            # Wait for agent to process and capture user transcript
            transcript = wait_for_user_transcript(room, timeout=5000)

            wer = calculate_wer(reference=phrase, hypothesis=transcript)
            wer_results.append({
                "phrase_index": i + 1,
                "reference": phrase,
                "hypothesis": transcript,
                "wer": round(wer, 4),
            })

        mean_wer = sum(r["wer"] for r in wer_results) / len(wer_results)

        save_result("stt_wer", agent_type, {
            "num_phrases": len(phrases),
            "results": wer_results,
            "mean_wer": round(mean_wer, 4),
            "max_wer": max(r["wer"] for r in wer_results),
            "min_wer": min(r["wer"] for r in wer_results),
        }, results_dir)

        assert mean_wer < MAX_MEAN_WER, (
            f"Mean WER {mean_wer:.2%} exceeds threshold {MAX_MEAN_WER:.2%}"
        )
    """
    pass
