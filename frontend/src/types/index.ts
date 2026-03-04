// Access Code types
export interface AccessCode {
  id: string;
  code: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

// ============================================
// PRD 08: Avaliacao Evidenciada
// ============================================

// Session modes
export type SessionMode = 'training' | 'evaluation';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type ObjectionSeverity = 'low' | 'medium' | 'high';
export type ObjectionStatus = 'not_detected' | 'detected' | 'partial' | 'addressed';
export type EvidenceType = 'criterion' | 'objection' | 'key_moment';

// Rubric levels (1-4)
export type RubricLevel = 1 | 2 | 3 | 4;

export const RUBRIC_LEVEL_LABELS: Record<RubricLevel, string> = {
  1: 'Fraco',
  2: 'Parcial',
  3: 'Bom',
  4: 'Excelente'
};

export const RUBRIC_LEVEL_COLORS: Record<RubricLevel, string> = {
  1: 'text-red-600 bg-red-50',
  2: 'text-orange-600 bg-orange-50',
  3: 'text-blue-600 bg-blue-50',
  4: 'text-green-600 bg-green-50'
};

// Scenario types
export interface Objection {
  id: string;
  description: string;
}

// Detailed objection with detection keywords (from scenario_objections table)
export interface DetailedObjection {
  id: string;
  description: string;
  severity: ObjectionSeverity;
  trigger_keywords: string[];
  expected_response_keywords: string[];
}

// Rubric for a criterion (4 levels)
export interface CriterionRubric {
  level_1: string; // Fraco
  level_2: string; // Parcial
  level_3: string; // Bom
  level_4: string; // Excelente
}

// Criterion with rubric (from criterion_rubrics table)
export interface CriterionWithRubric {
  id: string;
  name: string;
  description: string;
  weight: number;
  rubric: CriterionRubric;
}

export interface EvaluationCriterion {
  id: string;
  description: string;
}

// Available AI voices (OpenAI Realtime)
export type AiVoice = 'echo' | 'ash' | 'shimmer' | 'sage' | 'coral';

// Legacy alias for backwards compatibility
export type GeminiVoice = AiVoice;

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
  ai_voice: AiVoice | null;
  avatar_provider: AvatarProvider | null;
  avatar_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // PRD 08: New fields
  duration_min_seconds?: number;
  duration_max_seconds?: number;
  default_session_mode?: SessionMode;
}

// Extended scenario with rubrics and detailed objections (from view)
export interface ScenarioWithRubrics extends Omit<Scenario, 'objections' | 'evaluation_criteria'> {
  criteria_with_rubrics: CriterionWithRubric[];
  objections_detailed: DetailedObjection[];
}

// AI-generated scenario (before saving to database)
export interface GeneratedScenario {
  title: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  suggested_voice: AiVoice;
}

