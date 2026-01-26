-- ============================================
-- API METRICS TABLE
-- Tracks API usage per session for cost monitoring
-- ============================================

CREATE TABLE api_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,

  -- Gemini Live API (real-time conversation)
  gemini_live_input_tokens INTEGER DEFAULT 0,
  gemini_live_output_tokens INTEGER DEFAULT 0,
  gemini_live_duration_seconds NUMERIC(10,2) DEFAULT 0,

  -- Gemini Flash API (emotion analysis)
  gemini_flash_calls INTEGER DEFAULT 0,
  gemini_flash_input_tokens INTEGER DEFAULT 0,
  gemini_flash_output_tokens INTEGER DEFAULT 0,

  -- Anthropic Claude (feedback generation)
  claude_input_tokens INTEGER DEFAULT 0,
  claude_output_tokens INTEGER DEFAULT 0,

  -- Simli (avatar lip-sync)
  simli_duration_seconds NUMERIC(10,2) DEFAULT 0,

  -- LiveKit (WebRTC infrastructure)
  livekit_participant_minutes NUMERIC(10,2) DEFAULT 0,

  -- Estimated cost in USD cents for precision
  estimated_cost_cents INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_api_metrics_session ON api_metrics(session_id);
CREATE INDEX idx_api_metrics_created_at ON api_metrics(created_at);

-- Enable RLS
ALTER TABLE api_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "service_role_api_metrics_all" ON api_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_read_api_metrics" ON api_metrics
  FOR SELECT USING (auth.role() IN ('authenticated', 'anon'));

-- Trigger for updated_at (reuse existing function if available)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at'
  ) THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

CREATE TRIGGER api_metrics_updated_at
  BEFORE UPDATE ON api_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AGGREGATED VIEW FOR DASHBOARD
-- Daily summary of API usage
-- ============================================

CREATE OR REPLACE VIEW api_metrics_daily AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as session_count,
  SUM(gemini_live_input_tokens) as total_gemini_live_input,
  SUM(gemini_live_output_tokens) as total_gemini_live_output,
  SUM(gemini_live_duration_seconds) as total_gemini_live_duration,
  SUM(gemini_flash_calls) as total_gemini_flash_calls,
  SUM(gemini_flash_input_tokens) as total_gemini_flash_input,
  SUM(gemini_flash_output_tokens) as total_gemini_flash_output,
  SUM(claude_input_tokens) as total_claude_input,
  SUM(claude_output_tokens) as total_claude_output,
  SUM(simli_duration_seconds) as total_simli_duration,
  SUM(livekit_participant_minutes) as total_livekit_minutes,
  SUM(estimated_cost_cents) as total_cost_cents
FROM api_metrics
GROUP BY DATE(created_at)
ORDER BY date DESC;
