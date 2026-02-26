/**
 * Edge Function: generate-feedback
 *
 * PRD 08: Avaliacao Evidenciada e Calibrada V2
 *
 * Analyzes session transcripts using Claude API and generates
 * structured feedback with:
 * - Rubric-based scoring (levels 1-4 instead of pass/fail)
 * - Evidence linking to transcript excerpts
 * - Objection status tracking
 * - Weighted score calculation
 * - Key moments with timestamps
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.30.0";
import {
  handleCorsPreflightRequest,
  corsJsonResponse,
  corsErrorResponse,
} from "../_shared/cors.ts";
import { withRetry } from "../_shared/retry.ts";

interface RequestBody {
  session_id: string;
}

// Legacy interface (for backwards compatibility)
interface CriteriaResult {
  criteria_id: string;
  passed: boolean;
  observation: string;
}

// New: Rubric-based score (1-4)
interface CriteriaScore {
  criterion_id: string;
  criterion_name: string;
  level: 1 | 2 | 3 | 4;
  weight: number;
  observation: string;
  evidence_excerpt: string;
  evidence_start_index: number;
  evidence_end_index: number;
}

// Objection status in response
interface ObjectionStatusResult {
  objection_id: string;
  status: "not_detected" | "detected" | "partial" | "addressed";
  detected_excerpt?: string;
  detected_index?: number;
  addressed_excerpt?: string;
  addressed_index?: number;
  recommendation?: string;
}

interface KeyMoment {
  type: "positive" | "negative" | "opportunity" | "objection" | "empathy" | "closing" | "risk" | "omission";
  quote: string;
  explanation: string;
  transcript_index?: number;
}

interface Omission {
  topic: string;
  expected_action: string;
  impact: string;
}

// Session outcome types
type SessionOutcome =
  | "sale_closed"
  | "meeting_scheduled"
  | "proposal_requested"
  | "needs_follow_up"
  | "rejected"
  | "abandoned"
  | "timeout";

interface ScenarioOutcome {
  id: string;
  outcome_type: SessionOutcome;
  description: string;
  is_positive: boolean;
  trigger_condition: {
    min_score?: number;
    objections_handled_ratio?: number;
  };
  avatar_closing_line: string;
  display_order: number;
}

interface FeedbackResponse {
  criteria_scores: CriteriaScore[];
  objection_statuses: ObjectionStatusResult[];
  key_moments: KeyMoment[];
  omissions: Omission[];
  summary: string;
  confidence_level: "low" | "medium" | "high";
  transcript_coverage: number;
  outcome?: SessionOutcome;
  outcome_reasoning?: string;
}

// Criterion with rubric from database
interface CriterionWithRubric {
  id: string;
  name: string;
  description: string;
  weight: number;
  rubric: {
    level_1: string;
    level_2: string;
    level_3: string;
    level_4: string;
  };
}

// Objection from database
interface DetailedObjection {
  id: string;
  description: string;
  severity: string;
  trigger_keywords: string[];
  expected_response_keywords: string[];
}

interface ScenarioWithRubrics {
  id: string;
  title: string;
  context: string;
  ideal_outcome?: string;
  criteria_with_rubrics: CriterionWithRubric[];
  objections_detailed: DetailedObjection[];
  // PRD 08, US-14: Duration limits
  duration_min_seconds?: number;
  duration_max_seconds?: number;
}

/**
 * Find the index of a quote in the transcript
 */
function findQuoteIndex(transcript: string, quote: string): number {
  // Try exact match first
  let index = transcript.toLowerCase().indexOf(quote.toLowerCase());
  if (index !== -1) return index;

  // Try partial match (first 50 chars)
  const partial = quote.substring(0, 50).toLowerCase();
  index = transcript.toLowerCase().indexOf(partial);
  return index;
}

/**
 * Build the evaluation prompt with rubrics for 1-4 scoring
 */
