-- Migration: Add avatar and voice customization to scenarios
-- Allows each scenario to have its own Simli face_id and Gemini voice

ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS simli_face_id TEXT,
ADD COLUMN IF NOT EXISTS gemini_voice TEXT DEFAULT 'Puck';

COMMENT ON COLUMN scenarios.simli_face_id IS 'Face ID do Simli para este cenário (opcional, usa env var se null)';
COMMENT ON COLUMN scenarios.gemini_voice IS 'Voz do Gemini: Puck, Charon, Kore, Fenrir, Aoede';

-- Add check constraint for valid voice values
ALTER TABLE scenarios
ADD CONSTRAINT valid_gemini_voice
CHECK (gemini_voice IS NULL OR gemini_voice IN ('Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'));
