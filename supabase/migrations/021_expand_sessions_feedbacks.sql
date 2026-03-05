-- Migration 021: Expand sessions and feedbacks tables
-- AGENTS-EVOLUTION Phase 1 gap fix
--
-- Note: The 22 structured scenario columns were already added to the
-- scenarios table via MCP in a previous session. This migration only
-- adds the missing columns to sessions and feedbacks tables.

-- ─── Sessions table expansion ────────────────────────────────────────────────
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scenario_version INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coach_events JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phase_transitions JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tool_activations JSONB DEFAULT '[]';

-- ─── Feedbacks table expansion ───────────────────────────────────────────────
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS narrative_feedback TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS assistance_data JSONB;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS next_steps TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS difficulty_context TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS session_validity VARCHAR(20) DEFAULT 'valid';
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS session_validity_reason TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS manager_notes TEXT;
