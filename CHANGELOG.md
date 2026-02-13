# Changelog

All notable changes to this project are documented in this file.

## [2026-02-13]

### Fixed
- **Gemini model for half-cascade mode** — native-audio model (`gemini-2.5-flash-native-audio-preview`) rejects `Modality.TEXT`; switched to `gemini-2.0-flash-live-001` for TEXT output (`f3da74a`)

## [2026-02-12]

### Added
- **Half-cascade TTS** — Gemini Realtime (TEXT) + ElevenLabs Flash v2.5 (~75ms TTFB) (`cb5cb79`)
- **EmotionStrippingAgent** — strips `[emotion]` tags before TTS via overridden `tts_node`
- **ConversationCoach** — silence watchdog (10s) + hesitation detection, zero LLM cost
- **Participant attributes** — emotion, intensity, turn_count, SPIN stage via `set_attributes()`
- **26 Playwright E2E tests** across 11 spec files (smoke, fase0/1/2, full-flow, diagnostic)

### Fixed
- **Premature session termination** — 6 bugs: event handler ordering, mobile grace period, room state recheck, watchdog guard, double-disconnect guard, token permissions (`b9db8b1`)
- **Feedback error propagation** — read Edge Function response body for detailed errors
- Prompt optimization (~30% token reduction), temperature 0.4, VAD min_silence 0.15

## [2026-02-10]

### Added
- **Real-time latency monitoring panel** for debug sessions (`7345c70`)
- E2E production diagnostics

### Fixed
- **5 frontend disconnect bugs** — remove double `room.disconnect()`, add auto-redirect on unexpected disconnect, fix stale closure in timer, fix audio flag for existingRoom, wrap endSession in try/catch (`2febe2e`)
- Enable microphone for existingRoom flow (`38464e5`)

## [2026-02-04]

### Added
- Database architecture documentation v2.1
- QA test script (`npm run test:qa`)

### Fixed
- Critical bug fixes and AI Coach diagnostics (`2e9f37a`)
- Persist chat messages across tabs + AI coach rate limiting (`446a8af`)
- Pass existing room to SessionRoom to prevent agent disconnect (`8f749a5`)
- Update Gemini model to `gemini-2.5-flash-lite` (`6c036f7`)
- Correct Gemini model and LiveKit agent dispatch (`bf64e78`)
- Vercel deployment config — add `vercel.json` to root (`6f26bde`)

## [2026-01-30]

### Added
- **Difficulty system** — 1-10 scale per scenario (`1e38421`)
- **Learning profiles** — track user weaknesses across sessions
- UI improvements for scenario selection

## [2026-01-29]

### Added
- **AI suggestions** for scenario creation (`d90222a`)
- **Evidence-based evaluation system** (PRD 08) — 5 criteria with supporting quotes (`25adba4`)

### Fixed
- Default tab changed to Chat for transcription visibility (`40414d6`)
- Fallback for undefined emotion in EmotionMeter (`83ef4c1`)
- Missing session columns: `session_mode`, `coach_intensity` (`cfe51b6`)

## [2026-01-27–28]

### Added
- **Hedra Character-3** avatar integration (migration 011) — replaced LiveAvatar (`24b42a9`)
- **Proactive AI Coach** — Gemini Flash suggestions during roleplay
- Agent connection verification during loading screen (`e32dfa0`)
- Test dependencies: Playwright, dotenv, livekit-server-sdk (`542d8d0`)

### Changed
- Module-level json import for performance (`71f15ea`)

## [2026-01-26]

### Added
- **Initial release** — Live Roleplay platform (`db02767`)
- Coaching mode, emotion overlay, UX improvements (`85c2ff9`)
- Railway/Nixpacks config for Python agent (`4a4f99e`)
- LiveAvatar plugin for HeyGen support (brief experiment) (`29e7481`)
- Named agent with token-based dispatch (`27dfa8b`, `9f6d919`)

### Fixed
- CORS whitelist for Vercel production URL (`76405d5`)
- Railway Dockerfile path (`45c5e18`)
- Unused variable in CoachingPanel (`e07afbd`)

### Changed
- **Migrated from `google-generativeai` to `google-genai` SDK** (`fc592f2`)
