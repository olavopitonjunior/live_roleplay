-- Migration: Add columns for bug fixes
-- Date: 2026-02-04
-- Description:
--   1. feedback_requested: Prevents duplicate feedback generation from frontend
--   2. last_transcript_update: Tracks intermediate transcript saves
--   3. avatar_duration_seconds, avatar_provider: Generic avatar metrics

-- Add feedback_requested column to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS feedback_requested BOOLEAN DEFAULT FALSE;

-- Add last_transcript_update column to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS last_transcript_update TIMESTAMPTZ;

-- Add avatar metrics columns to api_metrics table (if they don't exist)
ALTER TABLE api_metrics
ADD COLUMN IF NOT EXISTS avatar_duration_seconds DECIMAL(10, 2);

ALTER TABLE api_metrics
ADD COLUMN IF NOT EXISTS avatar_provider TEXT DEFAULT 'unknown';

-- Create index for feedback_requested to speed up frontend queries
CREATE INDEX IF NOT EXISTS idx_sessions_feedback_requested
ON sessions(id, feedback_requested) WHERE feedback_requested = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN sessions.feedback_requested IS 'Set by agent when it triggers feedback generation to prevent frontend from triggering duplicate';
COMMENT ON COLUMN sessions.last_transcript_update IS 'Timestamp of last intermediate transcript save during session';
COMMENT ON COLUMN api_metrics.avatar_duration_seconds IS 'Duration of avatar usage in seconds (generic, replaces simli_duration_seconds)';
COMMENT ON COLUMN api_metrics.avatar_provider IS 'Avatar provider used (simli, hedra, liveavatar)';
