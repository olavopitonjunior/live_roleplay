-- Migration 025: Multi-Tenant Foundation — Organizational Layer
-- Phase 1 of multi-tenant migration
--
-- Creates: organizations, user_profiles, teams, team_memberships,
--          user_invites, scenario_visibility_overrides, scenario_assignments, access_code_uses
--
-- These tables form the organizational backbone for multi-tenancy.
-- org_id on existing tables is added in migration 029.

-- ============================================
-- 1. ORGANIZATIONS
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  owner_id UUID,  -- set after owner signs up (deferred FK)
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('trialing','active','grace_period','suspended','deletion_pending','deleted','churned')),
  settings JSONB DEFAULT '{}'::jsonb,
  plan_limits JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  industry VARCHAR(100),
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  grace_period_ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_status ON organizations(status) WHERE status IN ('active','trialing');

COMMENT ON TABLE organizations IS 'Tenant organizations. Each org is an isolated data silo.';
COMMENT ON COLUMN organizations.owner_id IS 'Set after owner accepts invite and signs up. Deferred FK to user_profiles.';
COMMENT ON COLUMN organizations.settings IS 'Org settings JSONB: session_timeout_hours, max_session_duration_seconds, branding, notifications, etc.';
COMMENT ON COLUMN organizations.plan_limits IS 'Cached plan limits JSONB: max_users, max_sessions, max_scenarios. Updated when plan changes.';

-- ============================================
-- 2. USER_PROFILES
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  auth_user_id UUID UNIQUE,  -- FK to auth.users added via ALTER after Supabase Auth setup
  access_code_id UUID REFERENCES access_codes(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  full_name VARCHAR(200),
  role VARCHAR(30) NOT NULL DEFAULT 'trainee'
    CHECK (role IN ('owner','admin','manager','trainer','trainee')),
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','deactivated','deletion_pending','deleted')),
  avatar_url TEXT,
  last_device VARCHAR(20),
  last_seen_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  deletion_requested_at TIMESTAMPTZ,
  role_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

-- Only one owner per org
CREATE UNIQUE INDEX idx_one_owner_per_org ON user_profiles(org_id) WHERE role = 'owner';
CREATE INDEX idx_up_org ON user_profiles(org_id);
CREATE INDEX idx_up_auth ON user_profiles(auth_user_id);
CREATE INDEX idx_up_org_role ON user_profiles(org_id, role);

COMMENT ON TABLE user_profiles IS 'User identity within an org. Links to auth.users (enterprise) or access_codes (trial).';
COMMENT ON COLUMN user_profiles.auth_user_id IS 'Links to Supabase auth.users for email/password login. NULL for trial users.';
COMMENT ON COLUMN user_profiles.access_code_id IS 'Links to access_codes for trial users. NULL for enterprise users.';

-- Deferred FK: organizations.owner_id → user_profiles.id
ALTER TABLE organizations ADD CONSTRAINT fk_org_owner
  FOREIGN KEY (owner_id) REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================
-- 3. TEAMS
-- ============================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX idx_teams_org ON teams(org_id);

COMMENT ON TABLE teams IS 'Teams within an org. Each team has a manager and members.';

-- ============================================
-- 4. TEAM_MEMBERSHIPS
-- ============================================

CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('manager','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_tm_team ON team_memberships(team_id);
CREATE INDEX idx_tm_user ON team_memberships(user_id);

COMMENT ON TABLE team_memberships IS 'Many-to-many: users can be in multiple teams.';

-- ============================================
-- 5. USER_INVITES
-- ============================================

CREATE TABLE user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) DEFAULT 'trainee'
    CHECK (role IN ('owner','admin','manager','trainer','trainee')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES user_profiles(id),
  token_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one pending invite per email per org
CREATE UNIQUE INDEX idx_invites_pending ON user_invites(org_id, email) WHERE status = 'pending';
CREATE INDEX idx_invites_token ON user_invites(token_hash);

COMMENT ON TABLE user_invites IS 'Org invites. token_hash = sha256(token). Token sent via email, hash stored in DB.';

-- ============================================
-- 6. SCENARIO_VISIBILITY_OVERRIDES
-- ============================================

CREATE TABLE scenario_visibility_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  is_hidden BOOLEAN NOT NULL DEFAULT true,
  hidden_by UUID REFERENCES user_profiles(id),
  hidden_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, scenario_id)
);

COMMENT ON TABLE scenario_visibility_overrides IS 'Orgs can hide platform scenarios (not delete). Hidden scenarios dont appear in org catalog.';

-- ============================================
-- 7. SCENARIO_ASSIGNMENTS
-- ============================================

CREATE TABLE scenario_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES user_profiles(id),
  due_date DATE,
  target_score INTEGER CHECK (target_score IS NULL OR (target_score >= 0 AND target_score <= 100)),
  target_mode VARCHAR(20) DEFAULT 'evaluation'
    CHECK (target_mode IN ('training','evaluation')),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','overdue')),
  completed_session_id UUID REFERENCES sessions(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_id, assigned_to, created_at)
);

CREATE INDEX idx_sa_user ON scenario_assignments(assigned_to);
CREATE INDEX idx_sa_org ON scenario_assignments(org_id);
CREATE INDEX idx_sa_status ON scenario_assignments(status) WHERE status IN ('pending','in_progress');

COMMENT ON TABLE scenario_assignments IS 'Managers assign scenarios to team members with due dates and target scores.';

-- ============================================
-- 8. ACCESS_CODE_USES
-- ============================================

CREATE TABLE access_code_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_code_id UUID NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  trial_user_id UUID NOT NULL,
  first_used_at TIMESTAMPTZ DEFAULT NOW(),
  session_count INTEGER DEFAULT 1,
  upgraded_to UUID REFERENCES user_profiles(id),
  UNIQUE(access_code_id, trial_user_id)
);

CREATE INDEX idx_acu_code ON access_code_uses(access_code_id);

COMMENT ON TABLE access_code_uses IS 'Tracks unique trial users per shared access code. trial_user_id = client-generated UUID.';

-- ============================================
-- RLS POLICIES — All new tables
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_visibility_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_code_uses ENABLE ROW LEVEL SECURITY;

-- Service role: full access on all tables (Edge Functions)
CREATE POLICY "organizations_service_role_all" ON organizations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_profiles_service_role_all" ON user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "teams_service_role_all" ON teams FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "team_memberships_service_role_all" ON team_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "user_invites_service_role_all" ON user_invites FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "scenario_visibility_overrides_service_role_all" ON scenario_visibility_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "scenario_assignments_service_role_all" ON scenario_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "access_code_uses_service_role_all" ON access_code_uses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon/Authenticated: read-only (transitional — Phase 4 will add JWT-based org_id filtering)
CREATE POLICY "organizations_anon_select" ON organizations FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "user_profiles_anon_select" ON user_profiles FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "teams_anon_select" ON teams FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "team_memberships_anon_select" ON team_memberships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "user_invites_anon_select" ON user_invites FOR SELECT TO anon, authenticated USING (status = 'pending');
CREATE POLICY "scenario_visibility_overrides_anon_select" ON scenario_visibility_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "scenario_assignments_anon_select" ON scenario_assignments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "access_code_uses_anon_select" ON access_code_uses FOR SELECT TO anon, authenticated USING (true);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Reuse existing update_updated_at() function from migration 001
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