function buildRubricEvaluationPrompt(
  scenario: ScenarioWithRubrics,
  transcript: string,
  outcomes: ScenarioOutcome[] = []
): string {
  const criteriaSection = scenario.criteria_with_rubrics
    .map(
      (c, i) => `
CRITERIO ${i + 1}: ${c.name} [ID: ${c.id}]
Descricao: ${c.description}
Peso: ${c.weight}%

Rubrica de avaliacao:
- Nivel 1 (Fraco): ${c.rubric.level_1}
- Nivel 2 (Parcial): ${c.rubric.level_2}
- Nivel 3 (Bom): ${c.rubric.level_3}
- Nivel 4 (Excelente): ${c.rubric.level_4}
`
    )
    .join("\n---\n");

  const objectionsSection = scenario.objections_detailed
    ?.map(
      (o, i) => `
OBJECAO ${i + 1}: [ID: ${o.id}]
Descricao: ${o.description}
Severidade: ${o.severity}
Palavras-chave de deteccao: ${o.trigger_keywords.join(", ")}
Palavras-chave de tratamento: ${o.expected_response_keywords.join(", ")}
`
    )
    .join("\n") || "Nenhuma objecao obrigatoria definida.";

  const idealOutcomeSection = scenario.ideal_outcome
    ? `
═══════════════════════════════════════════════════════════════
RESULTADO IDEAL ESPERADO:
═══════════════════════════════════════════════════════════════
${scenario.ideal_outcome}
`
    : "";

  // Build outcomes section for session result determination
  const outcomesSection = outcomes.length > 0
    ? outcomes
        .sort((a, b) => a.display_order - b.display_order)
        .map((o) => `- ${o.outcome_type}: ${o.description} (score minimo: ${o.trigger_condition?.min_score || 0}%)`)
        .join("\n")
    : `- sale_closed: Venda fechada (score >= 80%)
- meeting_scheduled: Reuniao agendada (score >= 70%)
- proposal_requested: Proposta solicitada (score >= 60%)
- needs_follow_up: Precisa acompanhamento (score >= 50%)
- rejected: Rejeitado (score < 50%)`;

  return `Voce e um avaliador especializado em treinamentos de vendas e negociacao.
Analise a transcricao abaixo e avalie o desempenho do participante usando RUBRICAS DE 4 NIVEIS.

═══════════════════════════════════════════════════════════════
EXEMPLO DE AVALIACAO COM RUBRICA (para calibrar):
═══════════════════════════════════════════════════════════════

Criterio: "Tratamento de objecao de preco"
Rubrica:
- Nivel 1: Ignorou ou ofereceu desconto sem argumentar
- Nivel 2: Reconheceu mas argumentou de forma generica
- Nivel 3: Apresentou argumentos de valor conectados
- Nivel 4: Reverteu com ROI, comparacao e apelo emocional

Trecho: 'Usuario: Entendo sua preocupacao. Este plano custa menos que 2% do que voce gastaria em uma emergencia. Alem disso, protege a educacao dos seus filhos.'

Avaliacao:
{
  "criterion_id": "crit_2",
  "criterion_name": "Tratamento de preco",
  "level": 3,
  "weight": 25,
  "observation": "Apresentou argumentos de valor (custo-beneficio, protecao dos filhos) mas faltou calculo de ROI explicito ou comparacao com alternativas.",
  "evidence_excerpt": "Este plano custa menos que 2% do que voce gastaria em uma emergencia. Alem disso, protege a educacao dos seus filhos",
  "evidence_start_index": 42,
  "evidence_end_index": 156
}

═══════════════════════════════════════════════════════════════
CONTEXTO DO CENARIO:
═══════════════════════════════════════════════════════════════
${scenario.context}
${idealOutcomeSection}
═══════════════════════════════════════════════════════════════
CRITERIOS COM RUBRICAS (avalie cada um com nivel 1-4):
═══════════════════════════════════════════════════════════════
${criteriaSection}

═══════════════════════════════════════════════════════════════
OBJECOES OBRIGATORIAS (verifique se foram tratadas):
═══════════════════════════════════════════════════════════════
${objectionsSection}

═══════════════════════════════════════════════════════════════
POSSIVEIS RESULTADOS DA SESSAO (determine um baseado no desempenho):
═══════════════════════════════════════════════════════════════
${outcomesSection}

═══════════════════════════════════════════════════════════════
TRANSCRICAO DA CONVERSA:
═══════════════════════════════════════════════════════════════
${transcript}

═══════════════════════════════════════════════════════════════
INSTRUCOES PARA SUA AVALIACAO:
═══════════════════════════════════════════════════════════════

1. Para CADA CRITERIO:
   - Atribua um nivel de 1 a 4 baseado na rubrica
   - Identifique o trecho EXATO da conversa que justifica (evidence_excerpt)
   - Informe a posicao do trecho no transcript (evidence_start_index, evidence_end_index)
   - Se nao houver evidencia, atribua nivel 1 e mencione "nao abordado"

2. Para CADA OBJECAO obrigatoria:
   - status: "not_detected" se nao apareceu, "detected" se apareceu mas nao foi tratada, "partial" se foi parcialmente tratada, "addressed" se foi bem tratada
   - Cite o trecho onde foi detectada e/ou tratada
   - Se nao tratada, sugira uma recomendacao

3. MOMENTOS-CHAVE:
   - Identifique 3-5 momentos importantes (positivos, negativos, oportunidades, objecoes)
   - Cada momento deve ter quote EXATO e explicacao

4. CONFIANCA:
   - "high" se a transcricao e clara e cobre toda a conversa
   - "medium" se ha trechos confusos ou faltando
   - "low" se a transcricao e muito curta ou incompleta

5. COBERTURA:
   - Estime qual % do audio foi transcrito (0.0 a 1.0)

6. RESULTADO (outcome):
   - Determine o resultado da sessao baseado no score e no tratamento de objecoes
   - Se o avatar encerrou com uma frase de fechamento/rejeicao, considere isso
   - Explique brevemente o motivo da determinacao em "outcome_reasoning"

7. OMISSOES:
   - Identifique topicos IMPORTANTES que o vendedor DEVERIA ter abordado mas NAO abordou
   - Considere o contexto do cenario e as melhores praticas de vendas
   - Para cada omissao, indique o topico, a acao esperada e o impacto da omissao
   - Exemplos: nao perguntar sobre orcamento, nao confirmar proximo passo, nao explorar necessidades

Retorne APENAS um JSON valido com esta estrutura:

{
  "criteria_scores": [
    {
      "criterion_id": "crit_1",
      "criterion_name": "Nome do criterio",
      "level": 3,
      "weight": 25,
      "observation": "Explicacao da avaliacao",
      "evidence_excerpt": "Trecho exato da conversa",
      "evidence_start_index": 0,
      "evidence_end_index": 50
    }
  ],
  "objection_statuses": [
    {
      "objection_id": "obj_price",
      "status": "addressed",
      "detected_excerpt": "Trecho onde objecao foi levantada",
      "detected_index": 100,
      "addressed_excerpt": "Trecho onde foi tratada",
      "addressed_index": 200,
      "recommendation": null
    }
  ],
  "key_moments": [
    {
      "type": "positive",
      "quote": "Trecho exato",
      "explanation": "Por que foi importante",
      "transcript_index": 150
    }
  ],
  "omissions": [
    {
      "topic": "Confirmacao do proximo passo",
      "expected_action": "Confirmar agenda ou proximo contato antes de encerrar",
      "impact": "Sem proximo passo definido, o lead pode esfriar"
    }
  ],
  "summary": "Resumo geral do desempenho em 2-3 frases",
  "confidence_level": "high",
  "transcript_coverage": 0.95,
  "outcome": "sale_closed",
  "outcome_reasoning": "O usuario tratou bem as objecoes e o avatar indicou fechamento"
}`;
}

