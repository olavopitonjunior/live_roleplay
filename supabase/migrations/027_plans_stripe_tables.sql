-- Migration 027: Plans & Stripe Billing Tables
-- Phase 1 of multi-tenant migration
--
-- Creates: plans, plan_versions, stripe_customers, stripe_subscriptions,
--          stripe_invoices, stripe_payment_methods, stripe_webhook_events

-- ============================================
-- 1. PLANS
-- ============================================

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,  -- 'starter', 'professional', 'enterprise'
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,  -- visible on pricing page
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE plans IS 'Plan catalog. Each plan has one or more versions with pricing.';

-- ============================================
-- 2. PLAN_VERSIONS
-- ============================================

CREATE TABLE plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft','published','sunset','archived')),
  -- Pricing
  base_fee_cents INTEGER NOT NULL CHECK (base_fee_cents >= 0),
  currency VARCHAR(3) DEFAULT 'brl',
  billing_interval VARCHAR(10) DEFAULT 'month'
    CHECK (billing_interval IN ('month','year')),
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_yearly VARCHAR(255),
  stripe_metered_price_id VARCHAR(255),
  -- Quotas (included in base fee, 0 = unlimited)
  included_sessions INTEGER DEFAULT 0,
  included_tokens INTEGER DEFAULT 0,
  included_livekit_minutes INTEGER DEFAULT 0,
  -- Overage pricing (centavos per unit)
  overage_per_session_cents INTEGER DEFAULT 250,
  overage_per_extra_minute_cents INTEGER DEFAULT 80,
  overage_per_1k_tokens_cents INTEGER DEFAULT 5,
  -- Feature flags
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Metadata
  changelog TEXT,
  published_at TIMESTAMPTZ,
  sunset_at TIMESTAMPTZ,
  published_by UUID REFERENCES platform_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, version_number)
);

-- Only ONE published version per plan at a time
CREATE UNIQUE INDEX idx_pv_published ON plan_versions(plan_id) WHERE status = 'published';

COMMENT ON TABLE plan_versions IS 'Immutable plan versions. Only one published per plan. Existing subscribers pinned to their version until renewal.';
COMMENT ON COLUMN plan_versions.features IS 'Feature flags: max_users, max_teams, max_scenarios, coach_enabled, analytics_export, api_access, sso, custom_avatars, white_label, etc.';

-- ============================================
-- 3. STRIPE_CUSTOMERS
-- ============================================

CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE stripe_customers IS 'Maps org to Stripe customer. One Stripe customer per org.';

-- ============================================
-- 4. STRIPE_SUBSCRIPTIONS
-- ============================================

CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255) NOT NULL,
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id),
  status VARCHAR(30) NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete','incomplete_expired','trialing','active',
                      'past_due','canceled','unpaid','paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  stripe_metered_item_id VARCHAR(255),
  stripe_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active/trialing/past_due subscription per org
CREATE UNIQUE INDEX idx_ss_active ON stripe_subscriptions(org_id)
  WHERE status IN ('active','trialing','past_due');

COMMENT ON TABLE stripe_subscriptions IS 'Stripe subscription state machine. Synced via webhooks.';

-- ============================================
-- 5. STRIPE_INVOICES
-- ============================================

CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(30) NOT NULL
    CHECK (status IN ('draft','open','paid','void','uncollectible')),
  amount_due_cents INTEGER DEFAULT 0,
  amount_paid_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'brl',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  invoice_pdf_url TEXT,
  hosted_invoice_url TEXT,
  stripe_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_si_org ON stripe_invoices(org_id, created_at DESC);

COMMENT ON TABLE stripe_invoices IS 'Stripe invoice records. Synced from Stripe webhooks.';

-- ============================================
-- 6. STRIPE_PAYMENT_METHODS
-- ============================================

CREATE TABLE stripe_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(30) DEFAULT 'card',
  is_default BOOLEAN DEFAULT false,
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_exp_month SMALLINT,
  card_exp_year SMALLINT,
  billing_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spm_org ON stripe_payment_methods(org_id);

COMMENT ON TABLE stripe_payment_methods IS 'Payment methods attached to Stripe customer.';

-- ============================================
-- 7. STRIPE_WEBHOOK_EVENTS
-- ============================================

CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  livemode BOOLEAN DEFAULT true,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_swe_unprocessed ON stripe_webhook_events(processed) WHERE NOT processed;
CREATE INDEX idx_swe_type ON stripe_webhook_events(event_type, created_at DESC);

