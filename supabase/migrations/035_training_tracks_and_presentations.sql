-- Migration 035: Training Tracks + Presentation Support
-- Adds training tracks (esteiras), track-scenario ordering, user progress tracking,
-- presentation config on scenarios, and presentation data on sessions.
-- All new tables are standalone (no org_id FK — added when multi-tenant goes live).

-- ============================================================
-- TRAINING TRACKS
-- ============================================================

CREATE TABLE IF NOT EXISTS training_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE training_tracks IS 'Training tracks (esteiras) — sequential learning paths grouping scenarios';

-- Junction table: many-to-many with ordering + skills metadata
CREATE TABLE IF NOT EXISTS track_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID NOT NULL REFERENCES training_tracks(id) ON DELETE CASCADE,
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  skills_introduced JSONB DEFAULT '[]'::jsonb,
  skills_expected JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_id, scenario_id),
  UNIQUE(track_id, position)
);

COMMENT ON TABLE track_scenarios IS 'Ordered scenarios within a training track, with skills metadata per position';
COMMENT ON COLUMN track_scenarios.skills_introduced IS 'Skills this scenario teaches, e.g. ["SPIN Situation", "Rapport"]';
COMMENT ON COLUMN track_scenarios.skills_expected IS 'Skills user should demonstrate, e.g. ["SPIN Implication", "Price objection"]';

-- Per-user progress through a track
CREATE TABLE IF NOT EXISTS user_track_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_code_id UUID REFERENCES access_codes(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES training_tracks(id) ON DELETE CASCADE,
  current_position INTEGER DEFAULT 0,
  completed_scenarios JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(access_code_id, track_id)
);

COMMENT ON TABLE user_track_progress IS 'Tracks user completion through a training track';
COMMENT ON COLUMN user_track_progress.completed_scenarios IS 'Array of {scenario_id, session_id, score, weaknesses[], spin_stage_reached, completed_at}';

-- Link sessions to track context (nullable — sessions outside tracks are NULL)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS track_scenario_id UUID REFERENCES track_scenarios(id);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_track_scenarios_track ON track_scenarios(track_id, position);
CREATE INDEX IF NOT EXISTS idx_track_scenarios_scenario ON track_scenarios(scenario_id);
CREATE INDEX IF NOT EXISTS idx_user_track_progress_user ON user_track_progress(access_code_id);
CREATE INDEX IF NOT EXISTS idx_user_track_progress_track ON user_track_progress(track_id);
CREATE INDEX IF NOT EXISTS idx_sessions_track ON sessions(track_scenario_id) WHERE track_scenario_id IS NOT NULL;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE training_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_track_progress ENABLE ROW LEVEL SECURITY;

-- Training tracks: public read, service_role full access
CREATE POLICY "training_tracks_public_read" ON training_tracks
  FOR SELECT USING (true);
CREATE POLICY "training_tracks_service_all" ON training_tracks
  FOR ALL USING (auth.role() = 'service_role');

-- Track scenarios: public read, service_role full access
CREATE POLICY "track_scenarios_public_read" ON track_scenarios
  FOR SELECT USING (true);
CREATE POLICY "track_scenarios_service_all" ON track_scenarios
  FOR ALL USING (auth.role() = 'service_role');

-- User track progress: public read (filtered by app logic), service_role full access
CREATE POLICY "user_track_progress_public_read" ON user_track_progress
  FOR SELECT USING (true);
CREATE POLICY "user_track_progress_service_all" ON user_track_progress
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PRESENTATIONS
-- ============================================================

-- Presentation config on scenarios (admin pre-configures default presentation)
-- JSONB: {file_url, total_slides, slides: [{position, image_url, extracted_text, title, data_points}]}
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS presentation_config JSONB DEFAULT NULL;

-- Per-session presentation data (user uploads ad-hoc before session)
-- Same JSONB structure as presentation_config
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS presentation_data JSONB DEFAULT NULL;

-- Storage bucket for slide images and original PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('presentations', 'presentations', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for presentations bucket
DO $$
BEGIN
  -- Public read for slide images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'presentations_public_read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "presentations_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = 'presentations');
  END IF;

  -- Authenticated insert for uploading slides
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'presentations_auth_insert' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "presentations_auth_insert" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'presentations');
  END IF;
END $$;