/**
 * Calculate weighted score from criteria scores
 * Score = sum(level * 25 * weight / 100) / sum(weights) * 100
 */
function calculateWeightedScore(criteriaScores: CriteriaScore[]): number {
  if (criteriaScores.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const score of criteriaScores) {
    const levelPercent = score.level * 25; // 1=25%, 2=50%, 3=75%, 4=100%
    weightedSum += (levelPercent * score.weight) / 100;
    totalWeight += score.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum * 100) / totalWeight);
}

/**
 * Convert rubric scores to legacy pass/fail format
 * Level 1-2 = failed, Level 3-4 = passed
 */
function convertToLegacyFormat(criteriaScores: CriteriaScore[]): CriteriaResult[] {
  return criteriaScores.map((score) => ({
    criteria_id: score.criterion_id,
    passed: score.level >= 3,
    observation: `[Nivel ${score.level}/4] ${score.observation}`,
  }));
}

/**
 * PRD 08, US-13: Session validation
 * Validates if a session meets minimum criteria for evaluation
 */
interface ValidationResult {
  is_valid: boolean;
  validation_reasons: string[];
}

function validateSession(
  transcript: string,
  durationSeconds: number | null,
  hasAvatarFallback: boolean,
  confidenceLevel: string,
  transcriptCoverage: number,
  minDurationSeconds: number = 120,  // 2 min default
  maxDurationSeconds: number = 600   // 10 min default
): ValidationResult {
  const reasons: string[] = [];

  // 1. Check duration
  if (durationSeconds !== null) {
    if (durationSeconds < minDurationSeconds) {
      reasons.push(`Sessão muito curta: ${Math.round(durationSeconds)}s (mínimo: ${minDurationSeconds}s)`);
    } else if (durationSeconds > maxDurationSeconds) {
      reasons.push(`Sessão muito longa: ${Math.round(durationSeconds)}s (máximo: ${maxDurationSeconds}s)`);
    }
  }

  // 2. Check transcript quality
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  const userLines = lines.filter((l) => l.includes("Usuario:")).length;
  const avatarLines = lines.filter((l) => l.includes("Avatar:")).length;

  if (userLines < 3) {
    reasons.push(`Participação insuficiente do usuário: ${userLines} falas (mínimo: 3)`);
  }
  if (avatarLines < 3) {
    reasons.push(`Participação insuficiente do avatar: ${avatarLines} falas (mínimo: 3)`);
  }

  // 3. Check confidence level
  if (confidenceLevel === "low") {
    reasons.push("Transcrição de baixa qualidade (confiança baixa)");
  }

  // 4. Check transcript coverage
  if (transcriptCoverage < 0.5) {
    reasons.push(`Cobertura de transcrição insuficiente: ${Math.round(transcriptCoverage * 100)}% (mínimo: 50%)`);
  }

  // 5. Avatar fallback is informational, not a blocker
  // But note it for transparency
  if (hasAvatarFallback) {
    // This doesn't invalidate the session, but is tracked
    console.log("Note: Session used avatar fallback (audio-only)");
  }

  return {
    is_valid: reasons.length === 0,
    validation_reasons: reasons,
  };
}

