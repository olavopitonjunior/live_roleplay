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

// Character gender (drives voice filtering)
export type CharacterGender = 'male' | 'female';

// Legacy alias for backwards compatibility
export type GeminiVoice = AiVoice;

// Available avatar providers
export type AvatarProvider = 'simli' | 'liveavatar' | 'hedra' | 'none';

// AGENTS-EVOLUTION: Structured scenario field types
export interface PhaseFlowPhase {
  name: string;
  duration_pct: number;
  triggers: string[];
}

export interface PhaseFlow {
  phases: PhaseFlowPhase[];
}

export interface EmotionalReactivityTrigger {
  event: string;
  reaction: string;
  intensity: number;
}

export interface EmotionalReactivity {
  triggers: EmotionalReactivityTrigger[];
}

export interface CommunicationStyle {
  formality: string;
  verbosity: string;
  patterns: string[];
}

export interface DifficultyEscalationStage {
  threshold: string;
  behavior_change: string;
}

export interface DifficultyEscalation {
  stages: DifficultyEscalationStage[];
}

export interface CriteriaWeights {
  [criterionId: string]: number;
}

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
  category: string | null;
  // PRD 08: New fields
  duration_min_seconds?: number;
  duration_max_seconds?: number;
  default_session_mode?: SessionMode;
  // AGENTS-EVOLUTION Phase 1: Structured fields
  // Bloco Situacao
  session_type?: string | null;
  market_context?: Record<string, unknown> | null;
  user_objective?: string | null;
  target_duration_seconds?: number | null;
  opening_line?: string | null;
  success_condition?: string | null;
  end_condition?: string | null;
  // Bloco Personagem
  character_gender?: CharacterGender | null;
  character_name?: string | null;
  character_role?: string | null;
  personality?: string | null;
  hidden_objective?: string | null;
  initial_emotion?: string | null;
  emotional_reactivity?: EmotionalReactivity | null;
  communication_style?: CommunicationStyle | null;
  typical_phrases?: string[] | null;
  knowledge_limits?: Record<string, unknown> | null;
  backstory?: string | null;
  // Bloco Avaliacao
  criteria_weights?: CriteriaWeights | null;
  positive_indicators?: string[] | null;
  negative_indicators?: string[] | null;
  // Comportamento Dinamico
  phase_flow?: PhaseFlow | null;
  difficulty_escalation?: DifficultyEscalation | null;
  // Versionamento
  version?: number;
  version_history?: unknown[];
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
  // AGENTS-EVOLUTION: New structured fields (all optional in generated output)
  suggested_category?: string;
  character_gender?: CharacterGender;
  character_name?: string;
  character_role?: string;
  personality?: string;
  user_objective?: string;
  opening_line?: string;
  hidden_objective?: string;
  initial_emotion?: string;
  emotional_reactivity?: EmotionalReactivity;
  communication_style?: CommunicationStyle;
  typical_phrases?: string[];
  knowledge_limits?: Record<string, unknown>;
  backstory?: string;
  session_type?: string;
  market_context?: Record<string, unknown>;
  target_duration_seconds?: number;
  success_condition?: string;
  end_condition?: string;
  phase_flow?: PhaseFlow;
  difficulty_escalation?: DifficultyEscalation;
  criteria_weights?: CriteriaWeights;
  positive_indicators?: string[];
  negative_indicators?: string[];
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
  // AGENTS-EVOLUTION: New structured fields
  character_gender?: CharacterGender;
  character_name?: string;
  character_role?: string;
  personality?: string;
  user_objective?: string;
  opening_line?: string;
  hidden_objective?: string;
  initial_emotion?: string;
  emotional_reactivity?: EmotionalReactivity;
  communication_style?: CommunicationStyle;
  typical_phrases?: string[];
  knowledge_limits?: Record<string, unknown>;
  backstory?: string;
  session_type?: string;
  market_context?: Record<string, unknown>;
  target_duration_seconds?: number;
  success_condition?: string;
  end_condition?: string;
  phase_flow?: PhaseFlow;
  difficulty_escalation?: DifficultyEscalation;
  criteria_weights?: CriteriaWeights;
  positive_indicators?: string[];
  negative_indicators?: string[];
}

