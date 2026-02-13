# Known Bugs & Issues

Last audit: 2026-02-13

## Active Issues

### BUG-001: generate-feedback returning 400/404 [MONITORING]
- **Severity**: Medium
- **Source**: Supabase Edge Function logs
- **Symptoms**: `POST generate-feedback` returns 400 (2x) and 404 (1x)
- **Cause**: Cascading failure from BUG-005 (now fixed). Sessions crashed with 0 transcript lines, so feedback generation failed with empty/missing transcript.
- **Status**: Monitoring — should resolve now that sessions work. If persists, investigate Edge Function validation logic in `supabase/functions/generate-feedback/`.

### BUG-002: create-livekit-token sporadic 401 [LOW]
- **Severity**: Low
- **Source**: Supabase Edge Function logs
- **Symptoms**: `POST create-livekit-token` returns 401 (3x), always followed by successful 200 retry
- **Cause**: Race condition — page loads with stale JWT, first request fails, retry with refreshed token succeeds.
- **Status**: Non-blocking. Normal Supabase auth retry pattern.

### BUG-003: get-api-metrics auth failures [LOW]
- **Severity**: Low
- **Source**: Supabase Edge Function logs
- **Symptoms**: `GET` returns 403 (2x), `POST` returns 401 (4x)
- **Cause**: POST method not supported (endpoint is GET-only). 403 likely from missing auth header on admin dashboard.
- **Status**: Non-blocking. Admin-only endpoint.

---

## Resolved Bugs

### BUG-005: Gemini native-audio model rejects TEXT modality [FIXED 2026-02-13]
- **Severity**: Critical
- **Commit**: `f3da74a`
- **Symptoms**: ALL sessions crash ~1s after connect with `Cannot extract voices from a non-audio request`. 0 transcript lines. No roleplay possible.
- **Root cause**: `agent/main.py` used `gemini-2.5-flash-native-audio-preview-12-2025` for both modes. Native-audio models reject `modalities=[Modality.TEXT]` by design.
- **Fix**: Use `gemini-2.0-flash-live-001` for half-cascade (TEXT), keep native-audio for voice-to-voice.

### BUG-006: Premature session termination — 6 bugs [FIXED 2026-02-12]
- **Severity**: Critical
- **Commit**: `b9db8b1`
- **Issues fixed**:
  1. Event handlers registered after `session.start()` — moved before to prevent agent leak
  2. Missing 5s disconnect grace period on mobile layout
  3. No room.state recheck after grace period timeout
  4. Silence watchdog sending nudges before greeting received
  5. Double-disconnect in `useAgentConnection`
  6. Missing `canUpdateOwnMetadata` in LiveKit token grant

### BUG-007: 5 frontend disconnect bugs [FIXED 2026-02-10]
- **Severity**: High
- **Commit**: `2febe2e`
- **Issues fixed**:
  1. `room.disconnect()` called in `handleEnd` causing double disconnect
  2. No auto-redirect on unexpected disconnect (agent died, network lost)
  3. Stale `handleEnd` closure in timer (not using ref)
  4. `audio={true}` conflicting with existingRoom in `<LiveKitRoom>`
  5. `endSession` not wrapped in try/catch — navigation blocked on error

### BUG-008: Emotion enum PT->EN mismatch [FIXED 2026-02-12]
- **Commit**: `cb5cb79`
- **Symptoms**: Frontend crashed on Portuguese emotion values from agent
- **Fix**: `EMOTION_PT_TO_EN` map in `agent/main.py`, defensive validation in frontend

### BUG-009: Session end false positives [FIXED 2026-02-12]
- **Commit**: `cb5cb79`
- **Symptoms**: Agent detected "goodbye" phrases in normal conversation
- **Fix**: Regex word boundaries + max 10 words + 15s cooldown after greeting

### BUG-010: LiveKitRoom connect={false} disconnects room [FIXED 2026-02-12]
- **Commit**: `cb5cb79`
- **Symptoms**: Passing `connect={false}` to `<LiveKitRoom>` with `existingRoom` called `room.disconnect()`
- **Fix**: Omit `connect` prop entirely when using `existingRoom` + `token={undefined}`

### BUG-011: Feedback null safety [FIXED 2026-02-12]
- **Commit**: `cb5cb79`
- **Symptoms**: Frontend crash when `criteria_results` or `evaluation_criteria` is null
- **Fix**: Optional chaining on both fields

### BUG-012: RoomInputOptions deprecated [FIXED 2026-02-12]
- **Commit**: `cb5cb79`
- **Symptoms**: `RoomInputOptions` removed in SDK 1.3.12
- **Fix**: Migrated to `RoomOptions`

---

## Infrastructure Health (2026-02-13)

| Service | Status | Notes |
|---------|--------|-------|
| Vercel (Frontend) | Healthy | Latest deploy READY, 0 runtime errors |
| Supabase Postgres | Healthy | No query errors, no deadlocks |
| Supabase Auth | Healthy | No errors |
| Supabase Edge Functions | Degraded | BUG-001 (feedback 400/404), expected to resolve |
| Railway (Agent) | Deploying | Fix for BUG-005 in progress |
| LiveKit Cloud | Healthy | Worker registered, US East B |
