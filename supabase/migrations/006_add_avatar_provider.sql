-- Migration: Add multi-provider avatar support
-- Allows scenarios to use different avatar providers: simli, liveavatar, hedra

-- Add avatar_provider column with constraint
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS avatar_provider TEXT DEFAULT 'simli';

ALTER TABLE scenarios
ADD CONSTRAINT valid_avatar_provider
CHECK (avatar_provider IS NULL OR avatar_provider IN ('simli', 'liveavatar', 'hedra'));

-- Add avatar_id column for provider-agnostic avatar identification
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS avatar_id TEXT;

-- Migrate existing simli_face_id to avatar_id where applicable
UPDATE scenarios
SET avatar_id = simli_face_id
WHERE simli_face_id IS NOT NULL AND avatar_id IS NULL;

COMMENT ON COLUMN scenarios.avatar_provider IS 'Avatar provider: simli (default), liveavatar, hedra';
COMMENT ON COLUMN scenarios.avatar_id IS 'Avatar ID specific to the provider (face_id for simli, avatar_id for others)';
