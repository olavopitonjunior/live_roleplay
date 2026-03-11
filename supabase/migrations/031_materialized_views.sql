-- Migration 031: Materialized Views for Dashboards
-- Phase 1 of multi-tenant migration
--
-- Creates 6 materialized views used by dashboards:
-- 1. mv_org_dashboard_stats — Daily org metrics (trainee/manager/admin dashboards)
-- 2. mv_team_member_performance — Per-user team stats (manager dashboard)
-- 3. mv_tenant_health — Per-tenant health for platform admin
-- 4. mv_platform_overview — Platform-wide KPIs
-- 5. mv_platform_cost_breakdown — Per-tenant daily cost
-- 6. mv_scenario_effectiveness — Per-scenario metrics
--
-- NOTE: These views depend on org_id columns (migration 029).
-- During Phase 1 (org_id NULLABLE), views handle NULLs gracefully.
-- After Phase 4 cutover (org_id NOT NULL), NULLs disappear.

-- ============================================
-- 1. ORG DASHBOARD STATS
-- Used by: Trainee, Manager, Owner, Admin dashboards
-- Refresh: Every 15 minutes via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_org_dashboard_stats AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  o.status AS org_status,

  -- User counts
  (SELECT COUNT(*) FROM user_profiles up WHERE up.org_id = o.id AND up.is_active = true) AS active_users,
  (SELECT COUNT(*) FROM user_profiles up WHERE up.org_id = o.id AND up.is_active = true AND up.role = 'trainee') AS active_trainees,
  (SELECT COUNT(*) FROM teams t WHERE t.org_id = o.id AND t.is_active = true) AS active_teams,

  -- Session metrics (last 30 days)
  (SELECT COUNT(*)
   FROM sessions s
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days') AS sessions_30d,

  (SELECT COALESCE(AVG(s.duration_seconds), 0)
   FROM sessions s
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days') AS avg_duration_30d,

  -- Feedback metrics (last 30 days)
  (SELECT COALESCE(AVG(f.score), 0)
   FROM feedbacks f
   JOIN sessions s ON s.id = f.session_id
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days'
     AND f.score IS NOT NULL) AS avg_score_30d,

  -- Session metrics (last 7 days for trend)
  (SELECT COUNT(*)
   FROM sessions s
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '7 days') AS sessions_7d,

  (SELECT COALESCE(AVG(f.score), 0)
   FROM feedbacks f
   JOIN sessions s ON s.id = f.session_id
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '7 days'
     AND f.score IS NOT NULL) AS avg_score_7d,

  -- Scenario stats
  (SELECT COUNT(*)
   FROM scenarios sc
   WHERE sc.org_id = o.id AND sc.is_active = true) AS active_scenarios,

  -- Assignment stats
  (SELECT COUNT(*)
   FROM scenario_assignments sa
   WHERE sa.org_id = o.id AND sa.status IN ('pending','in_progress')) AS pending_assignments,

  (SELECT COUNT(*)
   FROM scenario_assignments sa
   WHERE sa.org_id = o.id AND sa.status = 'completed') AS completed_assignments,

  -- Usage (current month)
  (SELECT COALESCE(ur.total_cost_cents, 0)
   FROM usage_records ur
   WHERE ur.org_id = o.id
     AND ur.period = date_trunc('month', NOW())::date) AS current_month_cost_cents,

  NOW() AS refreshed_at

FROM organizations o
WHERE o.status IN ('active', 'trialing');

CREATE UNIQUE INDEX idx_mv_ods_org ON mv_org_dashboard_stats(org_id);

COMMENT ON MATERIALIZED VIEW mv_org_dashboard_stats IS
  'Org-level dashboard KPIs. Refresh every 15 min via pg_cron.';

-- ============================================
-- 2. TEAM MEMBER PERFORMANCE
-- Used by: Manager dashboard, team detail pages
-- Refresh: Daily via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_team_member_performance AS
SELECT
  tm.team_id,
  tm.user_id AS user_profile_id,
  up.full_name,
  up.email,
  up.role,
  up.org_id,
  t.name AS team_name,

  -- Session metrics (last 30 days)
  COUNT(s.id) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
  ) AS sessions_30d,

  COALESCE(AVG(s.duration_seconds) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
  ), 0) AS avg_duration_30d,

  -- Feedback metrics (last 30 days)
  COALESCE(AVG(f.score) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
      AND f.score IS NOT NULL
  ), 0) AS avg_score_30d,

  -- Best score (last 30 days)
  MAX(f.score) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
  ) AS best_score_30d,

  -- Score trend: avg last 7d vs previous 7d
  COALESCE(AVG(f.score) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '7 days'
      AND f.score IS NOT NULL
  ), 0) AS avg_score_7d,

  COALESCE(AVG(f.score) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '14 days'
      AND s.started_at < NOW() - INTERVAL '7 days'
      AND f.score IS NOT NULL
  ), 0) AS avg_score_prev_7d,

  -- Assignment completion
  COUNT(sa.id) FILTER (WHERE sa.status = 'completed') AS assignments_completed,
  COUNT(sa.id) FILTER (WHERE sa.status IN ('pending','in_progress')) AS assignments_pending,

  -- Last session date
  MAX(s.started_at) FILTER (WHERE s.status = 'completed') AS last_session_at,

  up.last_seen_at,
  NOW() AS refreshed_at

