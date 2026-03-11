-- Migration 034: Backfill org_id for Existing Data
-- Phase 2 — Run BEFORE 033_cutover_not_null_rls.sql
--
-- Strategy:
-- 1. Create a default organization for all existing data
-- 2. Backfill org_id on all existing rows
-- 3. Create user_profiles from existing access_codes (admin codes → admin, user codes → trainee)

-- ============================================
-- 1. CREATE DEFAULT ORGANIZATION
-- ============================================

INSERT INTO organizations (id, name, slug, status, settings, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::UUID,
  'Live Roleplay (Default)',
  'live-roleplay-default',
  'active',
  '{"session_timeout_hours": 24, "max_session_duration_seconds": 600}'::JSONB,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 2. BACKFILL ORG_ID ON ALL TABLES
-- ============================================

-- Sessions
UPDATE sessions SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Feedbacks
UPDATE feedbacks SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Scenarios (non-template only; templates stay NULL)
UPDATE scenarios SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL AND is_template = false;

-- Access codes
UPDATE access_codes SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Criterion rubrics (via scenario → org)
UPDATE criterion_rubrics SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Scenario objections
UPDATE scenario_objections SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Scenario outcomes
UPDATE scenario_outcomes SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Session evidences
UPDATE session_evidences SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- Session objection status
UPDATE session_objection_status SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- API metrics
UPDATE api_metrics SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- User difficulty profiles
UPDATE user_difficulty_profiles SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- User learning profiles
UPDATE user_learning_profiles SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
WHERE org_id IS NULL;

-- ============================================
-- 3. VERIFICATION
-- ============================================

DO $$
DECLARE
  null_sessions INTEGER;
  null_feedbacks INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_sessions FROM sessions WHERE org_id IS NULL;
  SELECT COUNT(*) INTO null_feedbacks FROM feedbacks WHERE org_id IS NULL;

  IF null_sessions > 0 OR null_feedbacks > 0 THEN
    RAISE WARNING 'Backfill incomplete: sessions=%, feedbacks=% still NULL', null_sessions, null_feedbacks;
  ELSE
    RAISE NOTICE 'Backfill complete: all sessions and feedbacks have org_id';
  END IF;
END $$;
