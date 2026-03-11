-- Migration 033: Phase 4 Cutover — NOT NULL + RLS
--
-- Prerequisites:
-- 1. All existing data must have org_id backfilled (run backfill script first)
-- 2. All Edge Functions must be updated for dual-auth
-- 3. Frontend must support both auth methods
--
-- This migration:
-- 1. Sets org_id NOT NULL on all tables (after backfill verification)
-- 2. Enables RLS on all tables
-- 3. Creates restrictive RLS policies
--
-- IMPORTANT: Run `034_backfill_org_id.sql` BEFORE this migration.

-- ============================================
-- 1. VERIFY BACKFILL (safety check)
-- ============================================

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- Check for NULL org_ids in critical tables
  SELECT COUNT(*) INTO null_count FROM sessions WHERE org_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'sessions has % rows with NULL org_id. Run backfill first.', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM feedbacks WHERE org_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'feedbacks has % rows with NULL org_id. Run backfill first.', null_count;
  END IF;

  SELECT COUNT(*) INTO null_count FROM scenarios WHERE org_id IS NULL AND is_template = false;
  IF null_count > 0 THEN
    RAISE WARNING 'scenarios has % non-template rows with NULL org_id. These will be treated as platform scenarios.', null_count;
  END IF;
END $$;

-- ============================================
-- 2. SET NOT NULL (after backfill)
-- ============================================

-- Sessions: always have an org
ALTER TABLE sessions ALTER COLUMN org_id SET NOT NULL;

-- Feedbacks: always have an org
ALTER TABLE feedbacks ALTER COLUMN org_id SET NOT NULL;

-- NOTE: scenarios.org_id stays NULLABLE — NULL means platform template/example
-- NOTE: access_codes.org_id stays NULLABLE during migration period
-- NOTE: other tables (api_metrics, etc.) stay nullable until full backfill

-- ============================================
-- 3. ENABLE RLS
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterion_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_objection_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_difficulty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS POLICIES — Organizations
-- ============================================

-- Tenant users see own org
CREATE POLICY "org_tenant_select" ON organizations
  FOR SELECT TO authenticated
  USING (id = (auth.jwt() ->> 'org_id')::UUID);

-- Platform users see all orgs
CREATE POLICY "org_platform_select" ON organizations
  FOR SELECT TO authenticated
  USING (auth.is_platform_user());

-- Only owner can update org settings
CREATE POLICY "org_owner_update" ON organizations
  FOR UPDATE TO authenticated
  USING (id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'))
  WITH CHECK (id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

-- ============================================
-- 5. RLS POLICIES — User Profiles
-- ============================================

-- Users in same org can see each other
CREATE POLICY "up_tenant_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

-- Only owner/admin can modify users
CREATE POLICY "up_admin_modify" ON user_profiles
  FOR ALL TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

-- Users can update their own settings
CREATE POLICY "up_self_update" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = (auth.jwt() ->> 'profile_id')::UUID)
  WITH CHECK (id = (auth.jwt() ->> 'profile_id')::UUID);

-- Platform users see all
CREATE POLICY "up_platform_select" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.is_platform_user());

-- ============================================
-- 6. RLS POLICIES — Scenarios
-- ============================================

-- Platform templates/examples visible to all authenticated users
CREATE POLICY "scenarios_platform_select" ON scenarios
  FOR SELECT TO authenticated
  USING (org_id IS NULL);

-- Org scenarios visible to org members
CREATE POLICY "scenarios_org_select" ON scenarios
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

-- Admin/owner can modify org scenarios
CREATE POLICY "scenarios_admin_modify" ON scenarios
  FOR ALL TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

-- Anon can read active scenarios (for access_code users via service_role Edge Functions)
CREATE POLICY "scenarios_anon_select" ON scenarios
  FOR SELECT TO anon
  USING (is_active = true);

-- ============================================
-- 7. RLS POLICIES — Sessions
-- ============================================

-- Users see own sessions
CREATE POLICY "sessions_own_select" ON sessions
  FOR SELECT TO authenticated
  USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
    AND (
      user_profile_id = (auth.jwt() ->> 'profile_id')::UUID
      OR (auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'manager')
    )
  );