FROM team_memberships tm
JOIN user_profiles up ON up.id = tm.user_id AND up.is_active = true
JOIN teams t ON t.id = tm.team_id AND t.is_active = true
LEFT JOIN sessions s ON s.user_profile_id = up.id
LEFT JOIN feedbacks f ON f.session_id = s.id
LEFT JOIN scenario_assignments sa ON sa.assigned_to = up.id AND sa.org_id = up.org_id

GROUP BY tm.team_id, tm.user_id, up.full_name, up.email, up.role, up.org_id,
         t.name, up.last_seen_at;

CREATE UNIQUE INDEX idx_mv_tmp_team_user ON mv_team_member_performance(team_id, user_profile_id);
CREATE INDEX idx_mv_tmp_org ON mv_team_member_performance(org_id);

COMMENT ON MATERIALIZED VIEW mv_team_member_performance IS
  'Per-member team stats for manager dashboard. Refresh daily via pg_cron.';

-- ============================================
-- 3. TENANT HEALTH
-- Used by: Platform admin tenant list + detail
-- Refresh: Every 5 minutes via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_tenant_health AS
SELECT
  o.id AS org_id,
  o.name AS org_name,
  o.slug,
  o.status AS org_status,
  o.created_at AS org_created_at,
  o.trial_ends_at,

  -- Plan info
  pv.id AS plan_version_id,
  p.slug AS plan_slug,
  p.display_name AS plan_name,

  -- Subscription status
  ss.status AS subscription_status,
  ss.current_period_end,

  -- User counts
  (SELECT COUNT(*) FROM user_profiles up WHERE up.org_id = o.id AND up.is_active = true) AS active_users,

  -- Activity (last 7 days)
  (SELECT COUNT(*)
   FROM sessions s
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '7 days') AS sessions_7d,

  -- Activity (last 30 days)
  (SELECT COUNT(*)
   FROM sessions s
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days') AS sessions_30d,

  -- Avg score (last 30 days)
  (SELECT COALESCE(AVG(f.score), 0)
   FROM feedbacks f
   JOIN sessions s ON s.id = f.session_id
   WHERE s.org_id = o.id
     AND s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days'
     AND f.score IS NOT NULL) AS avg_score_30d,

  -- Cost (current month)
  (SELECT COALESCE(tcs.total_cost_cents, 0)
   FROM tenant_cost_snapshots tcs
   WHERE tcs.org_id = o.id
   ORDER BY tcs.snapshot_date DESC
   LIMIT 1) AS latest_cost_cents,

  -- Revenue (current period)
  (SELECT COALESCE(si.amount_paid_cents, 0)
   FROM stripe_invoices si
   WHERE si.org_id = o.id AND si.status = 'paid'
   ORDER BY si.created_at DESC
   LIMIT 1) AS latest_revenue_cents,

  -- Health classification
  CASE
    WHEN o.status IN ('suspended','deletion_pending','deleted') THEN 'critical'
    WHEN o.status = 'grace_period' THEN 'at_risk'
    WHEN (SELECT COUNT(*) FROM sessions s WHERE s.org_id = o.id AND s.started_at >= NOW() - INTERVAL '14 days') = 0
      THEN 'inactive'
    WHEN ss.status = 'past_due' THEN 'at_risk'
    ELSE 'healthy'
  END AS health_status,

  NOW() AS refreshed_at

FROM organizations o
LEFT JOIN stripe_subscriptions ss ON ss.org_id = o.id
  AND ss.status IN ('active','trialing','past_due')
LEFT JOIN plan_versions pv ON pv.id = ss.plan_version_id
LEFT JOIN plans p ON p.id = pv.plan_id
WHERE o.status != 'deleted';

CREATE UNIQUE INDEX idx_mv_th_org ON mv_tenant_health(org_id);
CREATE INDEX idx_mv_th_health ON mv_tenant_health(health_status);

COMMENT ON MATERIALIZED VIEW mv_tenant_health IS
  'Per-tenant health for platform admin. Refresh every 5 min via pg_cron.';

-- ============================================
-- 4. PLATFORM OVERVIEW
-- Used by: Platform admin dashboard (KPIs)
-- Refresh: Every 5 minutes via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_platform_overview AS
SELECT
  -- Tenant counts
  COUNT(*) FILTER (WHERE o.status IN ('active','trialing')) AS total_active_tenants,
  COUNT(*) FILTER (WHERE o.status = 'trialing') AS trialing_tenants,
  COUNT(*) FILTER (WHERE o.status = 'active') AS active_tenants,
  COUNT(*) FILTER (WHERE o.status = 'suspended') AS suspended_tenants,
  COUNT(*) FILTER (WHERE o.status = 'churned') AS churned_tenants,

  -- Total users (across all tenants)
  (SELECT COUNT(*) FROM user_profiles WHERE is_active = true) AS total_active_users,

  -- Sessions (24h)
  (SELECT COUNT(*)
   FROM sessions
   WHERE status = 'completed'
     AND started_at >= NOW() - INTERVAL '24 hours') AS sessions_24h,

  -- Sessions (7d)
  (SELECT COUNT(*)
   FROM sessions
   WHERE status = 'completed'
     AND started_at >= NOW() - INTERVAL '7 days') AS sessions_7d,

  -- Sessions (30d)
  (SELECT COUNT(*)
   FROM sessions
   WHERE status = 'completed'
     AND started_at >= NOW() - INTERVAL '30 days') AS sessions_30d,

  -- Avg score (30d)
  (SELECT COALESCE(AVG(f.score), 0)
   FROM feedbacks f
   JOIN sessions s ON s.id = f.session_id
   WHERE s.status = 'completed'
     AND s.started_at >= NOW() - INTERVAL '30 days'
     AND f.score IS NOT NULL) AS avg_score_30d,

  -- Revenue (MRR estimate = sum of last paid invoices per org)
  (SELECT COALESCE(SUM(latest.amount_paid_cents), 0)
   FROM (
     SELECT DISTINCT ON (si.org_id) si.amount_paid_cents
     FROM stripe_invoices si
     WHERE si.status = 'paid'
     ORDER BY si.org_id, si.created_at DESC
   ) latest) AS estimated_mrr_cents,

  -- Total cost (current month across all tenants)
  (SELECT COALESCE(SUM(ur.total_cost_cents), 0)
   FROM usage_records ur
   WHERE ur.period = date_trunc('month', NOW())::date) AS current_month_cost_cents,

  -- Signup leads (this month)
  (SELECT COUNT(*)
   FROM signup_leads
   WHERE created_at >= date_trunc('month', NOW())) AS leads_this_month,

  -- Conversion rate (leads → active, last 90 days)
  (SELECT CASE
     WHEN COUNT(*) = 0 THEN 0
     ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'active') / COUNT(*))
   END
   FROM signup_leads
   WHERE created_at >= NOW() - INTERVAL '90 days') AS conversion_rate_90d,

  -- Active alerts
  (SELECT COUNT(*)
   FROM platform_alerts
   WHERE is_acknowledged = false) AS unacknowledged_alerts,

  NOW() AS refreshed_at

