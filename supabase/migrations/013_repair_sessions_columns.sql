-- Repair migration: Add missing columns to sessions table
-- These columns were supposed to be added by migration 012 but may have failed

-- Add session_mode if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'session_mode'
    ) THEN
        ALTER TABLE sessions ADD COLUMN session_mode VARCHAR(20) DEFAULT 'training'
            CHECK (session_mode IN ('training', 'evaluation'));
        COMMENT ON COLUMN sessions.session_mode IS 'training = coach ativo, evaluation = coach silencioso';
    END IF;
END $$;

-- Add coach_intensity if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'coach_intensity'
    ) THEN
        ALTER TABLE sessions ADD COLUMN coach_intensity VARCHAR(20) DEFAULT 'medium'
            CHECK (coach_intensity IN ('low', 'medium', 'high'));
        COMMENT ON COLUMN sessions.coach_intensity IS 'Intensidade das dicas: low/medium/high';
    END IF;
END $$;

-- Add is_valid if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'is_valid'
    ) THEN
        ALTER TABLE sessions ADD COLUMN is_valid BOOLEAN DEFAULT NULL;
        COMMENT ON COLUMN sessions.is_valid IS 'Se a sessao atende criterios minimos para avaliacao';
    END IF;
END $$;

-- Add validation_reasons if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'validation_reasons'
    ) THEN
        ALTER TABLE sessions ADD COLUMN validation_reasons JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN sessions.validation_reasons IS 'Array de razoes se sessao invalida';
    END IF;
END $$;

-- Add has_avatar_fallback if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'has_avatar_fallback'
    ) THEN
        ALTER TABLE sessions ADD COLUMN has_avatar_fallback BOOLEAN DEFAULT false;
        COMMENT ON COLUMN sessions.has_avatar_fallback IS 'Se houve fallback para modo sem avatar';
    END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(session_mode);