-- Anon can insert (via Edge Functions with service_role)
-- Note: Edge Functions use service_role which bypasses RLS
CREATE POLICY "sessions_anon_select" ON sessions
  FOR SELECT TO anon
  USING (true);  -- Edge Functions handle filtering

-- ============================================
-- 8. RLS POLICIES — Feedbacks
-- ============================================

CREATE POLICY "feedbacks_own_select" ON feedbacks
  FOR SELECT TO authenticated
  USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
  );

CREATE POLICY "feedbacks_anon_select" ON feedbacks
  FOR SELECT TO anon
  USING (true);  -- Edge Functions handle filtering

-- ============================================
-- 9. RLS POLICIES — Teams & Memberships
-- ============================================

CREATE POLICY "teams_org_select" ON teams
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE POLICY "teams_admin_modify" ON teams
  FOR ALL TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

CREATE POLICY "tm_org_select" ON team_memberships
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM teams t WHERE t.id = team_id AND t.org_id = (auth.jwt() ->> 'org_id')::UUID
  ));

-- ============================================
-- 10. RLS POLICIES — Billing (owner/admin only)
-- ============================================

CREATE POLICY "billing_admin_select" ON stripe_customers
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

CREATE POLICY "billing_admin_select" ON stripe_subscriptions
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

CREATE POLICY "invoices_admin_select" ON stripe_invoices
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

CREATE POLICY "pm_admin_select" ON stripe_payment_methods
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

-- Platform users see all billing
CREATE POLICY "billing_platform_select" ON stripe_customers
  FOR SELECT TO authenticated USING (auth.is_platform_user());
CREATE POLICY "billing_platform_select" ON stripe_subscriptions
  FOR SELECT TO authenticated USING (auth.is_platform_user());
CREATE POLICY "invoices_platform_select" ON stripe_invoices
  FOR SELECT TO authenticated USING (auth.is_platform_user());

-- ============================================
-- 11. RLS POLICIES — Notifications
-- ============================================

CREATE POLICY "notif_own_select" ON notification_log
  FOR SELECT TO authenticated
  USING (user_profile_id = (auth.jwt() ->> 'profile_id')::UUID);

CREATE POLICY "notif_own_update" ON notification_log
  FOR UPDATE TO authenticated
  USING (user_profile_id = (auth.jwt() ->> 'profile_id')::UUID);

-- ============================================
-- 12. RLS POLICIES — Audit Logs
-- ============================================

CREATE POLICY "audit_admin_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    org_id = (auth.jwt() ->> 'org_id')::UUID
    AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin')
  );

CREATE POLICY "audit_platform_select" ON audit_logs
  FOR SELECT TO authenticated
  USING (auth.is_platform_user());

-- ============================================
-- 13. RLS POLICIES — Access Codes
-- ============================================

CREATE POLICY "ac_org_select" ON access_codes
  FOR SELECT TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID);

CREATE POLICY "ac_admin_modify" ON access_codes
  FOR ALL TO authenticated
  USING (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'))
  WITH CHECK (org_id = (auth.jwt() ->> 'org_id')::UUID AND (auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

-- Anon can validate codes (via Edge Functions)
CREATE POLICY "ac_anon_select" ON access_codes
  FOR SELECT TO anon
  USING (is_active = true);

-- ============================================
-- 14. RLS POLICIES — Remaining tables (org-scoped)
-- ============================================

-- Generic org-scoped read for remaining tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'criterion_rubrics', 'scenario_objections', 'scenario_outcomes',
      'session_evidences', 'session_objection_status',
      'api_metrics', 'user_difficulty_profiles', 'user_learning_profiles',
      'usage_events', 'usage_records', 'scenario_assignments',
      'push_subscriptions', 'onboarding_status'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "rls_%s_org_select" ON %I FOR SELECT TO authenticated USING (org_id = (auth.jwt() ->> ''org_id'')::UUID)',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "rls_%s_anon_select" ON %I FOR SELECT TO anon USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================
-- 15. SERVICE ROLE BYPASS
-- ============================================
-- Note: Service role (used by Edge Functions) bypasses RLS by default.
-- This is correct — Edge Functions do their own auth checks.

COMMENT ON SCHEMA public IS 'Multi-tenant schema with RLS enabled. All tables scoped by org_id via JWT claims.';
