-- Migration 015: Progressive Difficulty System
-- Sistema de dificuldade adaptativa baseado no desempenho do usuario

-- Perfil de dificuldade por usuario
CREATE TABLE user_difficulty_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_code_id UUID REFERENCES access_codes(id) ON DELETE CASCADE UNIQUE,
  current_level INTEGER DEFAULT 3 CHECK (current_level BETWEEN 1 AND 10),
  sessions_at_level INTEGER DEFAULT 0,
  consecutive_high_scores INTEGER DEFAULT 0,
  consecutive_low_scores INTEGER DEFAULT 0,
  last_adjustment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE user_difficulty_profiles IS 'Perfil de dificuldade adaptativa por usuario';
COMMENT ON COLUMN user_difficulty_profiles.current_level IS 'Nivel atual de dificuldade (1-10), comeca em 3';
COMMENT ON COLUMN user_difficulty_profiles.sessions_at_level IS 'Numero de sessoes no nivel atual';
COMMENT ON COLUMN user_difficulty_profiles.consecutive_high_scores IS 'Sessoes consecutivas com score >= 75%';
COMMENT ON COLUMN user_difficulty_profiles.consecutive_low_scores IS 'Sessoes consecutivas com score < 50%';

-- Adicionar coluna difficulty_level em sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS difficulty_level INTEGER DEFAULT 3
  CHECK (difficulty_level BETWEEN 1 AND 10);

COMMENT ON COLUMN sessions.difficulty_level IS 'Nivel de dificuldade usado nesta sessao (1-10)';

-- Index para queries
CREATE INDEX IF NOT EXISTS idx_user_difficulty_profiles_access_code
  ON user_difficulty_profiles(access_code_id);

-- RLS policies
ALTER TABLE user_difficulty_profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver apenas seu proprio perfil
CREATE POLICY "Users can view own difficulty profile"
ON user_difficulty_profiles FOR SELECT
TO authenticated
USING (access_code_id = auth.uid()::uuid);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access to difficulty profiles"
ON user_difficulty_profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Funcao para obter ou criar perfil de dificuldade
CREATE OR REPLACE FUNCTION get_or_create_difficulty_profile(p_access_code_id UUID)
RETURNS user_difficulty_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile user_difficulty_profiles;
BEGIN
  -- Tentar obter perfil existente
  SELECT * INTO profile
  FROM user_difficulty_profiles
  WHERE access_code_id = p_access_code_id;

  -- Se nao existe, criar
  IF NOT FOUND THEN
    INSERT INTO user_difficulty_profiles (access_code_id, current_level)
    VALUES (p_access_code_id, 3)
    RETURNING * INTO profile;
  END IF;

  RETURN profile;
END;
$$;

-- Funcao para ajustar nivel de dificuldade apos sessao
CREATE OR REPLACE FUNCTION adjust_difficulty_level(
  p_access_code_id UUID,
  p_session_score INTEGER
)
RETURNS TABLE(
  new_level INTEGER,
  level_changed BOOLEAN,
  adjustment_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile user_difficulty_profiles;
  v_new_level INTEGER;
  v_changed BOOLEAN := false;
  v_reason TEXT := 'no_change';
BEGIN
  -- Obter ou criar perfil
  SELECT * INTO profile
  FROM user_difficulty_profiles
  WHERE access_code_id = p_access_code_id;

  IF NOT FOUND THEN
    INSERT INTO user_difficulty_profiles (access_code_id, current_level)
    VALUES (p_access_code_id, 3)
    RETURNING * INTO profile;
  END IF;

  v_new_level := profile.current_level;

  -- Logica de ajuste
  IF p_session_score >= 75 THEN
    -- Score alto
    UPDATE user_difficulty_profiles
    SET
      consecutive_high_scores = consecutive_high_scores + 1,
      consecutive_low_scores = 0,
      sessions_at_level = sessions_at_level + 1,
      updated_at = NOW()
    WHERE access_code_id = p_access_code_id;

    -- Verificar promocao (2 sessoes consecutivas com score alto)
    IF profile.consecutive_high_scores + 1 >= 2 AND profile.current_level < 10 THEN
      v_new_level := profile.current_level + 1;
      v_changed := true;
      v_reason := 'promoted';

      UPDATE user_difficulty_profiles
      SET
        current_level = v_new_level,
        sessions_at_level = 0,
        consecutive_high_scores = 0,
        last_adjustment_at = NOW()
      WHERE access_code_id = p_access_code_id;
    END IF;

  ELSIF p_session_score < 50 THEN
    -- Score baixo
    UPDATE user_difficulty_profiles
    SET
      consecutive_low_scores = consecutive_low_scores + 1,
      consecutive_high_scores = 0,
      sessions_at_level = sessions_at_level + 1,
      updated_at = NOW()
    WHERE access_code_id = p_access_code_id;

    -- Verificar demotecao (2 sessoes consecutivas com score baixo)
    IF profile.consecutive_low_scores + 1 >= 2 AND profile.current_level > 1 THEN
      v_new_level := profile.current_level - 1;
      v_changed := true;
      v_reason := 'demoted';

      UPDATE user_difficulty_profiles
      SET
        current_level = v_new_level,
        sessions_at_level = 0,
        consecutive_low_scores = 0,
        last_adjustment_at = NOW()
      WHERE access_code_id = p_access_code_id;
    END IF;

  ELSE
    -- Score medio (50-74) - apenas incrementa contador
    UPDATE user_difficulty_profiles
    SET
      consecutive_high_scores = 0,
      consecutive_low_scores = 0,
      sessions_at_level = sessions_at_level + 1,
      updated_at = NOW()
    WHERE access_code_id = p_access_code_id;
  END IF;

  RETURN QUERY SELECT v_new_level, v_changed, v_reason;
END;
$$;

-- Grant para funcoes
GRANT EXECUTE ON FUNCTION get_or_create_difficulty_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_difficulty_profile(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION adjust_difficulty_level(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_difficulty_level(UUID, INTEGER) TO service_role;
