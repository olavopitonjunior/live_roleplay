-- Migration 028: Usage, Signup, Compliance, and Mobile Tables
-- Phase 1 of multi-tenant migration
--
-- Creates: usage_events, usage_records, signup_leads, onboarding_status,
--          audit_logs (partitioned), data_retention_policies, data_deletion_requests,
--          push_subscriptions, notification_log, session_resumption_tokens

-- ============================================
-- USAGE TABLES
-- ============================================

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL
    CHECK (event_type IN ('session_fee','extra_time','token_usage','avatar_time')),
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  total_cost_cents INTEGER GENERATED ALWAYS AS (ROUND(quantity * unit_cost_cents)::INTEGER) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ue_org ON usage_events(org_id, created_at DESC);
CREATE INDEX idx_ue_session ON usage_events(session_id);

COMMENT ON TABLE usage_events IS 'Granular usage events for billing. Aggregated into usage_records monthly.';

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  period DATE NOT NULL CHECK (period = date_trunc('month', period)::date),
  sessions_count INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  realtime_tokens_used BIGINT DEFAULT 0,
  text_api_tokens_used BIGINT DEFAULT 0,
  claude_tokens_used BIGINT DEFAULT 0,
  avatar_minutes NUMERIC(10,2) DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, period)
);

CREATE INDEX idx_ur_org ON usage_records(org_id, period DESC);

COMMENT ON TABLE usage_records IS 'Monthly usage aggregates per org. NEVER deleted — permanent billing history.';

-- ============================================
-- SIGNUP & ONBOARDING
-- ============================================

CREATE TABLE signup_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  company_name VARCHAR(200),
  phone VARCHAR(30),
  source VARCHAR(50),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  landing_page VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','signup_started','payment_pending','payment_completed',
                      'org_created','onboarding','active','abandoned','demo_requested')),
  intended_plan_id UUID REFERENCES plans(id),
  stripe_checkout_session_id VARCHAR(255),
  org_id UUID REFERENCES organizations(id),
  converted_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  demo_notes TEXT,
  demo_scheduled_at TIMESTAMPTZ,
  assigned_sales_rep UUID REFERENCES platform_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON signup_leads(status, created_at DESC);
CREATE INDEX idx_leads_email ON signup_leads(email);

COMMENT ON TABLE signup_leads IS 'Signup funnel tracking: lead → signup → trial → active → paid.';

CREATE TABLE onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id),
  org_profile_completed_at TIMESTAMPTZ,
  first_user_invited_at TIMESTAMPTZ,
  first_scenario_created_at TIMESTAMPTZ,
  first_session_completed_at TIMESTAMPTZ,
  billing_setup_at TIMESTAMPTZ,
  steps_completed INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 5,
  is_complete BOOLEAN GENERATED ALWAYS AS (steps_completed >= total_steps) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE onboarding_status IS 'Tracks org onboarding wizard progress (4-5 steps).';

-- ============================================
-- COMPLIANCE: AUDIT LOGS (Partitioned by month)
-- ============================================

CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 3 months
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX idx_al_org_time ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_al_action ON audit_logs(action, created_at DESC);

COMMENT ON TABLE audit_logs IS 'Partitioned audit log. Monthly partitions created by pg_cron. Longer retention than 90 days.';

CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  resource_type VARCHAR(50) NOT NULL,
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days >= 90),
  action VARCHAR(20) DEFAULT 'delete'
    CHECK (action IN ('delete','archive','anonymize')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, resource_type)
);

COMMENT ON TABLE data_retention_policies IS 'Per-org data retention config. Min 90 days (LGPD).';

CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES user_profiles(id),
  request_type VARCHAR(20) NOT NULL
    CHECK (request_type IN ('full_deletion','anonymization','data_export')),
  scope JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  completed_at TIMESTAMPTZ,
  proof JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE data_deletion_requests IS 'LGPD/DSAR requests: deletion, anonymization, data export.';

-- ============================================
-- MOBILE / NOTIFICATIONS
-- ============================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id),
  endpoint TEXT,
  p256dh_key TEXT,
  auth_key TEXT,
  device_token TEXT,
  platform VARCHAR(20) CHECK (platform IN ('web','ios','android')),
  device_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_profile_id, endpoint)
);

CREATE INDEX idx_ps_user ON push_subscriptions(user_profile_id);

COMMENT ON TABLE push_subscriptions IS 'Push notification subscriptions for PWA/mobile.';

CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  notification_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notif_unread ON notification_log(user_profile_id, is_read, sent_at DESC) WHERE NOT is_read;
CREATE INDEX idx_notif_user ON notification_log(user_profile_id, sent_at DESC);

COMMENT ON TABLE notification_log IS 'In-app notification feed. Also triggers push via send-notification Edge Function.';

CREATE TABLE session_resumption_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id),
  room_name VARCHAR(100) NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_srt_session ON session_resumption_tokens(session_id);

COMMENT ON TABLE session_resumption_tokens IS 'Pre-generated tokens for mobile session resumption after disconnect.';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_resumption_tokens ENABLE ROW LEVEL SECURITY;

-- Service role: full access on all
CREATE POLICY "usage_events_service_role_all" ON usage_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "usage_records_service_role_all" ON usage_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "signup_leads_service_role_all" ON signup_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "onboarding_status_service_role_all" ON onboarding_status FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_service_role_all" ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "data_retention_policies_service_role_all" ON data_retention_policies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "data_deletion_requests_service_role_all" ON data_deletion_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "push_subscriptions_service_role_all" ON push_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "notification_log_service_role_all" ON notification_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "session_resumption_tokens_service_role_all" ON session_resumption_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No anon access for usage/billing/compliance/notification tables
-- These are accessed via Edge Functions (service_role) only

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER signup_leads_updated_at BEFORE UPDATE ON signup_leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER onboarding_status_updated_at BEFORE UPDATE ON onboarding_status FOR EACH ROW EXECUTE FUNCTION update_updated_at();
