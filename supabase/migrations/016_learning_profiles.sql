-- Migration 016: User Learning Profiles
-- Perfil de aprendizado cross-session para identificar pontos fortes/fracos

-- Perfil de aprendizado por usuario
CREATE TABLE user_learning_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_code_id UUID REFERENCES access_codes(id) ON DELETE CASCADE UNIQUE,

  -- Metricas agregadas
  total_sessions INTEGER DEFAULT 0,
  total_valid_sessions INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  best_score DECIMAL(5,2) DEFAULT 0,
  worst_score DECIMAL(5,2) DEFAULT 100,

  -- Performance por criterio: {"crit_id": {"avg_level": 3.2, "total_evals": 5, "trend": "improving"}}
  criteria_performance JSONB DEFAULT '{}',

  -- Tratamento de objecoes: {"objection_id": {"times_faced": 3, "times_addressed": 2, "success_rate": 0.67}}
  objection_handling JSONB DEFAULT '{}',

  -- Proficiencia SPIN: {"situation": 0.8, "problem": 0.6, "implication": 0.4, "need_payoff": 0.3}
  spin_proficiency JSONB DEFAULT '{"situation": 0, "problem": 0, "implication": 0, "need_payoff": 0}',

  -- Pontos fracos recorrentes (array de criterion_ids ou descricoes)
  recurring_weaknesses TEXT[] DEFAULT '{}',

  -- Pontos fortes recorrentes
  recurring_strengths TEXT[] DEFAULT '{}',

  -- Resumo gerado por AI (atualizado periodicamente)
  ai_summary TEXT,
  ai_summary_updated_at TIMESTAMPTZ,

  -- Outcomes historico
  outcomes_history JSONB DEFAULT '{"sale_closed": 0, "meeting_scheduled": 0, "proposal_requested": 0, "needs_follow_up": 0, "rejected": 0}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE user_learning_profiles IS 'Perfil de aprendizado cross-session do usuario';
COMMENT ON COLUMN user_learning_profiles.criteria_performance IS 'Performance por criterio com media, total de avaliacoes e tendencia';
COMMENT ON COLUMN user_learning_profiles.objection_handling IS 'Estatisticas de tratamento de objecoes';
COMMENT ON COLUMN user_learning_profiles.spin_proficiency IS 'Proficiencia nas etapas SPIN (0-1)';
COMMENT ON COLUMN user_learning_profiles.recurring_weaknesses IS 'Pontos fracos identificados em multiplas sessoes';
COMMENT ON COLUMN user_learning_profiles.recurring_strengths IS 'Pontos fortes identificados em multiplas sessoes';
COMMENT ON COLUMN user_learning_profiles.ai_summary IS 'Resumo personalizado gerado por AI';

-- Index para queries
CREATE INDEX IF NOT EXISTS idx_user_learning_profiles_access_code
  ON user_learning_profiles(access_code_id);

-- RLS policies
ALTER TABLE user_learning_profiles ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver apenas seu proprio perfil
CREATE POLICY "Users can view own learning profile"
ON user_learning_profiles FOR SELECT
TO authenticated
USING (access_code_id = auth.uid()::uuid);

-- Service role pode fazer tudo (para Edge Functions)
CREATE POLICY "Service role full access to learning profiles"
ON user_learning_profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Funcao para obter ou criar perfil de aprendizado
CREATE OR REPLACE FUNCTION get_or_create_learning_profile(p_access_code_id UUID)
RETURNS user_learning_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile user_learning_profiles;
BEGIN
  SELECT * INTO profile
  FROM user_learning_profiles
  WHERE access_code_id = p_access_code_id;

  IF NOT FOUND THEN
    INSERT INTO user_learning_profiles (access_code_id)
    VALUES (p_access_code_id)
    RETURNING * INTO profile;
  END IF;

  RETURN profile;
END;
$$;

-- Funcao para atualizar perfil apos sessao
CREATE OR REPLACE FUNCTION update_learning_profile_after_session(
  p_access_code_id UUID,
  p_session_score DECIMAL,
  p_is_valid BOOLEAN,
  p_criteria_scores JSONB,  -- [{"criterion_id": "xxx", "level": 3}, ...]
  p_objection_statuses JSONB,  -- [{"objection_id": "xxx", "status": "addressed"}, ...]
  p_outcome TEXT
)
RETURNS user_learning_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile user_learning_profiles;
  criterion JSONB;
  objection JSONB;
  crit_id TEXT;
  crit_level INTEGER;
  obj_id TEXT;
  obj_status TEXT;
  current_crit_perf JSONB;
  current_obj_handling JSONB;
  new_avg DECIMAL;
  new_total INTEGER;
  outcomes JSONB;