/**
 * Save a minimal feedback template when full evaluation is not possible.
 * Returns HTTP 200 with a valid feedback structure (score 0, confidence low).
 */
async function saveMinimalFeedback(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  reason: string,
  req: Request
): Promise<Response> {
  const summary = reason;
  const { data: feedback, error } = await supabase
    .from("feedbacks")
    .insert({
      session_id: sessionId,
      criteria_results: [],
      summary,
      score: 0,
      key_moments: [],
      confidence_level: "low",
      transcript_coverage: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save minimal feedback:", error);
    return corsErrorResponse("Failed to save feedback", 500, req);
  }

  console.log(`Minimal feedback saved for session ${sessionId}: ${reason}`);
  return corsJsonResponse(
    {
      feedback_id: feedback.id,
      criteria_results: [],
      key_moments: [],
      omissions: [],
      summary,
      score: 0,
      confidence_level: "low",
      transcript_coverage: 0,
      minimal: true,
    },
    200,
    req
  );
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  let session_id: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    const body: RequestBody = await req.json();
    session_id = body.session_id;
    console.log("generate-feedback V2 called with session_id:", session_id);

    if (!session_id) {
      console.error("Missing session_id in request");
      return corsErrorResponse("Missing session_id", 400, req);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch session with scenario data
    console.log("Fetching session data...");
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        `
        id,
        transcript,
        scenario_id,
        status,
        session_mode,
        has_avatar_fallback,
        duration_seconds,
        access_code_id,
        difficulty_level,
        emotion_history,
        transcript_metadata
      `
      )
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return corsErrorResponse("Session not found", 404, req);
    }

    console.log("Session found:", {
      id: session.id,
      status: session.status,
      has_transcript: !!session.transcript,
      transcript_length: session.transcript?.length || 0,
      session_mode: session.session_mode,
    });

    // Check if feedback already exists
    const { data: existingFeedback } = await supabase
      .from("feedbacks")
      .select("id")
      .eq("session_id", session_id)
      .single();

    if (existingFeedback) {
      console.log("Feedback already exists for session:", session_id);
      return corsErrorResponse("Feedback already exists for this session", 409, req);
    }

    // Handle missing or empty transcript — save minimal template instead of error
    if (!session.transcript || session.transcript.trim().length === 0) {
      console.warn("No transcript for session:", session_id, "— saving minimal feedback");
      return await saveMinimalFeedback(
        supabase,
        session_id,
        "Sessao sem conteudo suficiente para avaliacao. A conversa foi muito curta ou nao foi capturada.",
        req
      );
    }

    // Fetch scenario with rubrics using the view
    console.log("Fetching scenario with rubrics...");
    const { data: scenario, error: scenarioError } = await supabase
      .from("scenario_full_details")
      .select("*")
      .eq("id", session.scenario_id)
      .single();

    if (scenarioError || !scenario) {
      // Fallback to legacy scenario fetch
      console.warn("Could not fetch rubrics, falling back to legacy:", scenarioError);
      const { data: legacyScenario } = await supabase
        .from("scenarios")
        .select("id, title, context, evaluation_criteria, ideal_outcome")
        .eq("id", session.scenario_id)
        .single();

      if (!legacyScenario) {
        return corsErrorResponse("Scenario not found", 404, req);
      }

      // Use legacy evaluation (pass/fail)
      return await handleLegacyEvaluation(
        supabase,
        session,
        legacyScenario,
        req
      );
    }

    // Check if we have rubrics
    if (!scenario.criteria_with_rubrics || scenario.criteria_with_rubrics.length === 0) {
      console.warn("No rubrics found, falling back to legacy evaluation");
      return await handleLegacyEvaluation(
        supabase,
        session,
        {
          id: scenario.id,
          title: scenario.title,
          context: scenario.context,
          ideal_outcome: scenario.ideal_outcome,
          evaluation_criteria: [], // Will use legacy criteria
        },
        req
      );
    }

    const scenarioWithRubrics: ScenarioWithRubrics = {
      id: scenario.id,
      title: scenario.title,
      context: scenario.context,
      ideal_outcome: scenario.ideal_outcome,
      criteria_with_rubrics: scenario.criteria_with_rubrics,
      objections_detailed: scenario.objections_detailed || [],
      duration_min_seconds: scenario.duration_min_seconds,
      duration_max_seconds: scenario.duration_max_seconds,
    };

    // Fetch possible outcomes for this scenario
    const { data: scenarioOutcomes } = await supabase
      .from("scenario_outcomes")
      .select("*")
      .eq("scenario_id", session.scenario_id)
      .order("display_order");

    const outcomes: ScenarioOutcome[] = (scenarioOutcomes || []).map((o) => ({
      id: o.id,
      outcome_type: o.outcome_type as SessionOutcome,
      description: o.description || "",
      is_positive: o.is_positive || false,
      trigger_condition: o.trigger_condition || {},
      avatar_closing_line: o.avatar_closing_line || "",
      display_order: o.display_order || 0,
    }));

    console.log(`Loaded ${outcomes.length} possible outcomes for scenario`);

    // Build prompt with rubrics and outcomes
    const prompt = buildRubricEvaluationPrompt(scenarioWithRubrics, session.transcript, outcomes);

    // Initialize Anthropic client
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      console.error("ANTHROPIC_API_KEY not configured, saving minimal feedback");
      return await saveMinimalFeedback(
        supabase,
        session_id,
        "Servico de analise temporariamente indisponivel. A transcricao foi registrada para revisao posterior.",
        req
      );
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Call Claude API with retry logic
    console.log("Calling Claude API for rubric evaluation...");

    const message = await withRetry(
      async () => {
        return await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096, // Increased for more detailed response
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        });
      },
      {
        maxAttempts: 3,
        initialDelay: 1000,
        onRetry: (attempt, error, delay) => {
          console.log(`Claude API retry ${attempt}, waiting ${delay}ms:`, error.message);
        },
      }
    );

    // Extract response text
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract token usage
    const claudeInputTokens = message.usage?.input_tokens ?? 0;
    const claudeOutputTokens = message.usage?.output_tokens ?? 0;
    console.log(`Claude API tokens: ${claudeInputTokens} input, ${claudeOutputTokens} output`);

    // Update api_metrics
    try {
      await supabase
        .from("api_metrics")
        .update({
          claude_input_tokens: claudeInputTokens,
          claude_output_tokens: claudeOutputTokens,
        })
        .eq("session_id", session_id);
    } catch (metricsError) {
      console.warn("Failed to update api_metrics:", metricsError);
    }

    // Parse Claude's response
    let feedbackData: FeedbackResponse;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      feedbackData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response, saving minimal feedback:", responseText.substring(0, 200));
      return await saveMinimalFeedback(
        supabase,
        session_id,
        "Analise automatica indisponivel no momento. A transcricao foi registrada para revisao posterior.",
        req
      );
    }

    // Validate and normalize criteria scores
    const normalizedScores: CriteriaScore[] = scenarioWithRubrics.criteria_with_rubrics.map(
      (c) => {
        const result = feedbackData.criteria_scores?.find(
          (r) => r.criterion_id === c.id
        );
        if (result) {
          // Find actual index in transcript
          const startIndex = findQuoteIndex(
            session.transcript!,
            result.evidence_excerpt || ""
          );
          return {
            criterion_id: c.id,
            criterion_name: c.name,
            level: Math.max(1, Math.min(4, result.level || 1)) as 1 | 2 | 3 | 4,
            weight: c.weight,
            observation: result.observation || "Nao avaliado",
            evidence_excerpt: result.evidence_excerpt || "",
            evidence_start_index: startIndex !== -1 ? startIndex : 0,
            evidence_end_index:
              startIndex !== -1
                ? startIndex + (result.evidence_excerpt?.length || 0)
                : 0,
          };
        }
        return {
          criterion_id: c.id,
          criterion_name: c.name,
          level: 1 as const,
          weight: c.weight,
          observation: "Criterio nao abordado na conversa",
          evidence_excerpt: "",
          evidence_start_index: 0,
          evidence_end_index: 0,
        };
      }
    );

    // Calculate scores
    const weightedScore = calculateWeightedScore(normalizedScores);
    const legacyResults = convertToLegacyFormat(normalizedScores);
    const legacyScore = Math.round(
      (legacyResults.filter((r) => r.passed).length / legacyResults.length) * 100
    );

    // Determine confidence level
    const confidenceLevel = feedbackData.confidence_level || "medium";
    const transcriptCoverage = feedbackData.transcript_coverage || 0.8;

    // Save feedback to database
    const { data: feedback, error: feedbackError } = await supabase
      .from("feedbacks")
      .insert({
        session_id: session_id,
        // Legacy fields
        criteria_results: legacyResults,
        summary: feedbackData.summary || "Avaliacao concluida.",
        score: legacyScore,
        // New PRD 08 fields
        criteria_scores: normalizedScores,
        weighted_score: weightedScore,
        confidence_level: confidenceLevel,
        transcript_coverage: transcriptCoverage,
        key_moments: feedbackData.key_moments || [],
        omissions: feedbackData.omissions || [],
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("Failed to save feedback:", feedbackError);
      return corsErrorResponse("Failed to save feedback", 500, req);
    }

    // Save evidences to session_evidences table
    const evidencesToInsert = normalizedScores
      .filter((s) => s.evidence_excerpt && s.evidence_start_index > 0)
      .map((s) => ({
        session_id: session_id,
        criterion_id: s.criterion_id,
        transcript_start_index: s.evidence_start_index,
        transcript_end_index: s.evidence_end_index,
        transcript_excerpt: s.evidence_excerpt,
        evidence_type: "criterion",
        label: s.criterion_name.toLowerCase().replace(/\s+/g, "_"),
        confidence: 1.0,
      }));

    // Add key moments as evidences
    const keyMomentEvidences = (feedbackData.key_moments || [])
      .filter((km) => km.quote)
      .map((km) => {
        const startIndex = findQuoteIndex(session.transcript!, km.quote);
        return {
          session_id: session_id,
          criterion_id: `km_${km.type}`,
          transcript_start_index: startIndex !== -1 ? startIndex : 0,
          transcript_end_index:
            startIndex !== -1 ? startIndex + km.quote.length : 0,
          transcript_excerpt: km.quote,
          evidence_type: "key_moment",
          label: km.type,
          confidence: 0.9,
        };
      });

    if (evidencesToInsert.length > 0 || keyMomentEvidences.length > 0) {
      await supabase
        .from("session_evidences")
        .insert([...evidencesToInsert, ...keyMomentEvidences]);
    }

    // Save objection statuses
    const objectionStatuses = feedbackData.objection_statuses || [];
    if (objectionStatuses.length > 0) {
      const objectionRecords = objectionStatuses.map((os) => ({
        session_id: session_id,
        objection_id: os.objection_id,
        status: os.status,
        detected_at_ms: os.detected_index ? os.detected_index * 10 : null, // Rough estimate
        detected_transcript_index: os.detected_index || null,
        addressed_at_ms: os.addressed_index ? os.addressed_index * 10 : null,
        addressed_transcript_index: os.addressed_index || null,
        recommendation: os.recommendation || null,
      }));

      await supabase.from("session_objection_status").insert(objectionRecords);
    }

    // PRD 08, US-13: Validate session
    const validation = validateSession(
      session.transcript,
      session.duration_seconds,
      session.has_avatar_fallback || false,
      confidenceLevel,
      transcriptCoverage,
      scenario.duration_min_seconds || 120,  // From scenario or default 2 min
      scenario.duration_max_seconds || 600   // From scenario or default 10 min
    );

    // Determine outcome from Claude's response or fallback based on score
    let sessionOutcome: SessionOutcome | null = null;
    const outcomeReasoning = feedbackData.outcome_reasoning || null;

    if (feedbackData.outcome) {
      sessionOutcome = feedbackData.outcome;
    } else {
      // Fallback: determine outcome based on weighted score
      if (weightedScore >= 80) {
        sessionOutcome = "sale_closed";
      } else if (weightedScore >= 70) {
        sessionOutcome = "meeting_scheduled";
      } else if (weightedScore >= 60) {
        sessionOutcome = "proposal_requested";
      } else if (weightedScore >= 50) {
        sessionOutcome = "needs_follow_up";
      } else {
        sessionOutcome = "rejected";
      }
    }

    // Update session with validation result and outcome
    await supabase
      .from("sessions")
      .update({
        is_valid: validation.is_valid,
        validation_reasons: validation.validation_reasons,
        outcome: sessionOutcome,
        outcome_determined_by: feedbackData.outcome ? "ai" : "score_fallback",
      })
      .eq("id", session_id);

    console.log(`Session validation: is_valid=${validation.is_valid}, reasons=${JSON.stringify(validation.validation_reasons)}`);
    console.log(`Session outcome: ${sessionOutcome} (determined by: ${feedbackData.outcome ? "ai" : "score_fallback"})`);

    // Adjust difficulty level based on session score (only for valid sessions)
    let difficultyAdjustment: { new_level: number; level_changed: boolean; adjustment_reason: string } | null = null;

    if (validation.is_valid && session.access_code_id) {
      try {
        // Call the adjust_difficulty_level function
        const { data: adjustmentData, error: adjustmentError } = await supabase
          .rpc("adjust_difficulty_level", {
            p_access_code_id: session.access_code_id,
            p_session_score: Math.round(weightedScore),
          });

        if (adjustmentError) {
          console.warn("Failed to adjust difficulty level:", adjustmentError);
        } else if (adjustmentData && adjustmentData.length > 0) {
          difficultyAdjustment = adjustmentData[0];
          console.log(`Difficulty adjustment: level=${difficultyAdjustment?.new_level}, changed=${difficultyAdjustment?.level_changed}, reason=${difficultyAdjustment?.adjustment_reason}`);
        }
      } catch (e) {
        console.warn("Error adjusting difficulty:", e);
      }
    }

    // Update learning profile with session results
    if (session.access_code_id) {
      try {
        // Prepare criteria scores for the learning profile
        const criteriaScoresForProfile = normalizedScores.map((score) => ({
          criterion_id: score.criterion_id,
          level: score.level,
        }));

        // Prepare objection statuses for the learning profile
        const objectionStatusesForProfile = objectionStatuses.map((os) => ({
          objection_id: os.objection_id,
          status: os.status,
        }));

        const { error: profileError } = await supabase.rpc(
          "update_learning_profile_after_session",
          {
            p_access_code_id: session.access_code_id,
            p_session_score: weightedScore,
            p_is_valid: validation.is_valid,
            p_criteria_scores: criteriaScoresForProfile,
            p_objection_statuses: objectionStatusesForProfile,
            p_outcome: sessionOutcome,
          }
        );

        if (profileError) {
          console.warn("Failed to update learning profile:", profileError);
        } else {
          console.log("Learning profile updated successfully");

          // Analyze recurring patterns after a few sessions
          const { error: patternError } = await supabase.rpc(
            "analyze_recurring_patterns",
            { p_access_code_id: session.access_code_id }
          );

          if (patternError) {
            console.warn("Failed to analyze patterns:", patternError);
          }
        }
      } catch (e) {
        console.warn("Error updating learning profile:", e);
      }
    }

    // Return success response
    return corsJsonResponse(
      {
        feedback_id: feedback.id,
        // Legacy format
        criteria_results: legacyResults,
        score: legacyScore,
        // New PRD 08 format
        criteria_scores: normalizedScores,
        weighted_score: weightedScore,
        confidence_level: confidenceLevel,
        transcript_coverage: transcriptCoverage,
        key_moments: feedbackData.key_moments || [],
        omissions: feedbackData.omissions || [],
        objection_statuses: objectionStatuses,
        summary: feedbackData.summary,
        // Session outcome
        outcome: sessionOutcome,
        outcome_reasoning: outcomeReasoning,
        // Difficulty adjustment
        difficulty_adjustment: difficultyAdjustment
          ? {
              current_level: difficultyAdjustment.new_level,
              level_changed: difficultyAdjustment.level_changed,
              adjustment_reason: difficultyAdjustment.adjustment_reason,
            }
          : null,
      },
      200,
      req
    );
  } catch (error) {
    console.error("Error in generate-feedback:", error);
    // Try to save minimal feedback instead of returning error
    if (session_id && supabase) {
      try {
        return await saveMinimalFeedback(
          supabase,
          session_id,
          "Erro inesperado durante a analise. A transcricao foi registrada para revisao posterior.",
          req
        );
      } catch (fallbackError) {
        console.error("Failed to save fallback minimal feedback:", fallbackError);
      }
    }
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});