COMMENT ON TABLE stripe_webhook_events IS 'Idempotent webhook event log. Deduplication via stripe_event_id UNIQUE.';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "plans_service_role_all" ON plans FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "plan_versions_service_role_all" ON plan_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "stripe_customers_service_role_all" ON stripe_customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "stripe_subscriptions_service_role_all" ON stripe_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "stripe_invoices_service_role_all" ON stripe_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "stripe_payment_methods_service_role_all" ON stripe_payment_methods FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "stripe_webhook_events_service_role_all" ON stripe_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Plans: public read (for pricing page)
CREATE POLICY "plans_anon_select" ON plans FOR SELECT TO anon, authenticated USING (is_public = true AND NOT is_archived);
CREATE POLICY "plan_versions_anon_select" ON plan_versions FOR SELECT TO anon, authenticated USING (status = 'published');

-- Stripe tables: NO anon access (billing data is private, accessed via Edge Functions)

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stripe_customers_updated_at BEFORE UPDATE ON stripe_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stripe_subscriptions_updated_at BEFORE UPDATE ON stripe_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stripe_invoices_updated_at BEFORE UPDATE ON stripe_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stripe_payment_methods_updated_at BEFORE UPDATE ON stripe_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED: Default Plans
-- ============================================

INSERT INTO plans (slug, display_name, description, sort_order, is_public) VALUES
  ('trial', 'Trial', 'Free 14-day trial with limited sessions', 0, false),
  ('starter', 'Starter', 'For small teams getting started with AI roleplay training', 1, true),
  ('professional', 'Professional', 'For growing teams with advanced analytics and coaching', 2, true),
  ('enterprise', 'Enterprise', 'For large organizations with custom needs', 3, true);

-- Seed: Published version for each plan
INSERT INTO plan_versions (plan_id, version_number, status, base_fee_cents, currency, billing_interval,
  included_sessions, included_tokens, included_livekit_minutes,
  overage_per_session_cents, overage_per_extra_minute_cents, overage_per_1k_tokens_cents,
  features, published_at) VALUES
-- Trial: free
((SELECT id FROM plans WHERE slug='trial'), 1, 'published', 0, 'brl', 'month',
  10, 0, 30, 0, 0, 0,
  '{"max_users": 1, "max_teams": 0, "max_scenarios": 5, "max_session_duration_seconds": 180, "coach_enabled": false, "analytics_export": false, "api_access": false, "sso": false, "custom_avatars": false, "white_label": false, "priority_support": false, "custom_rubrics": false, "ai_scenario_generation": false, "manager_dashboard": false}'::jsonb,
  NOW()),
-- Starter: R$99/mo
((SELECT id FROM plans WHERE slug='starter'), 1, 'published', 9900, 'brl', 'month',
  100, 0, 200, 250, 80, 5,
  '{"max_users": 10, "max_teams": 2, "max_scenarios": 20, "max_session_duration_seconds": 300, "coach_enabled": true, "analytics_export": false, "api_access": false, "sso": false, "custom_avatars": false, "white_label": false, "priority_support": false, "custom_rubrics": true, "ai_scenario_generation": true, "manager_dashboard": false, "usage_discount_percent": 0}'::jsonb,
  NOW()),
-- Professional: R$299/mo
((SELECT id FROM plans WHERE slug='professional'), 1, 'published', 29900, 'brl', 'month',
  500, 0, 1000, 200, 60, 4,
  '{"max_users": 50, "max_teams": 10, "max_scenarios": 100, "max_session_duration_seconds": 600, "coach_enabled": true, "analytics_export": true, "api_access": false, "sso": false, "custom_avatars": true, "white_label": false, "priority_support": true, "custom_rubrics": true, "ai_scenario_generation": true, "manager_dashboard": true, "usage_discount_percent": 10}'::jsonb,
  NOW()),
-- Enterprise: R$999/mo
((SELECT id FROM plans WHERE slug='enterprise'), 1, 'published', 99900, 'brl', 'month',
  0, 0, 0, 150, 40, 3,
  '{"max_users": 0, "max_teams": 0, "max_scenarios": 0, "max_session_duration_seconds": 900, "coach_enabled": true, "analytics_export": true, "api_access": true, "sso": true, "custom_avatars": true, "white_label": true, "priority_support": true, "custom_rubrics": true, "ai_scenario_generation": true, "manager_dashboard": true, "usage_discount_percent": 20}'::jsonb,
  NOW());
