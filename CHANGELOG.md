# Changelog

All notable changes to Live Roleplay will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2026-02-14] - Prompt Fixes & Role Enforcement

### Fixed
- **BUG-017**: Emotion tags being verbalized in audio output
  - Removed emotion tag instructions from prompts ([9036842](https://github.com/olavopitonjunior/live_roleplay/commit/9036842))
  - Avatar now expresses emotions naturally through prosody and tone
  - Emotion detection migrated to async GPT-4o-mini analysis

- **BUG-018**: Avatar role reversal mid-conversation
  - Strengthened role enforcement in prompts ([e7fbcf9](https://github.com/olavopitonjunior/live_roleplay/commit/e7fbcf9))
  - Added explicit instructions on handling user errors without role swap
  - Updated scenario context from 3rd person to 1st person perspective
  - Avatar now maintains client role even when user responds inadequately

- **BUG-016**: Avatar disconnect workaround applied
  - Enabled audio-only mode via DISABLE_AVATAR=true ([0ffd259](https://github.com/olavopitonjunior/live_roleplay/commit/0ffd259))
  - Sessions functional without video while investigating Hedra issues

### Changed
- Improved prompt structure in agent/prompts.py:
  - Added "SEU PAPEL (CRITICO)" section with detailed role instructions
  - Enhanced REGRAS with 11 specific rules including role fixation
  - Added examples of appropriate client responses to user errors

- Updated documentation:
  - Added "Prompts e Roleplay" section to CLAUDE.md
  - Documented emotion analysis architecture
  - Added prevention strategies for role reversal

### Technical Details
- **Emotion Tags Removal**:
  - Deleted lines 152-156 from agent/prompts.py (TAG EMOCIONAL OBRIGATORIO section)
  - Backend still extracts tags via EMOTION_TAG_PATTERN as fallback
  - Emotion meter now updated via emotion_analyzer.py with ~1-2s delay

- **Role Enforcement**:
  - Added 22-line critical role section in prompt
  - 11 strengthened rules including "NUNCA tente 'salvar' a conversa"
  - Scenario context changed to first-person for clarity

## [2026-02-13] - OpenAI Migration Complete

### Changed
- **Full migration from Google Gemini to OpenAI**:
  - Voice: gpt-4o-realtime-preview with modalities=["text", "audio"]
  - Text analysis: gpt-4o-mini for emotion analyzer + AI coach
  - Database columns renamed: gemini_live_* → realtime_*, gemini_voice → ai_voice
  - Edge Functions updated: create-livekit-token v36, get-api-metrics v17

### Fixed
- **BUG-013**: Edge Function desync after DB migration
  - Manually redeployed Edge Functions after column renames
  - Added deployment checklist to CLAUDE.md

- **BUG-014**: Vercel build failure (simli_minutes type mismatch) ([3335617](https://github.com/olavopitonjunior/live_roleplay/commit/3335617))

- **BUG-015**: Railway agent crash (RealtimeModel instructions kwarg) ([72172ba](https://github.com/olavopitonjunior/live_roleplay/commit/72172ba))

### Archive
- Gemini code preserved in _reference/gemini-archive/ with README

## [2026-02-12] - Session Lifecycle Fixes

### Fixed
- **BUG-006**: Premature session termination (6 sub-issues) ([b9db8b1](https://github.com/olavopitonjunior/live_roleplay/commit/b9db8b1))
- **BUG-008**: Emotion enum PT→EN mismatch ([cb5cb79](https://github.com/olavopitonjunior/live_roleplay/commit/cb5cb79))
- **BUG-009**: Session end false positives ([cb5cb79](https://github.com/olavopitonjunior/live_roleplay/commit/cb5cb79))
- **BUG-010**: LiveKitRoom connect={false} disconnects room ([cb5cb79](https://github.com/olavopitonjunior/live_roleplay/commit/cb5cb79))
- **BUG-011**: Feedback null safety ([cb5cb79](https://github.com/olavopitonjunior/live_roleplay/commit/cb5cb79))
- **BUG-012**: RoomInputOptions deprecated ([cb5cb79](https://github.com/olavopitonjunior/live_roleplay/commit/cb5cb79))

## [2026-02-10] - Frontend Disconnect Issues

### Fixed
- **BUG-007**: 5 frontend disconnect bugs ([2febe2e](https://github.com/olavopitonjunior/live_roleplay/commit/2febe2e))

## Earlier Changes

See git history for earlier changes and initial implementation.