/**
 * Handle legacy evaluation (pass/fail) when rubrics are not available
 */
async function handleLegacyEvaluation(
  supabase: ReturnType<typeof createClient>,
  session: { id: string; transcript: string; scenario_id: string; emotion_history?: unknown[] | null; transcript_metadata?: unknown[] | null },
  scenario: {
    id: string;
    title: string;
    context: string;
    evaluation_criteria: { id: string; description: string }[];
    ideal_outcome?: string;
  },
  req: Request
) {
  // Fetch criteria from scenarios table if not in view
  if (!scenario.evaluation_criteria || scenario.evaluation_criteria.length === 0) {
    const { data: fullScenario } = await supabase
      .from("scenarios")
      .select("evaluation_criteria")
      .eq("id", scenario.id)
      .single();

    if (fullScenario?.evaluation_criteria) {
      scenario.evaluation_criteria = fullScenario.evaluation_criteria;
    }
  }

  const criteria = scenario.evaluation_criteria || [];
  if (criteria.length === 0) {
    console.warn("No evaluation criteria for scenario:", scenario.id, "— saving minimal feedback");
    return await saveMinimalFeedback(
      supabase,
      session.id,
      "Cenario sem criterios de avaliacao definidos. A transcricao foi registrada para revisao.",
      req
    );
  }

  const criteriaText = criteria
    .map((c, i) => `${i + 1}. [${c.id}] ${c.description}`)
    .join("\n");

  const prompt = buildLegacyPrompt(scenario, session.transcript!, criteriaText, session.emotion_history as any, session.transcript_metadata as any);

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY not configured (legacy), saving minimal feedback");
    return await saveMinimalFeedback(
      supabase,
      session.id,
      "Servico de analise temporariamente indisponivel. A transcricao foi registrada para revisao posterior.",
      req
    );
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const message = await withRetry(
    async () => {
      return await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
    },
    { maxAttempts: 3, initialDelay: 1000 }
  );

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  let feedbackData: { criteria_results: CriteriaResult[]; key_moments?: KeyMoment[]; summary: string };
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    feedbackData = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("Failed to parse Claude legacy response, saving minimal feedback");
    return await saveMinimalFeedback(
      supabase,
      session.id,
      "Analise automatica indisponivel no momento. A transcricao foi registrada para revisao posterior.",
      req
    );
  }

  const normalizedResults = criteria.map((c) => {
    const result = feedbackData.criteria_results?.find((r) => r.criteria_id === c.id);
    return {
      criteria_id: c.id,
      passed: result?.passed ?? false,
      observation: result?.observation ?? "Nao avaliado",
    };
  });

  const passedCount = normalizedResults.filter((r) => r.passed).length;
  const finalScore = Math.round((passedCount / criteria.length) * 100);

  const { data: feedback, error: feedbackError } = await supabase
    .from("feedbacks")
    .insert({
      session_id: session.id,
      criteria_results: normalizedResults,
      summary: feedbackData.summary || "Avaliacao concluida.",
      score: finalScore,
      key_moments: feedbackData.key_moments || [],
    })
    .select()
    .single();

  if (feedbackError) {
    return corsErrorResponse("Failed to save feedback", 500, req);
  }

  return corsJsonResponse(
    {
      feedback_id: feedback.id,
      criteria_results: normalizedResults,
      key_moments: feedbackData.key_moments || [],
      summary: feedbackData.summary,
      score: finalScore,
    },
    200,
    req
  );
}

