-- Migration 032: Seed Plans and Plan Versions
-- Phase 3 of multi-tenant migration
--
-- Creates initial plans with published versions.
-- Stripe price IDs are placeholders — update after creating prices in Stripe.

-- ============================================
-- 1. PLANS
-- ============================================

INSERT INTO plans (slug, display_name, description, sort_order, is_public)
VALUES
  ('starter', 'Starter', 'Para equipes pequenas comecando com treinamento de vendas AI', 1, true),
  ('professional', 'Professional', 'Para equipes em crescimento com necessidades avancadas de treinamento', 2, true),
  ('enterprise', 'Enterprise', 'Para grandes organizacoes com requisitos personalizados', 3, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. PLAN VERSIONS (v1 for each plan)
-- ============================================

-- Starter: R$99/mês
INSERT INTO plan_versions (
  plan_id, version_number, status,
  base_fee_cents, currency, billing_interval,
  stripe_price_id_monthly, stripe_price_id_yearly,
  included_sessions, included_tokens, included_livekit_minutes,
  overage_per_session_cents, overage_per_extra_minute_cents, overage_per_1k_tokens_cents,
  features, published_at
)
SELECT
  id, 1, 'published',
  9900, 'brl', 'month',
  'price_starter_monthly_PLACEHOLDER', 'price_starter_yearly_PLACEHOLDER',
  100, 500000, 500,
  250, 80, 5,
  '{
    "max_users": 10,
    "max_teams": 2,
    "max_scenarios": 20,
    "max_session_duration_seconds": 300,
    "coach_enabled": true,
    "analytics_export": false,
    "api_access": false,
    "sso": false,
    "custom_avatars": false,
    "white_label": false,
    "priority_support": false,
    "custom_rubrics": true,
    "ai_scenario_generation": true,
    "manager_dashboard": false,
    "usage_discount_percent": 0,
    "trial_days": 14
  }'::JSONB,
  NOW()
FROM plans WHERE slug = 'starter'
ON CONFLICT (plan_id, version_number) DO NOTHING;

-- Professional: R$299/mês
INSERT INTO plan_versions (
  plan_id, version_number, status,
  base_fee_cents, currency, billing_interval,
  stripe_price_id_monthly, stripe_price_id_yearly,
  included_sessions, included_tokens, included_livekit_minutes,
  overage_per_session_cents, overage_per_extra_minute_cents, overage_per_1k_tokens_cents,
  features, published_at
)
SELECT
  id, 1, 'published',
  29900, 'brl', 'month',
  'price_pro_monthly_PLACEHOLDER', 'price_pro_yearly_PLACEHOLDER',
  500, 2000000, 2500,
  200, 60, 4,
  '{
    "max_users": 50,
    "max_teams": 10,
    "max_scenarios": 100,
    "max_session_duration_seconds": 600,
    "coach_enabled": true,
    "analytics_export": true,
    "api_access": false,
    "sso": false,
    "custom_avatars": true,
    "white_label": false,
    "priority_support": true,
    "custom_rubrics": true,
    "ai_scenario_generation": true,
    "manager_dashboard": true,
    "usage_discount_percent": 10,
    "trial_days": 14
  }'::JSONB,
  NOW()
FROM plans WHERE slug = 'professional'
ON CONFLICT (plan_id, version_number) DO NOTHING;

-- Enterprise: R$999/mês
INSERT INTO plan_versions (
  plan_id, version_number, status,
  base_fee_cents, currency, billing_interval,
  stripe_price_id_monthly, stripe_price_id_yearly,
  included_sessions, included_tokens, included_livekit_minutes,
  overage_per_session_cents, overage_per_extra_minute_cents, overage_per_1k_tokens_cents,
  features, published_at
)
SELECT
  id, 1, 'published',
  99900, 'brl', 'month',
  'price_enterprise_monthly_PLACEHOLDER', 'price_enterprise_yearly_PLACEHOLDER',
  0, 0, 0,  -- 0 = unlimited
  0, 0, 0,  -- no overage (unlimited)
  '{
    "max_users": 0,
    "max_teams": 0,
    "max_scenarios": 0,
    "max_session_duration_seconds": 900,
    "coach_enabled": true,
    "analytics_export": true,
    "api_access": true,
    "sso": false,
    "custom_avatars": true,
    "white_label": false,
    "priority_support": true,
    "custom_rubrics": true,
    "ai_scenario_generation": true,
    "manager_dashboard": true,
    "usage_discount_percent": 20,
    "trial_days": 14
  }'::JSONB,
  NOW()
FROM plans WHERE slug = 'enterprise'
ON CONFLICT (plan_id, version_number) DO NOTHING;

-- ============================================
-- 3. DOCUMENTATION
-- ============================================

COMMENT ON TABLE plans IS 'Subscription plans. Slugs: starter, professional, enterprise.';
COMMENT ON TABLE plan_versions IS 'Versioned plan pricing. Only one published version per plan (enforced by partial unique index).';
