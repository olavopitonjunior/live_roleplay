# Gemini Architecture Archive

This folder preserves the original Gemini-based agent code before the migration to OpenAI (Feb 2026).

## Why This Exists

The Live Roleplay agent originally used Google Gemini for all AI operations:
- **Realtime voice**: `gemini-2.5-flash-native-audio-preview-12-2025` (voice-to-voice)
- **Text analysis**: `gemini-2.5-flash-lite` (emotion detection + coaching)

## Timeline

| Date | Event |
|------|-------|
| Jan 2025 | Initial build with `gemini-2.0-flash-live-001` (half-cascade: text output + ElevenLabs TTS) |
| Dec 9 2025 | Google shuts down `gemini-2.0-flash-live-001` |
| Dec 2025 | Migrated to `gemini-2.5-flash-native-audio-preview-12-2025` (voice-to-voice only) |
| Feb 2026 | Discovered `proactivity=True` silently breaks audio output (v1alpha bug) |
| Feb 2026 | **Migrated entirely to OpenAI** |

## Bugs That Led to Migration

1. **`gemini-2.0-flash-live-001` shutdown** (Dec 2025): Model removed without notice. Half-cascade mode (text output + ElevenLabs TTS) became impossible.

2. **Native audio model ignores text**: `gemini-2.5-flash-native-audio-preview-12-2025` only processes audio input. `generate_reply(instructions=...)` sends text, which the model silently ignores (no error, no response).

3. **`proactivity=True` v1alpha bug**: Setting `proactivity=True` auto-upgrades the SDK to API v1alpha, which has a known bug where audio output serialization fails for native audio models. The model receives audio, transcribes it (`conversation_item_added: role=user`), but NEVER generates audio output. Zero errors (silent failure).

## Files

- `main.py` - Agent orchestration with `google.realtime.RealtimeModel`
- `emotion_analyzer.py` - Emotion detection via `google.genai.Client` + `gemini-2.5-flash-lite`
- `ai_coach.py` - Real-time coaching via `google.genai.Client` + `gemini-2.5-flash-lite`
- `metrics_collector.py` - Cost tracking with Gemini pricing constants
- `requirements.txt` - Dependencies including `livekit-agents[google]` and `google-genai`

## Key Patterns (for reference)

### Realtime Voice
```python
from livekit.plugins import google
model = google.realtime.RealtimeModel(
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    temperature=0.4,
    instructions=full_instructions,
    voice="Puck",  # Gemini voices: Puck, Charon, Kore, Fenrir, Aoede
)
```

### Text Analysis (genai SDK)
```python
from google import genai
from google.genai import types
client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
response = await client.aio.models.generate_content(
    model="gemini-2.5-flash-lite",
    contents=prompt,
    config=types.GenerateContentConfig(temperature=0.1, max_output_tokens=10),
)
text = response.text
```