/**
 * Build legacy prompt for pass/fail evaluation
 */
function formatEmotionTimeline(emotionHistory: Array<{t: string; emotion: string; intensity: number; turn: number}> | null): string {
  if (!emotionHistory || emotionHistory.length === 0) return "";
  const timeline = emotionHistory.map((e) => {
    const time = e.t ? new Date(e.t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "?";
    return `[${time}] ${e.emotion} (${e.intensity}%)`;
  }).join(" → ");
  return `\nEVOLUCAO EMOCIONAL DO CLIENTE (detectada por IA durante a sessao):
${timeline}
Use esta informacao para avaliar se o vendedor conseguiu melhorar o estado emocional do cliente ao longo da conversa.\n`;
}

function formatTranscriptInsights(
  metadata: Array<{speaker: string; text: string; timestamp: string; turn: number; char_count: number; response_latency_ms?: number}> | null
): string {
  if (!metadata || metadata.length === 0) return "";

  const userTurns = metadata.filter((m) => m.speaker === "Usuario");
  const avatarTurns = metadata.filter((m) => m.speaker === "Avatar");

  // Calculate average response lengths
  const avgUserLen = userTurns.length > 0
    ? Math.round(userTurns.reduce((sum, t) => sum + t.char_count, 0) / userTurns.length)
    : 0;
  const avgAvatarLen = avatarTurns.length > 0
    ? Math.round(avatarTurns.reduce((sum, t) => sum + t.char_count, 0) / avatarTurns.length)
    : 0;

  // Calculate session duration from timestamps
  let durationInfo = "";
  if (metadata.length >= 2) {
    const first = new Date(metadata[0].timestamp).getTime();
    const last = new Date(metadata[metadata.length - 1].timestamp).getTime();
    const durationSec = Math.round((last - first) / 1000);
    if (durationSec > 0) {
      durationInfo = `Duracao da conversa: ${Math.floor(durationSec / 60)}min ${durationSec % 60}s`;
    }
  }

  // Find very short user responses (may indicate hesitation/disengagement)
  const shortResponses = userTurns.filter((t) => t.char_count < 20);

  let insights = `\nMETRICAS DA CONVERSA:\n`;
  insights += `- Turnos: ${userTurns.length} do usuario, ${avatarTurns.length} do avatar\n`;
  insights += `- Comprimento medio: usuario ${avgUserLen} chars, avatar ${avgAvatarLen} chars\n`;
  if (durationInfo) insights += `- ${durationInfo}\n`;
  if (shortResponses.length > 2) {
    insights += `- ${shortResponses.length} respostas curtas do usuario (<20 chars) — pode indicar hesitacao ou desengajamento\n`;
  }
  insights += `Use estas metricas para contextualizar a qualidade do engajamento do vendedor.\n`;
  return insights;
}

function buildLegacyPrompt(
  scenario: { context: string; ideal_outcome?: string },
  transcript: string,
  criteriaText: string,
  emotionHistory?: Array<{t: string; emotion: string; intensity: number; turn: number}> | null,
  transcriptMetadata?: Array<{speaker: string; text: string; timestamp: string; turn: number; char_count: number; response_latency_ms?: number}> | null,
): string {
  const emotionSection = formatEmotionTimeline(emotionHistory ?? null);
  const metricsSection = formatTranscriptInsights(transcriptMetadata ?? null);
  return `Voce e um avaliador especializado em treinamentos de vendas.
Analise a transcricao e avalie se cada criterio foi ATENDIDO (passed: true) ou NAO ATENDIDO (passed: false).

CONTEXTO: ${scenario.context}
${scenario.ideal_outcome ? `RESULTADO IDEAL: ${scenario.ideal_outcome}` : ""}

CRITERIOS:
${criteriaText}
${emotionSection}${metricsSection}
TRANSCRICAO:
${transcript}

Retorne JSON:
{
  "criteria_results": [{"criteria_id": "crit_1", "passed": true, "observation": "..."}],
  "key_moments": [{"type": "positive", "quote": "...", "explanation": "..."}],
  "summary": "..."
}`;
}
