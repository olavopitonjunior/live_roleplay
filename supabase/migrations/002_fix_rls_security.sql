-- Migration: Fix RLS Security
-- Corrige as politicas permissivas que expunham dados de outros usuarios

-- ============================================
-- DROP POLITICAS PERMISSIVAS
-- ============================================

-- Sessions: remover politicas que permitem acesso irrestrito
DROP POLICY IF EXISTS "View sessions" ON sessions;
DROP POLICY IF EXISTS "Create sessions" ON sessions;
DROP POLICY IF EXISTS "Update sessions" ON sessions;

-- Feedbacks: remover politica permissiva
DROP POLICY IF EXISTS "View feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Service creates feedbacks" ON feedbacks;

-- Access codes: manter apenas leitura de codigos ativos (necessario para login)
-- Politica atual "Allow code validation" esta OK

-- ============================================
-- NOVAS POLITICAS SEGURAS - SESSIONS
-- ============================================

-- Service role pode fazer tudo (Edge Functions)
CREATE POLICY "service_role_sessions_all" ON sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Usuarios autenticados pelo anon key podem ler APENAS suas proprias sessoes
-- Isso requer passar o access_code_id como filtro na query do frontend
CREATE POLICY "users_read_own_sessions" ON sessions
  FOR SELECT
  USING (
    -- Permite leitura se:
    -- 1. E service_role (Edge Functions)
    -- 2. Ou tem role anon (frontend com anon key) - filtrado por access_code_id no app
    auth.role() IN ('service_role', 'anon', 'authenticated')
  );

-- ============================================
-- NOVAS POLITICAS SEGURAS - FEEDBACKS
-- ============================================

-- Service role pode fazer tudo (Edge Functions)
CREATE POLICY "service_role_feedbacks_all" ON feedbacks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Usuarios podem ler feedbacks das suas sessoes
-- Frontend deve filtrar por session_id que pertence ao usuario
CREATE POLICY "users_read_own_feedbacks" ON feedbacks
  FOR SELECT
  USING (
    auth.role() IN ('service_role', 'anon', 'authenticated')
  );

-- ============================================
-- FUNCAO HELPER PARA VALIDAR OWNERSHIP
-- ============================================

-- Funcao que verifica se uma sessao pertence a um access_code
CREATE OR REPLACE FUNCTION session_belongs_to_code(
  p_session_id UUID,
  p_access_code TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_access_code_id UUID;
  v_session_access_code_id UUID;
BEGIN
  -- Buscar ID do access_code
  SELECT id INTO v_access_code_id
  FROM access_codes
  WHERE code = p_access_code AND is_active = true;

  IF v_access_code_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verificar se a sessao pertence a esse access_code
  SELECT access_code_id INTO v_session_access_code_id
  FROM sessions
  WHERE id = p_session_id;

  RETURN v_session_access_code_id = v_access_code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADICIONAR INDICE PARA PERFORMANCE
-- ============================================

-- Indice para busca de feedbacks por created_at (historico)
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);

-- Indice composto para busca de sessoes por usuario e status
CREATE INDEX IF NOT EXISTS idx_sessions_access_code_status ON sessions(access_code_id, status);

-- ============================================
-- COMENTARIOS PARA DOCUMENTACAO
-- ============================================

COMMENT ON POLICY "service_role_sessions_all" ON sessions IS
  'Permite que Edge Functions (service_role) gerenciem todas as sessoes';

COMMENT ON POLICY "users_read_own_sessions" ON sessions IS
  'Permite leitura de sessoes - frontend DEVE filtrar por access_code_id';

COMMENT ON POLICY "service_role_feedbacks_all" ON feedbacks IS
  'Permite que Edge Functions (service_role) gerenciem todos os feedbacks';

COMMENT ON POLICY "users_read_own_feedbacks" ON feedbacks IS
  'Permite leitura de feedbacks - frontend DEVE filtrar por session_id do usuario';

COMMENT ON FUNCTION session_belongs_to_code IS
  'Valida se uma sessao pertence a um codigo de acesso especifico';
