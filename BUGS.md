# Known Bugs & Issues

Last audit: 2026-02-14

## Active Issues

### BUG-016: Avatar disconnect + audio race condition [WORKAROUND APPLIED 2026-02-14]
- **Severity**: Critical
- **Symptoms**: Avatar video disappears ~3-6s after session start. Hedra never publishes tracks (`tracks=0`). Audio never plays. 0 transcript lines in all sessions.
- **Root cause (Part 1)**: Greeting instruction was duplicated — present in both `full_instructions` (passed to `Agent()`) and explicit `generate_reply()` call. When OpenAI Realtime started processing the first response (from instructions/VAD), the explicit `generate_reply()` call failed with `"Conversation already has an active response in progress"`. Without audio output from the agent, the Hedra avatar received no lip-sync input and disconnected after its internal timeout (~6s).
- **Root cause (Part 2)**: The 2s delay added in Part 1 fix pushed first audio output to T+7s, exceeding Hedra's idle timeout (~6s from avatar.start at T+2).
- **Root cause (Part 3)**: Attempted fix (pt3) reversed init order (session → avatar) but still failed.
- **Root cause (Part 4)**: Attempted fix (pt4) created SECOND `DataStreamAudioOutput` instance, causing RPC handler collision + duplicate streams → Hedra receives corrupted audio → disconnect.
- **Workaround**: `DISABLE_AVATAR=true` environment variable in production (Railway). Sessions run audio-only until definitive fix.
- **Fix attempts (pt1-pt4)**:
  1. Removed greeting from `full_instructions` (only trigger via `generate_reply`)
  2. Reduced greeting delay from 2.0s → 0.5s → 0s
  3. Reversed init order: `session.start()` before `avatar.start()`
  4. Override `DataStreamAudioOutput` with `wait_remote_track=None` (FAILED — duplicate instances)
- **Definitive fix (pending)**: Monkey-patch Hedra plugin's `DataStreamAudioOutput` class BEFORE avatar creation (pt5) OR investigate Hedra API issues.
- **Prevention**: Never create second `DataStreamAudioOutput` instance. Modify existing instance or monkey-patch class before instantiation.

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

### BUG-014: Vercel build failure — simli_minutes type mismatch [FIXED 2026-02-14]
- **Severity**: Critical
- **Commit**: `3335617`
- **Symptoms**: Vercel deploy fails with TS2339: `Property 'simli_minutes' does not exist on type 'MetricsTotals'`
- **Root cause**: During Gemini→OpenAI migration, `MetricsTotals.simli_minutes` was renamed to `avatar_minutes` in types but `MetricsOverview.tsx` line 57 was missed
- **Fix**: Changed `totals?.simli_minutes` to `totals?.avatar_minutes`

### BUG-015: Railway agent crash — RealtimeModel instructions kwarg [FIXED 2026-02-14]
- **Severity**: Critical
- **Commit**: `72172ba`
- **Symptoms**: Agent accepts dispatch but immediately crashes: `TypeError: RealtimeModel.__init__() got an unexpected keyword argument 'instructions'`
- **Root cause**: OpenAI `RealtimeModel` does NOT accept `instructions` parameter (unlike Gemini's `RealtimeModel`). Instructions were being passed both in `realtime_kwargs` (wrong) and in `Agent(instructions=...)` at `session.start()` (correct — line 1761).
- **Fix**: Removed `instructions` from `realtime_kwargs` dict. Instructions correctly passed via `Agent()` class.

### BUG-017: Emotion tags verbalized in audio [FIXED 2026-02-14]
- **Severity**: High
- **Commits**: `9036842`, `e7fbcf9`
- **Symptoms**: Avatar verbalizava tags emocionais no áudio (ex: usuário ouvia "receptivo Que interessante!" em vez de apenas "Que interessante!")
- **Root cause**: Prompt instruía OpenAI Realtime a gerar texto com tags `[emoção]`. Como Realtime usa `modalities=["text", "audio"]` e gera áudio+texto simultaneamente, as tags eram sintetizadas na voz.
- **Impact**: Quebra total de imersão do roleplay
- **Fix**:
  1. Removidas linhas 152-156 de `agent/prompts.py` (seção TAG EMOCIONAL OBRIGATORIO)
  2. Emotion analysis migrada 100% para `emotion_analyzer.py` (GPT-4o-mini assíncrono)
  3. Backend mantém extração de tags como fallback (`EMOTION_TAG_PATTERN`)
- **Result**: Avatar expressa emoções naturalmente via prosódia, tom e escolha de palavras. Emotion meter atualizado via GPT-4o-mini com delay ~1-2s (trade-off aceitável).

### BUG-018: Avatar inverte papel mid-conversation [FIXED 2026-02-14]
- **Severity**: Critical
- **Commits**: `9036842`, `e7fbcf9`
- **Symptoms**: Avatar começava correto (cliente frustrado) mas invertia para papel de suporte quando usuário respondia mal (ex: "Não posso fazer nada"). Avatar oferecia soluções e fazia perguntas de vendedor ("O que posso fazer por você?").
- **Root cause (Part 1)**: Context do cenário "Retenção de Cliente Insatisfeito" usava "Voce precisa... reter o cliente", fazendo OpenAI interpretar que AVATAR deveria reter.
- **Root cause (Part 2)**: OpenAI Realtime tentava "corrigir" situação quando detectava resposta inadequada do usuário, assumindo houve confusão de papéis.
- **Impact**: Usuários não conseguiam treinar — avatar assumia papel deles
- **Fix**:
  1. Adicionada seção "SEU PAPEL (CRITICO)" em `prompts.py` (linhas 133-155) com instruções explícitas: NUNCA inverter papéis mesmo se usuário responder mal
  2. Exemplos de como reagir mantendo papel de cliente ("Como assim?", "Você não está me ouvindo")
  3. Lista explícita de comportamentos proibidos (oferecer soluções, fazer perguntas de vendedor)
  4. Reforço em REGRAS: "PAPEL FIXO", "NUNCA tente 'salvar' a conversa assumindo outro papel"
  5. Updated scenario context de 3ª pessoa ("Um cliente ligou...") para 1ª pessoa ("Voce e um cliente... frustrado")
- **Result**: Avatar mantém papel de cliente durante toda conversa, mesmo com respostas inadequadas do usuário.

---

## Infrastructure Health (2026-02-14, updated)

| Service | Status | Notes |
|---------|--------|-------|
| Vercel (Frontend) | Healthy | Build fix deployed (`3335617`) |
| Supabase Postgres | Healthy | Migration applied: `gemini_voice` → `ai_voice` |
| Supabase Auth | Healthy | No errors |
| Supabase Edge Functions | Healthy | `create-livekit-token` v36, `get-api-metrics` v17 deployed |
| Railway (Agent) | Fix deployed | BUG-016 fix: greeting race condition + avatar disconnect diagnostics |
| LiveKit Cloud | Healthy | Worker registered, US East B |