FROM organizations o;

-- Single row, no unique index needed but add one for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_po_singleton ON mv_platform_overview((1));

COMMENT ON MATERIALIZED VIEW mv_platform_overview IS
  'Platform-wide KPIs for admin dashboard. Refresh every 5 min via pg_cron.';

-- ============================================
-- 5. PLATFORM COST BREAKDOWN
-- Used by: Platform costs page, tenant detail
-- Refresh: Daily via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_platform_cost_breakdown AS
SELECT
  tcs.org_id,
  o.name AS org_name,
  o.slug,
  tcs.snapshot_date,
  tcs.sessions_count,
  tcs.sessions_duration_seconds,
  tcs.openai_realtime_cost_cents,
  tcs.openai_text_cost_cents,
  tcs.claude_cost_cents,
  tcs.livekit_cost_cents,
  tcs.avatar_cost_cents,
  tcs.total_cost_cents,
  tcs.total_revenue_cents,
  tcs.margin_cents,

  -- Plan context
  p.slug AS plan_slug,
  p.display_name AS plan_name,

  NOW() AS refreshed_at

FROM tenant_cost_snapshots tcs
JOIN organizations o ON o.id = tcs.org_id
LEFT JOIN stripe_subscriptions ss ON ss.org_id = o.id
  AND ss.status IN ('active','trialing','past_due')