// Request for scenario generation
export interface GenerateScenarioRequest {
  description: string;
  industry?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

// AI-suggested fields for scenario (partial, without title/context)
export interface SuggestedScenarioFields {
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  suggested_voice: AiVoice;
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
  // PRD 08: New fields
  session_mode?: SessionMode;
  is_valid?: boolean | null;
  validation_reasons?: string[];
  has_avatar_fallback?: boolean;
  session_trajectory?: any;
  turn_evaluations?: any[];
  final_output_type?: string;
  output_score?: number;
  coaching_plan?: any[];
}

// Session validation reason
export interface ValidationReason {
  code: string;
  message: string;
}

export interface SessionWithRelations extends Session {
  scenario?: Scenario;
  feedback?: Feedback | null;
}

// Feedback types

// Legacy: pass/fail criteria result (for backwards compatibility)
export interface CriteriaResult {
  criteria_id: string;
  passed: boolean;
  observation: string;
}

// PRD 08: Criteria score with rubric level (1-4)
export interface CriteriaScore {
  criterion_id: string;
  criterion_name: string;
  level: RubricLevel;
  weight: number;
  observation: string;
  evidence_ids: string[];
  rubric_descriptor: string; // The descriptor text for the assigned level
  // Evidence from generate-feedback
  evidence_excerpt?: string;
  evidence_start_index?: number;
  evidence_end_index?: number;
}

// Evidence linking transcript to evaluation
export interface Evidence {
  id: string;
  session_id: string;
  criterion_id: string;
  transcript_start_index: number;
  transcript_end_index: number;
  transcript_excerpt: string;
  timestamp_ms?: number;
  evidence_type: EvidenceType;
  label?: string; // e.g., 'empatia', 'fechamento', 'objecao', 'risco'
  confidence: number;
}

// Objection status during session
export interface SessionObjectionStatus {
  id: string;
  session_id: string;
  objection_id: string;
  status: ObjectionStatus;
  detected_at_ms?: number;
  detected_transcript_index?: number;
  addressed_at_ms?: number;
  addressed_transcript_index?: number;
  recommendation?: string;
}

// Key moment in the session
export interface KeyMoment {
  type: 'positive' | 'negative' | 'opportunity' | 'objection' | 'empathy' | 'closing' | 'risk' | 'omission';
  quote: string;
  explanation: string;
  timestamp_ms?: number;
  transcript_index?: number;
}

// Omission: something the salesperson should have mentioned but didn't
export interface Omission {
  topic: string;
  expected_action: string;
  impact: string;
}

export interface Feedback {
  id: string;
  session_id: string;
  criteria_results: CriteriaResult[]; // Legacy: kept for backwards compatibility
  summary: string;
  score: number;
  created_at: string;
  // PRD 08: New fields
  criteria_scores?: CriteriaScore[];
  weighted_score?: number;
  confidence_level?: ConfidenceLevel;
  transcript_coverage?: number;
  key_moments?: KeyMoment[];
  omissions?: Omission[];
}

// Extended feedback with evidences and objection status
export interface FeedbackWithEvidences extends Feedback {
  evidences: Evidence[];
  objection_statuses: SessionObjectionStatus[];
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
  criteria_results: CriteriaResult[]; // Legacy
  summary: string;
  score: number;
  // PRD 08: New fields
  criteria_scores?: CriteriaScore[];
  weighted_score?: number;
  confidence_level?: ConfidenceLevel;
  key_moments?: KeyMoment[];
  evidences?: Evidence[];
  objection_statuses?: SessionObjectionStatus[];
}

// API Metrics types
export interface ApiMetric {
  id: string;
  session_id: string;
  realtime_input_tokens: number;
  realtime_output_tokens: number;
  realtime_duration_seconds: number;
  text_api_calls: number;
  text_api_input_tokens: number;
  text_api_output_tokens: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  simli_duration_seconds: number;
  livekit_participant_minutes: number;
  estimated_cost_cents: number;
  llm_provider: string;
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
  realtime_tokens: number;
  text_api_calls: number;
  claude_tokens: number;
  avatar_minutes: number;
  livekit_minutes: number;
  estimated_cost_usd: number;
}

export interface DailyAggregate {
  date: string;
  session_count: number;
  total_realtime_tokens: number;
  total_text_api_calls: number;
  total_claude_tokens: number;
  total_avatar_minutes: number;
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

// ============================================
// Coach Orchestrator types
// ============================================

export interface PreloadedSuggestion {
  suggestion_id: string;
  message: string;
  type: string;
  sent_at: string;
  status: 'pending' | 'active' | 'followed' | 'ignored' | 'skipped';
  adherence_score: number | null;
  evaluation_reason: string | null;
}

export interface SessionTrajectory {
  score: number;
  trajectory: 'positive' | 'negative' | 'neutral';
  dimensions: {
    coach_adherence: number;
    emotional_quality: number;
    objection_handling: number;
    conversation_quality: number;
  };
}

export interface OrchestratorSnapshot {
  session_score: number;
  trajectory: string;
  dimensions: Record<string, number>;
  active_suggestion: {
    id: string;
    message: string;
    status: string;
  } | null;
  spin_stage: string;
  pending_objections: string[];
  avatar_emotion: string;
  avatar_directive_sent: boolean;
  deviation: string | null;
}
