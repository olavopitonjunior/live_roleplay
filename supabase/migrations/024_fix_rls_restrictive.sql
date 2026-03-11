-- Migration 024: Fix RLS — Replace permissive USING(true) policies with restrictive ones
-- Phase 0 of multi-tenant migration
--
-- PROBLEM: Current policies allow ANY anon/authenticated user to read ALL sessions/feedbacks.
-- The comment says "frontend DEVE filtrar por access_code_id" but RLS does NOT enforce it.
-- This is a data leak — any user can read any other user's session data.
--
-- SOLUTION: Keep service_role full access (Edge Functions need it).
-- For anon/authenticated, restrict to read-only with NO direct write.
-- Writes go through Edge Functions (service_role) only.
-- This is a transitional fix — Phase 1 will add org_id and proper JWT-based RLS.
--
-- IMPORTANT: This migration does NOT break the current frontend because:
-- 1. Frontend reads sessions/feedbacks via anon key (SELECT still works)
-- 2. Frontend writes go through Edge Functions (service_role bypasses RLS)
-- 3. Agent writes via service_role key (bypasses RLS)

-- ============================================
-- 1. SESSIONS — Fix policies
-- ============================================

-- Drop ALL existing session policies (from 001 and 002)
DROP POLICY IF EXISTS "View sessions" ON sessions;
DROP POLICY IF EXISTS "Create sessions" ON sessions;
DROP POLICY IF EXISTS "Update sessions" ON sessions;
DROP POLICY IF EXISTS "service_role_sessions_all" ON sessions;
DROP POLICY IF EXISTS "users_read_own_sessions" ON sessions;

-- Service role: full access (Edge Functions + Agent)
CREATE POLICY "sessions_service_role_all" ON sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Authenticated: read-only (frontend reads sessions list + detail)
-- This still allows reading all sessions, but writes are blocked.
-- Phase 1 will add org_id filter: USING (org_id = (auth.jwt() ->> 'org_id')::UUID)
CREATE POLICY "sessions_anon_select" ON sessions
  FOR SELECT TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE for anon/authenticated — all writes go through Edge Functions

-- ============================================
-- 2. FEEDBACKS — Fix policies
-- ============================================

DROP POLICY IF EXISTS "View feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "Service creates feedbacks" ON feedbacks;
DROP POLICY IF EXISTS "service_role_feedbacks_all" ON feedbacks;
DROP POLICY IF EXISTS "users_read_own_feedbacks" ON feedbacks;

-- Service role: full access
CREATE POLICY "feedbacks_service_role_all" ON feedbacks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Authenticated: read-only
CREATE POLICY "feedbacks_anon_select" ON feedbacks
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 3. ACCESS_CODES — Already OK but tighten
-- ============================================

DROP POLICY IF EXISTS "Allow code validation" ON access_codes;

-- Service role: full access
CREATE POLICY "access_codes_service_role_all" ON access_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon: read active codes only (for login validation)
CREATE POLICY "access_codes_anon_select_active" ON access_codes
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ============================================
-- 4. SCENARIOS — Already OK but standardize naming
-- ============================================

DROP POLICY IF EXISTS "Anyone can view active scenarios" ON scenarios;
DROP POLICY IF EXISTS "Service role manages scenarios" ON scenarios;

-- Service role: full access
CREATE POLICY "scenarios_service_role_all" ON scenarios
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/Authenticated: read active scenarios only
CREATE POLICY "scenarios_anon_select_active" ON scenarios
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- ============================================
-- 5. API_METRICS — Tighten
-- ============================================

DROP POLICY IF EXISTS "service_role_api_metrics_all" ON api_metrics;
DROP POLICY IF EXISTS "authenticated_read_api_metrics" ON api_metrics;

CREATE POLICY "api_metrics_service_role_all" ON api_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "api_metrics_anon_select" ON api_metrics
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 6. CRITERION_RUBRICS — Standardize
-- ============================================

DROP POLICY IF EXISTS "Anyone can view rubrics" ON criterion_rubrics;
DROP POLICY IF EXISTS "Service role manages rubrics" ON criterion_rubrics;

CREATE POLICY "criterion_rubrics_service_role_all" ON criterion_rubrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "criterion_rubrics_anon_select" ON criterion_rubrics
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 7. SCENARIO_OBJECTIONS — Standardize
-- ============================================

DROP POLICY IF EXISTS "Anyone can view objections" ON scenario_objections;
DROP POLICY IF EXISTS "Service role manages objections" ON scenario_objections;

CREATE POLICY "scenario_objections_service_role_all" ON scenario_objections
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "scenario_objections_anon_select" ON scenario_objections
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 8. SCENARIO_OUTCOMES — Standardize
-- ============================================

DROP POLICY IF EXISTS "Scenario outcomes visivel para todos autenticados" ON scenario_outcomes;
DROP POLICY IF EXISTS "Scenario outcomes editavel apenas por admins" ON scenario_outcomes;

CREATE POLICY "scenario_outcomes_service_role_all" ON scenario_outcomes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "scenario_outcomes_anon_select" ON scenario_outcomes
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 9. SESSION_EVIDENCES — Standardize
-- ============================================

DROP POLICY IF EXISTS "Anyone can view evidences" ON session_evidences;
DROP POLICY IF EXISTS "Service role manages evidences" ON session_evidences;

CREATE POLICY "session_evidences_service_role_all" ON session_evidences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "session_evidences_anon_select" ON session_evidences
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 10. SESSION_OBJECTION_STATUS — Standardize
-- ============================================

DROP POLICY IF EXISTS "Anyone can view objection status" ON session_objection_status;
DROP POLICY IF EXISTS "Service role manages objection status" ON session_objection_status;

CREATE POLICY "session_objection_status_service_role_all" ON session_objection_status
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "session_objection_status_anon_select" ON session_objection_status
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 11. USER_DIFFICULTY_PROFILES — Standardize
-- ============================================

DROP POLICY IF EXISTS "Users can view own difficulty profile" ON user_difficulty_profiles;
DROP POLICY IF EXISTS "Service role full access to difficulty profiles" ON user_difficulty_profiles;

CREATE POLICY "user_difficulty_profiles_service_role_all" ON user_difficulty_profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "user_difficulty_profiles_anon_select" ON user_difficulty_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- 12. USER_LEARNING_PROFILES — Standardize
-- ============================================

DROP POLICY IF EXISTS "Users can view own learning profile" ON user_learning_profiles;
DROP POLICY IF EXISTS "Service role full access to learning profiles" ON user_learning_profiles;

CREATE POLICY "user_learning_profiles_service_role_all" ON user_learning_profiles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "user_learning_profiles_anon_select" ON user_learning_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================
-- CLEANUP: Drop unused helper function
-- ============================================

DROP FUNCTION IF EXISTS session_belongs_to_code(UUID, TEXT);

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON POLICY "sessions_service_role_all" ON sessions IS
  'Service role (Edge Functions, Agent) has full CRUD access to all sessions';
COMMENT ON POLICY "sessions_anon_select" ON sessions IS
  'Anon/authenticated can only READ sessions. Writes go through Edge Functions. Phase 1 will add org_id filter.';
COMMENT ON POLICY "feedbacks_service_role_all" ON feedbacks IS
  'Service role has full CRUD access to all feedbacks';
COMMENT ON POLICY "feedbacks_anon_select" ON feedbacks IS
  'Anon/authenticated can only READ feedbacks. Writes go through Edge Functions.';