LEFT JOIN plan_versions pv ON pv.id = ss.plan_version_id
LEFT JOIN plans p ON p.id = pv.plan_id
WHERE tcs.snapshot_date >= NOW() - INTERVAL '90 days';

CREATE UNIQUE INDEX idx_mv_pcb_org_date ON mv_platform_cost_breakdown(org_id, snapshot_date);
CREATE INDEX idx_mv_pcb_date ON mv_platform_cost_breakdown(snapshot_date DESC);

COMMENT ON MATERIALIZED VIEW mv_platform_cost_breakdown IS
  'Per-tenant daily cost for last 90 days. Refresh daily via pg_cron.';

-- ============================================
-- 6. SCENARIO EFFECTIVENESS
-- Used by: Org analytics, platform scenario management
-- Refresh: Daily via pg_cron
-- ============================================

CREATE MATERIALIZED VIEW mv_scenario_effectiveness AS
SELECT
  sc.id AS scenario_id,
  sc.org_id,
  sc.title AS scenario_title,
  sc.category,
  sc.session_type,
  sc.is_template,
  sc.visibility,

  -- Total sessions (all time)
  COUNT(s.id) FILTER (WHERE s.status = 'completed') AS total_sessions,

  -- Sessions (last 30 days)
  COUNT(s.id) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
  ) AS sessions_30d,

  -- Average score
  COALESCE(AVG(f.score) FILTER (
    WHERE s.status = 'completed' AND f.score IS NOT NULL
  ), 0) AS avg_score_all_time,

  COALESCE(AVG(f.score) FILTER (
    WHERE s.status = 'completed'
      AND s.started_at >= NOW() - INTERVAL '30 days'
      AND f.score IS NOT NULL
  ), 0) AS avg_score_30d,

  -- Average duration
  COALESCE(AVG(s.duration_seconds) FILTER (
    WHERE s.status = 'completed'
  ), 0) AS avg_duration_seconds,

  -- Completion rate (completed / total attempted)
  CASE
    WHEN COUNT(s.id) = 0 THEN 0
    ELSE ROUND(100.0 * COUNT(s.id) FILTER (WHERE s.status = 'completed') / COUNT(s.id))
  END AS completion_rate,

  -- Score distribution
  COUNT(f.id) FILTER (WHERE f.score >= 80 AND s.status = 'completed') AS high_score_count,
  COUNT(f.id) FILTER (WHERE f.score >= 50 AND f.score < 80 AND s.status = 'completed') AS mid_score_count,
  COUNT(f.id) FILTER (WHERE f.score < 50 AND s.status = 'completed') AS low_score_count,

  -- Unique users
  COUNT(DISTINCT s.user_profile_id) FILTER (
    WHERE s.status = 'completed' AND s.user_profile_id IS NOT NULL
  ) AS unique_users,

  -- Assignment stats
  (SELECT COUNT(*) FROM scenario_assignments sa
   WHERE sa.scenario_id = sc.id AND sa.status = 'completed') AS assignments_completed,
  (SELECT COUNT(*) FROM scenario_assignments sa
   WHERE sa.scenario_id = sc.id AND sa.status IN ('pending','in_progress')) AS assignments_pending,

  -- Last used
  MAX(s.started_at) FILTER (WHERE s.status = 'completed') AS last_used_at,

  NOW() AS refreshed_at

