-- Migration 026: Platform Admin Tables
-- Phase 1 of multi-tenant migration
--
-- Creates: platform_users, platform_audit_logs, tenant_cost_snapshots,
--          system_health_metrics, platform_alerts
--
-- These tables are for Live Roleplay internal staff (separate from tenant users).

-- ============================================
-- 1. PLATFORM_USERS
-- ============================================

CREATE TABLE platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin','admin','support','finance','viewer')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_users IS 'Live Roleplay internal staff. Separate auth domain from tenant users.';

-- ============================================
-- 2. PLATFORM_AUDIT_LOGS
-- ============================================

CREATE TABLE platform_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  platform_user_id UUID NOT NULL REFERENCES platform_users(id),
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  tenant_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pal_tenant ON platform_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_pal_action ON platform_audit_logs(action, created_at DESC);

COMMENT ON TABLE platform_audit_logs IS 'Audit trail for platform staff actions (suspend tenant, edit plan, etc).';

-- ============================================
-- 3. TENANT_COST_SNAPSHOTS
-- ============================================

CREATE TABLE tenant_cost_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  snapshot_date DATE NOT NULL,
  sessions_count INTEGER DEFAULT 0,
  sessions_duration_seconds INTEGER DEFAULT 0,
  openai_realtime_cost_cents INTEGER DEFAULT 0,
  openai_text_cost_cents INTEGER DEFAULT 0,
  claude_cost_cents INTEGER DEFAULT 0,
  livekit_cost_cents INTEGER DEFAULT 0,
  avatar_cost_cents INTEGER DEFAULT 0,
  total_cost_cents INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  margin_cents INTEGER GENERATED ALWAYS AS (total_revenue_cents - total_cost_cents) STORED,
  token_breakdown JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, snapshot_date)
);

CREATE INDEX idx_tcs_org_date ON tenant_cost_snapshots(org_id, snapshot_date DESC);

COMMENT ON TABLE tenant_cost_snapshots IS 'Daily cost snapshot per tenant. Populated by pg_cron job.';

-- ============================================
-- 4. SYSTEM_HEALTH_METRICS
-- ============================================

CREATE TABLE system_health_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_name VARCHAR(80) NOT NULL,
  metric_value NUMERIC(12,4) NOT NULL,
  tags JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shm_name_time ON system_health_metrics(metric_name, recorded_at DESC);

COMMENT ON TABLE system_health_metrics IS 'System health metrics (API latencies, error rates, etc). Written by monitoring cron.';

-- ============================================
-- 5. PLATFORM_ALERTS
-- ============================================

CREATE TABLE platform_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning'
    CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  details JSONB,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES platform_users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_unacked ON platform_alerts(is_acknowledged, created_at DESC) WHERE NOT is_acknowledged;
CREATE INDEX idx_alerts_org ON platform_alerts(org_id, created_at DESC);

COMMENT ON TABLE platform_alerts IS 'Platform alerts: failed payments, high costs, errors, inactivity.';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_cost_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "platform_users_service_role_all" ON platform_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "platform_audit_logs_service_role_all" ON platform_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "tenant_cost_snapshots_service_role_all" ON tenant_cost_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "system_health_metrics_service_role_all" ON system_health_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "platform_alerts_service_role_all" ON platform_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Platform tables: NO anon access. Only service_role and authenticated platform users.
-- Phase 4 will add JWT-based platform user policies.

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER platform_users_updated_at
  BEFORE UPDATE ON platform_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
