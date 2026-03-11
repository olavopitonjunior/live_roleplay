-- Migration 029: Add org_id to All Existing Tables
-- Phase 1 of multi-tenant migration
--
-- Adds org_id (NULLABLE) + indexes to all 12 existing tables.
-- org_id stays NULLABLE during dual-write + backfill period.
-- Phase 4 (cutover) will SET NOT NULL after backfill.
--
-- Also adds user_profile_id, trial_user_id, and scenario ownership columns.

-- ============================================
-- 1. ACCESS_CODES — Expand for multi-tenant
-- ============================================

ALTER TABLE access_codes
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_unique_users INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS label VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_ac_org ON access_codes(org_id);

-- ============================================
-- 2. SCENARIOS — Add ownership + visibility
-- ============================================

ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'org'
    CHECK (visibility IN ('public','org','team','draft')),
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scenarios_org ON scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_visibility ON scenarios(org_id, visibility) WHERE is_active = true;

COMMENT ON COLUMN scenarios.org_id IS 'NULL = platform template/example. UUID = org-owned instance scenario.';
COMMENT ON COLUMN scenarios.is_template IS 'Platform templates visible to all orgs for cloning.';

-- ============================================
-- 3. SESSIONS — Add identity + org
-- ============================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id),
  ADD COLUMN IF NOT EXISTS trial_user_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sessions_org_started ON sessions(org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_profile_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_trial ON sessions(trial_user_id) WHERE trial_user_id IS NOT NULL;

-- Only one active session per user (prevent concurrent sessions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_per_user ON sessions(user_profile_id)
  WHERE status = 'active' AND user_profile_id IS NOT NULL;

-- Add updated_at trigger for sessions
CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. FEEDBACKS — Add org
-- ============================================

ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_feedbacks_org ON feedbacks(org_id, created_at DESC);

-- ============================================
-- 5. API_METRICS — Add org + user
-- ============================================

ALTER TABLE api_metrics
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_am_org ON api_metrics(org_id, created_at DESC);

-- ============================================
-- 6. CRITERION_RUBRICS — Add org
-- ============================================

ALTER TABLE criterion_rubrics
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_cr_org ON criterion_rubrics(org_id);

-- ============================================
-- 7. SCENARIO_OBJECTIONS — Add org
-- ============================================

ALTER TABLE scenario_objections
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_so_org ON scenario_objections(org_id);

-- ============================================
-- 8. SCENARIO_OUTCOMES — Add org
-- ============================================

ALTER TABLE scenario_outcomes
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_sout_org ON scenario_outcomes(org_id);

-- ============================================
-- 9. SESSION_EVIDENCES — Add org
-- ============================================

ALTER TABLE session_evidences
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_se_org ON session_evidences(org_id);

-- ============================================
-- 10. SESSION_OBJECTION_STATUS — Add org
-- ============================================

ALTER TABLE session_objection_status
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_sos_org ON session_objection_status(org_id);

-- ============================================
-- 11. USER_DIFFICULTY_PROFILES — Add org + user
-- ============================================

ALTER TABLE user_difficulty_profiles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_udp_org ON user_difficulty_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_udp_user ON user_difficulty_profiles(user_profile_id);

-- ============================================
-- 12. USER_LEARNING_PROFILES — Add org + user
-- ============================================

ALTER TABLE user_learning_profiles
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS user_profile_id UUID REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_ulp_org ON user_learning_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_ulp_user ON user_learning_profiles(user_profile_id);

-- ============================================
-- DOCUMENTATION
-- ============================================

COMMENT ON COLUMN access_codes.org_id IS 'Tenant that owns this code. NULL during migration backfill.';
COMMENT ON COLUMN sessions.trial_user_id IS 'Client-generated UUID for shared access codes. Distinguishes users sharing one code.';
COMMENT ON COLUMN sessions.user_profile_id IS 'Linked after trial→enterprise upgrade or for enterprise users.';