// Form data for creating/editing scenarios (used by ScenarioWizard)
export interface ScenarioFormData {
  title: string;
  category: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  simli_face_id: string;
  ai_voice: AiVoice;
  avatar_provider: AvatarProvider | null;
  avatar_id: string;
  is_active: boolean;
  // Structured fields
  target_duration_seconds: number | null;
  character_gender: CharacterGender;
  character_name: string;
  character_role: string;
  personality: string;
  user_objective: string;
  opening_line: string;
  // Hidden fields (set by AI, passed through on save)
  hidden_objective?: string | null;
  initial_emotion?: string | null;
  emotional_reactivity?: EmotionalReactivity | null;
  communication_style?: CommunicationStyle | null;
  typical_phrases?: string[] | null;
  knowledge_limits?: Record<string, unknown> | null;
  backstory?: string | null;
  session_type?: string | null;
  market_context?: Record<string, unknown> | null;
  success_condition?: string | null;
  end_condition?: string | null;
  phase_flow?: PhaseFlow | null;
  difficulty_escalation?: DifficultyEscalation | null;
  criteria_weights?: CriteriaWeights | null;
  positive_indicators?: string[] | null;
  negative_indicators?: string[] | null;
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

// Auth state (supports dual auth: access_code + JWT)
export interface AuthState {
  accessCode: AccessCode | null;
  isAuthenticated: boolean;
  // Multi-tenant (JWT auth)
  authMethod: AuthMethod | null;
  user: UserProfile | null;
  organization: Organization | null;
  trialUserId: string | null;
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

// ============================================
// Multi-Tenant Types (Phase 2)
// ============================================

// Organization status
export type OrgStatus = 'trialing' | 'active' | 'grace_period' | 'suspended' | 'deletion_pending' | 'deleted' | 'churned';

// Tenant roles
export type TenantRole = 'owner' | 'admin' | 'manager' | 'trainer' | 'trainee';

// Platform admin roles
export type PlatformRole = 'super_admin' | 'admin' | 'support' | 'finance' | 'viewer';

// Auth method
export type AuthMethod = 'access_code' | 'jwt';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  status: OrgStatus;
  settings: OrgSettings;
  plan_limits: Record<string, unknown>;
  is_active: boolean;
  industry: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  grace_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgSettings {
  session_timeout_hours?: number;
  max_session_duration_seconds?: number;
  default_session_mode?: SessionMode;
  default_difficulty_level?: number;
  allow_evaluation_mode?: boolean;
  require_email_verification?: boolean;
  coach_enabled?: boolean;
  coach_mode?: string;
  managers_can_create_scenarios?: boolean;
  branding?: {
    logo_url?: string | null;
    primary_color?: string;
    company_name?: string;
  };
  notifications?: {
    weekly_report?: boolean;
    session_complete?: boolean;
  };
  retention_days?: number;
  allowed_ai_voices?: AiVoice[];
  max_concurrent_sessions?: number;
}

export interface UserProfile {
  id: string;
  org_id: string;
  auth_user_id: string | null;
  access_code_id: string | null;
  email: string;
  full_name: string | null;
  role: TenantRole;
  settings: UserSettings;
  is_active: boolean;
  status: 'active' | 'deactivated' | 'deletion_pending' | 'deleted';
  avatar_url: string | null;
  last_device: string | null;
  last_seen_at: string | null;
  deactivated_at: string | null;
  deletion_requested_at: string | null;
  role_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  preferred_language?: string;
  preferred_voice?: AiVoice | null;
  notification_email?: boolean;
  notification_weekly_report?: boolean;
  notification_push?: boolean;
  coach_overlay_position?: 'left' | 'right';
  coach_auto_dismiss_seconds?: number;
  theme?: 'light' | 'dark' | 'system';
  default_session_mode?: SessionMode;
  show_emotion_meter?: boolean;
  show_spin_indicator?: boolean;
  timezone?: string;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  settings: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: 'manager' | 'member';
  joined_at: string;
}

export interface UserInvite {
  id: string;
  org_id: string;
  email: string;
  role: TenantRole;
  team_id: string | null;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ScenarioAssignment {
  id: string;
  org_id: string;
  scenario_id: string;
  assigned_to: string;
  assigned_by: string;
  due_date: string | null;
  target_score: number | null;
  target_mode: SessionMode;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  completed_session_id: string | null;
  completed_at: string | null;
  created_at: string;
}

// Auth context for the frontend
export interface AuthContext {
  method: AuthMethod;
  // Access code auth
  accessCode?: AccessCode;
  trialUserId?: string;
  // JWT auth
  user?: UserProfile;
  organization?: Organization;
  // Common
  isAuthenticated: boolean;
  isAdmin: boolean;
  orgId?: string;
  role?: TenantRole | 'admin' | 'user';  // backward compat with access_code roles
}

// Plans & Billing
export interface Plan {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  sort_order: number;
  is_public: boolean;
  is_archived: boolean;
}

export interface PlanVersion {
  id: string;
  plan_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'sunset' | 'archived';
  base_fee_cents: number;
  currency: string;
  billing_interval: 'month' | 'year';
  included_sessions: number;
  included_tokens: number;
  overage_per_session_cents: number;
  features: Record<string, unknown>;
  published_at: string | null;
}

export interface StripeSubscription {
  id: string;
  org_id: string;
  stripe_subscription_id: string;
  plan_version_id: string;
  status: 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_start: string | null;
  trial_end: string | null;
}

// Notification
export interface NotificationItem {
  id: string;
  user_profile_id: string;
  org_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
}

// Onboarding
export interface OnboardingStatus {
  id: string;
  org_id: string;
  org_profile_completed_at: string | null;
  first_user_invited_at: string | null;
  first_scenario_created_at: string | null;
  first_session_completed_at: string | null;
  billing_setup_at: string | null;
  steps_completed: number;
  total_steps: number;
  is_complete: boolean;
}

// Role hierarchy helper
export const ROLE_HIERARCHY: Record<TenantRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  trainer: 20,
  trainee: 10,
};

export function hasMinRole(userRole: TenantRole, requiredRole: TenantRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}
