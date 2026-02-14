# Known Bugs & Issues

Last audit: 2026-02-13

## Active Issues

### BUG-013: Edge Function desync after DB migration [FIXED 2026-02-13]
- **Severity**: Critical
- **Symptoms**: ALL session creation fails — `create-livekit-token` queries `gemini_voice` column that was renamed to `ai_voice` in DB migration. Returns 404/500.
- **Root cause**: DB migration renamed `gemini_voice` → `ai_voice` and `gemini_live_*` → `realtime_*`, but Edge Functions on Supabase were NOT redeployed. Edge Functions don't auto-deploy — they require manual deploy via MCP or `supabase functions deploy`.
- **Fix**: Redeployed `create-livekit-token` (v36) and `get-api-metrics` (v17) with updated column names.
- **Prevention**: Added "Deployment Checklist" section to CLAUDE.md — when renaming DB columns, ALWAYS redeploy Edge Functions that reference them.

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

### BUG-005: Gemini native-audio model rejects TEXT modality [RESOLVED — migrated to OpenAI]
- **Severity**: Critical (was)
- **Commit**: `f3da74a`
- **Symptoms**: ALL sessions crash ~1s after connect with `Cannot extract voices from a non-audio request`.
- **Root cause**: Gemini native-audio models reject `modalities=[Modality.TEXT]` by design. Half-cascade impossible.
- **Resolution**: Migrated entire AI stack from Gemini to OpenAI Realtime (`gpt-4o-realtime-preview`). OpenAI supports text+audio output natively.

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

## Infrastructure Health (2026-02-13, updated)

| Service | Status | Notes |
|---------|--------|-------|
| Vercel (Frontend) | Pending | Git push pending — local changes not yet deployed |
| Supabase Postgres | Healthy | Migration applied: `gemini_voice` → `ai_voice` |
| Supabase Auth | Healthy | No errors |
| Supabase Edge Functions | Fixed | BUG-013 fixed — `create-livekit-token` v36, `get-api-metrics` v17 deployed |
| Railway (Agent) | Healthy | OpenAI Realtime deployed, SDK 1.4.1, worker registered |
| LiveKit Cloud | Healthy | Worker registered, US East B |
