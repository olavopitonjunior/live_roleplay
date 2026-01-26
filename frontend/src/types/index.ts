// Access Code types
export interface AccessCode {
  id: string;
  code: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

// Scenario types
export interface Objection {
  id: string;
  description: string;
}

export interface EvaluationCriterion {
  id: string;
  description: string;
}

// Available Gemini voices
export type GeminiVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';

// Available avatar providers
export type AvatarProvider = 'simli' | 'liveavatar' | 'hedra';

export interface Scenario {
  id: string;
  title: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string | null;
  simli_face_id: string | null;
  gemini_voice: GeminiVoice | null;
  avatar_provider: AvatarProvider | null;
  avatar_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// AI-generated scenario (before saving to database)
export interface GeneratedScenario {
  title: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  suggested_voice: GeminiVoice;
}

// Request for scenario generation
export interface GenerateScenarioRequest {
  description: string;
  industry?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Session types
export interface Session {
  id: string;
  access_code_id: string;
  scenario_id: string;
  livekit_room_name: string | null;
  transcript: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'active' | 'completed' | 'cancelled';
}

export interface SessionWithRelations extends Session {
  scenario?: Scenario;
  feedback?: Feedback | null;
}

// Feedback types
export interface CriteriaResult {
  criteria_id: string;
  passed: boolean;
  observation: string;
}

export interface Feedback {
  id: string;
  session_id: string;
  criteria_results: CriteriaResult[];
  summary: string;
  score: number;
  created_at: string;
}

// Auth state
export interface AuthState {
  accessCode: AccessCode | null;
  isAuthenticated: boolean;
}

// LiveKit token response
export interface LiveKitTokenResponse {
  token: string;
  room_name: string;
  session_id: string;
}

// Feedback generation response
export interface FeedbackResponse {
  feedback_id: string;
  criteria_results: CriteriaResult[];
  summary: string;
  score: number;
}

// API Metrics types
export interface ApiMetric {
  id: string;
  session_id: string;
  gemini_live_input_tokens: number;
  gemini_live_output_tokens: number;
  gemini_live_duration_seconds: number;
  gemini_flash_calls: number;
  gemini_flash_input_tokens: number;
  gemini_flash_output_tokens: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  simli_duration_seconds: number;
  livekit_participant_minutes: number;
  estimated_cost_cents: number;
  created_at: string;
  sessions?: {
    scenario_id: string;
    scenarios?: {
      id: string;
      title: string;
    };
  };
}

export interface MetricsTotals {
  total_sessions: number;
  gemini_live_tokens: number;
  gemini_flash_calls: number;
  claude_tokens: number;
  simli_minutes: number;
  livekit_minutes: number;
  estimated_cost_usd: number;
}

export interface DailyAggregate {
  date: string;
  session_count: number;
  total_gemini_live_tokens: number;
  total_gemini_flash_calls: number;
  total_claude_tokens: number;
  total_simli_minutes: number;
  total_livekit_minutes: number;
  total_cost_cents: number;
}

export interface MetricsFilters {
  startDate: string | null;
  endDate: string | null;
  scenarioId: string | null;
}

export interface MetricsResponse {
  metrics: ApiMetric[];
  totals: MetricsTotals;
  daily_aggregates: DailyAggregate[];
  filters: {
    start_date: string | null;
    end_date: string | null;
    scenario_id: string | null;
  };
}