BEGIN
  -- Obter ou criar perfil
  SELECT * INTO profile
  FROM user_learning_profiles
  WHERE access_code_id = p_access_code_id;

  IF NOT FOUND THEN
    INSERT INTO user_learning_profiles (access_code_id)
    VALUES (p_access_code_id)
    RETURNING * INTO profile;
  END IF;

  -- Atualizar contadores de sessao
  UPDATE user_learning_profiles
  SET
    total_sessions = total_sessions + 1,
    total_valid_sessions = CASE WHEN p_is_valid THEN total_valid_sessions + 1 ELSE total_valid_sessions END,
    updated_at = NOW()
  WHERE access_code_id = p_access_code_id;

  -- Atualizar scores apenas para sessoes validas
  IF p_is_valid THEN
    -- Calcular nova media
    new_total := profile.total_valid_sessions + 1;
    new_avg := ((profile.average_score * profile.total_valid_sessions) + p_session_score) / new_total;

    UPDATE user_learning_profiles
    SET
      average_score = new_avg,
      best_score = GREATEST(best_score, p_session_score),
      worst_score = LEAST(worst_score, p_session_score)
    WHERE access_code_id = p_access_code_id;

    -- Atualizar performance por criterio
    IF p_criteria_scores IS NOT NULL AND jsonb_array_length(p_criteria_scores) > 0 THEN
      FOR criterion IN SELECT * FROM jsonb_array_elements(p_criteria_scores)
      LOOP
        crit_id := criterion->>'criterion_id';
        crit_level := (criterion->>'level')::INTEGER;

        IF crit_id IS NOT NULL AND crit_level IS NOT NULL THEN
          current_crit_perf := COALESCE(profile.criteria_performance->crit_id, '{"avg_level": 0, "total_evals": 0}'::jsonb);

          UPDATE user_learning_profiles
          SET criteria_performance = jsonb_set(
            criteria_performance,
            ARRAY[crit_id],
            jsonb_build_object(
              'avg_level', (
                ((current_crit_perf->>'avg_level')::DECIMAL * (current_crit_perf->>'total_evals')::INTEGER + crit_level) /
                ((current_crit_perf->>'total_evals')::INTEGER + 1)
              ),
              'total_evals', (current_crit_perf->>'total_evals')::INTEGER + 1,
              'last_level', crit_level
            )
          )
          WHERE access_code_id = p_access_code_id;
        END IF;
      END LOOP;
    END IF;

    -- Atualizar tratamento de objecoes
    IF p_objection_statuses IS NOT NULL AND jsonb_array_length(p_objection_statuses) > 0 THEN
      FOR objection IN SELECT * FROM jsonb_array_elements(p_objection_statuses)
      LOOP
        obj_id := objection->>'objection_id';
        obj_status := objection->>'status';

        IF obj_id IS NOT NULL THEN
          current_obj_handling := COALESCE(profile.objection_handling->obj_id, '{"times_faced": 0, "times_addressed": 0}'::jsonb);

          UPDATE user_learning_profiles
          SET objection_handling = jsonb_set(
            objection_handling,
            ARRAY[obj_id],
            jsonb_build_object(
              'times_faced', (current_obj_handling->>'times_faced')::INTEGER + 1,
              'times_addressed', (current_obj_handling->>'times_addressed')::INTEGER +
                CASE WHEN obj_status = 'addressed' THEN 1 ELSE 0 END,
              'success_rate', (
                ((current_obj_handling->>'times_addressed')::INTEGER + CASE WHEN obj_status = 'addressed' THEN 1 ELSE 0 END)::DECIMAL /
                ((current_obj_handling->>'times_faced')::INTEGER + 1)
              )
            )
          )
          WHERE access_code_id = p_access_code_id;
        END IF;
      END LOOP;
    END IF;

    -- Atualizar historico de outcomes
    IF p_outcome IS NOT NULL THEN
      outcomes := profile.outcomes_history;
      IF outcomes ? p_outcome THEN
        UPDATE user_learning_profiles
        SET outcomes_history = jsonb_set(
          outcomes_history,
          ARRAY[p_outcome],
          to_jsonb((outcomes->>p_outcome)::INTEGER + 1)
        )
        WHERE access_code_id = p_access_code_id;
      END IF;
    END IF;
  END IF;

  -- Retornar perfil atualizado
  SELECT * INTO profile
  FROM user_learning_profiles
  WHERE access_code_id = p_access_code_id;

  RETURN profile;
END;
$$;

-- Funcao para identificar pontos fracos/fortes recorrentes
CREATE OR REPLACE FUNCTION analyze_recurring_patterns(p_access_code_id UUID)
RETURNS TABLE(weaknesses TEXT[], strengths TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile user_learning_profiles;
  weak_criteria TEXT[] := '{}';
  strong_criteria TEXT[] := '{}';
  crit_key TEXT;
  crit_data JSONB;
BEGIN
  SELECT * INTO profile
  FROM user_learning_profiles
  WHERE access_code_id = p_access_code_id;

  IF NOT FOUND OR profile.criteria_performance = '{}'::jsonb THEN
    RETURN QUERY SELECT weak_criteria, strong_criteria;
    RETURN;
  END IF;

  -- Analisar cada criterio
  FOR crit_key, crit_data IN SELECT * FROM jsonb_each(profile.criteria_performance)
  LOOP
    -- Precisa de pelo menos 3 avaliacoes para ser considerado
    IF (crit_data->>'total_evals')::INTEGER >= 3 THEN
      IF (crit_data->>'avg_level')::DECIMAL < 2.5 THEN
        weak_criteria := array_append(weak_criteria, crit_key);
      ELSIF (crit_data->>'avg_level')::DECIMAL >= 3.5 THEN
        strong_criteria := array_append(strong_criteria, crit_key);
      END IF;
    END IF;
  END LOOP;

  -- Atualizar o perfil com os padroes encontrados
  UPDATE user_learning_profiles
  SET
    recurring_weaknesses = weak_criteria,
    recurring_strengths = strong_criteria,
    updated_at = NOW()
  WHERE access_code_id = p_access_code_id;

  RETURN QUERY SELECT weak_criteria, strong_criteria;
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION get_or_create_learning_profile(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_learning_profile_after_session(UUID, DECIMAL, BOOLEAN, JSONB, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION analyze_recurring_patterns(UUID) TO authenticated, service_role;
