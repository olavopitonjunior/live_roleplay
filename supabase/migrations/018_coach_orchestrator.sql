-- ============================================
-- Migration 018: Coach Orchestrator
-- Adds orchestrator fields to sessions table
-- Removes coach_intensity (replaced by mode-based behavior)
-- ============================================

-- Remove coach_intensity (orchestrator controls behavior now)
ALTER TABLE sessions DROP COLUMN IF EXISTS coach_intensity;

-- Add orchestrator result fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  session_trajectory JSONB DEFAULT '{}';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  turn_evaluations JSONB DEFAULT '[]';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  final_output_type VARCHAR(30);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  output_score DECIMAL(5,2);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS
  coaching_plan JSONB DEFAULT '[]';