FROM scenarios sc
LEFT JOIN sessions s ON s.scenario_id = sc.id
LEFT JOIN feedbacks f ON f.session_id = s.id
WHERE sc.is_active = true
GROUP BY sc.id, sc.org_id, sc.title, sc.category, sc.session_type,
         sc.is_template, sc.visibility;

CREATE UNIQUE INDEX idx_mv_se_scenario ON mv_scenario_effectiveness(scenario_id);
CREATE INDEX idx_mv_se_org ON mv_scenario_effectiveness(org_id);

COMMENT ON MATERIALIZED VIEW mv_scenario_effectiveness IS
  'Per-scenario usage and scoring metrics. Refresh daily via pg_cron.';

-- ============================================
-- RLS ON MATERIALIZED VIEWS
-- Note: Materialized views don't support RLS directly.
-- Access is controlled by the queries that read from them
-- (Edge Functions with service_role, or wrapped in security definer functions).
-- ============================================

-- ============================================
-- REFRESH HELPER FUNCTION
-- Used by pg_cron jobs to refresh all views
-- ============================================

CREATE OR REPLACE FUNCTION public.refresh_materialized_views(view_names TEXT[] DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  v_name TEXT;
  v_all TEXT[] := ARRAY[
    'mv_org_dashboard_stats',
    'mv_team_member_performance',
    'mv_tenant_health',
    'mv_platform_overview',
    'mv_platform_cost_breakdown',
    'mv_scenario_effectiveness'
  ];
BEGIN
  FOREACH v_name IN ARRAY COALESCE(view_names, v_all) LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_name);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refresh_materialized_views IS
  'Refreshes materialized views concurrently. Pass NULL to refresh all, or specific view names.';

-- ============================================
-- PG_CRON JOBS (Execute manually in Supabase Dashboard > SQL Editor)
-- These require pg_cron extension enabled in Supabase project settings.
-- Uncomment and run manually after enabling pg_cron.
-- ============================================

-- Every 15 minutes: org dashboard stats
-- SELECT cron.schedule('refresh-org-dashboard', '*/15 * * * *',
--   $$SELECT refresh_materialized_views(ARRAY['mv_org_dashboard_stats'])$$);

-- Every 5 minutes: tenant health + platform overview
-- SELECT cron.schedule('refresh-platform-views', '*/5 * * * *',
--   $$SELECT refresh_materialized_views(ARRAY['mv_tenant_health','mv_platform_overview'])$$);

-- Daily at 3 AM UTC: team performance, cost breakdown, scenario effectiveness
-- SELECT cron.schedule('refresh-daily-views', '0 3 * * *',
--   $$SELECT refresh_materialized_views(ARRAY['mv_team_member_performance','mv_platform_cost_breakdown','mv_scenario_effectiveness'])$$);

-- Monthly: create next month's audit_logs partition
-- SELECT cron.schedule('create-audit-partition', '0 0 25 * *',
--   $$SELECT create_next_audit_partition()$$);
