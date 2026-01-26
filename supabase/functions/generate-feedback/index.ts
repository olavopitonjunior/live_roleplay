/**
 * Edge Function: generate-feedback
 *
 * Analyzes session transcripts using Claude API and generates
 * structured feedback based on scenario evaluation criteria.
 *
 * Improvements:
 * - Secure CORS (whitelist instead of wildcard)
 * - Retry logic with exponential backoff for Claude API
 * - Few-shot examples in prompt for better evaluation
 * - Consistent scoring (always calculated from criteria, not from Claude)
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

interface CriteriaResult {
  criteria_id: string;
  passed: boolean;
  observation: string;
}

interface FeedbackData {
  criteria_results: CriteriaResult[];
  summary: string;
  score: number;
}

interface EvaluationCriterion {
  id: string;
  description: string;
}

interface Scenario {
  id: string;
  title: string;
  context: string;
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome?: string;
}

/**
 * Build the evaluation prompt with few-shot examples for better accuracy
 */
function buildEvaluationPrompt(
  scenario: Scenario,
  transcript: string,
  criteriaText: string
): string {
  const idealOutcomeSection = scenario.ideal_outcome
    ? `
═══════════════════════════════════════════════════════════════
RESULTADO IDEAL ESPERADO:
═══════════════════════════════════════════════════════════════
${scenario.ideal_outcome}
`
    : "";

  return `Voce e um avaliador especializado em treinamentos de vendas e negociacao.
Analise a transcricao abaixo e avalie o desempenho do participante com base nos criterios fornecidos.

═══════════════════════════════════════════════════════════════
EXEMPLOS DE AVALIACAO (para calibrar seu julgamento):
═══════════════════════════════════════════════════════════════

EXEMPLO 1 - Criterio ATENDIDO (passed: true):
Criterio: "Respondeu adequadamente a objecao de preco com argumentos de valor"
Trecho da conversa: 'Usuario: Entendo sua preocupacao com o investimento. Deixa eu contextualizar: este plano oferece cobertura completa para toda sua familia, incluindo assistencia 24 horas. Se compararmos com os custos de uma emergencia medica, o valor mensal representa menos de 2% do que voce gastaria em uma unica internacao.'
Avaliacao: {"criteria_id": "crit_2", "passed": true, "observation": "O participante respondeu a objecao de preco apresentando argumentos de valor concretos: cobertura familiar completa, assistencia 24h, e comparacao custo-beneficio com cenario real."}

EXEMPLO 2 - Criterio NAO ATENDIDO (passed: false):
Criterio: "Respondeu adequadamente a objecao de preco com argumentos de valor"
Trecho da conversa: 'Usuario: Bom, esse e o preco que temos. Posso verificar se existe algum desconto disponivel ou um plano mais basico.'
Avaliacao: {"criteria_id": "crit_2", "passed": false, "observation": "O participante nao apresentou argumentos de valor para justificar o preco. Ao inves disso, ofereceu desconto ou downgrade, desvalorizando o produto sem defender seus beneficios."}

EXEMPLO 3 - Criterio NAO ABORDADO (passed: false):
Criterio: "Criou senso de urgencia sem ser agressivo"
Observacao: Se a conversa terminou antes do participante ter oportunidade de criar urgencia, ou se ele simplesmente nao abordou esse ponto.
Avaliacao: {"criteria_id": "crit_4", "passed": false, "observation": "O criterio nao foi abordado durante a conversa. O participante encerrou sem criar senso de urgencia ou mencionar prazos/oportunidades limitadas."}

═══════════════════════════════════════════════════════════════
CONTEXTO DO CENARIO:
═══════════════════════════════════════════════════════════════
${scenario.context}
${idealOutcomeSection}
═══════════════════════════════════════════════════════════════
CRITERIOS DE AVALIACAO (use os IDs exatos):
═══════════════════════════════════════════════════════════════
${criteriaText}

═══════════════════════════════════════════════════════════════
TRANSCRICAO DA CONVERSA:
═══════════════════════════════════════════════════════════════
${transcript}

═══════════════════════════════════════════════════════════════
INSTRUCOES PARA SUA AVALIACAO:
═══════════════════════════════════════════════════════════════

1. Analise CADA criterio individualmente
2. Para cada criterio, identifique se foi ATENDIDO (passed: true) ou NAO ATENDIDO (passed: false)
3. Nas observacoes, CITE trechos especificos da conversa que justifiquem sua avaliacao
4. Se um criterio nao foi abordado na conversa, considere como NAO ATENDIDO
5. Escreva um resumo geral do desempenho em 2-3 frases

Retorne APENAS um JSON valido (sem markdown, sem comentarios, sem texto adicional) com esta estrutura:

{
  "criteria_results": [
    {
      "criteria_id": "crit_1",
      "passed": true,
      "observation": "Explicacao especifica com citacao da conversa"
    }
  ],
  "summary": "Resumo geral do desempenho destacando pontos fortes e areas de melhoria"
}

IMPORTANTE: O campo "score" sera calculado automaticamente. NAO inclua score no JSON.`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { session_id }: RequestBody = await req.json();
    console.log("generate-feedback called with session_id:", session_id);

    if (!session_id) {
      console.error("Missing session_id in request");
      return corsErrorResponse("Missing session_id", 400, req);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch session with scenario data (including ideal_outcome)
    console.log("Fetching session data...");
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        `
        id,
        transcript,
        scenario_id,
        status,
        scenarios (
          id,
          title,
          context,
          evaluation_criteria,
          ideal_outcome
        )
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
      scenario_id: session.scenario_id
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

    // Validate transcript exists
    if (!session.transcript) {
      console.error("No transcript for session:", session_id, "status:", session.status);
      return corsErrorResponse("No transcript available for this session", 400, req);
    }

    const scenario = session.scenarios as Scenario;
    const criteria = scenario.evaluation_criteria || [];

    if (criteria.length === 0) {
      return corsErrorResponse("No evaluation criteria defined for this scenario", 400, req);
    }

    // Build criteria text for prompt
    const criteriaText = criteria
      .map((c: EvaluationCriterion, i: number) => `${i + 1}. [${c.id}] ${c.description}`)
      .join("\n");

    // Build prompt with few-shot examples
    const prompt = buildEvaluationPrompt(scenario, session.transcript, criteriaText);

    // Initialize Anthropic client
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return corsErrorResponse("Anthropic API not configured", 500, req);
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Call Claude API with retry logic
    console.log("Calling Claude API for session:", session_id);

    const message = await withRetry(
      async () => {
        return await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
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

    // Extract token usage from Claude response for metrics
    const claudeInputTokens = message.usage?.input_tokens ?? 0;
    const claudeOutputTokens = message.usage?.output_tokens ?? 0;
    console.log(`Claude API tokens: ${claudeInputTokens} input, ${claudeOutputTokens} output`);

    // Update api_metrics table with Claude token counts
    try {
      await supabase
        .from("api_metrics")
        .update({
          claude_input_tokens: claudeInputTokens,
          claude_output_tokens: claudeOutputTokens,
        })
        .eq("session_id", session_id);
      console.log("Claude tokens saved to api_metrics");
    } catch (metricsError) {
      // Non-fatal: continue even if metrics update fails
      console.warn("Failed to update api_metrics with Claude tokens:", metricsError);
    }

    // Parse Claude's response
    let feedbackData: Omit<FeedbackData, "score">;
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      feedbackData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return corsErrorResponse(
        "Failed to parse AI response",
        500,
        req
      );
    }

    // Validate and normalize criteria results
    const normalizedResults: CriteriaResult[] = criteria.map(
      (c: EvaluationCriterion) => {
        const result = feedbackData.criteria_results?.find(
          (r) => r.criteria_id === c.id
        );
        return {
          criteria_id: c.id,
          passed: result?.passed ?? false,
          observation: result?.observation ?? "Criterio nao avaliado na analise",
        };
      }
    );

    // ALWAYS calculate score from criteria results (consistent scoring)
    // This ensures score always matches the passed/failed criteria
    const passedCount = normalizedResults.filter((r) => r.passed).length;
    const finalScore = Math.round((passedCount / criteria.length) * 100);

    // Save feedback to database
    const { data: feedback, error: feedbackError } = await supabase
      .from("feedbacks")
      .insert({
        session_id: session_id,
        criteria_results: normalizedResults,
        summary: feedbackData.summary || "Avaliacao concluida.",
        score: finalScore,
      })
      .select()
      .single();

    if (feedbackError) {
      console.error("Failed to save feedback:", feedbackError);
      return corsErrorResponse("Failed to save feedback", 500, req);
    }

    // Return success response
    return corsJsonResponse(
      {
        feedback_id: feedback.id,
        criteria_results: normalizedResults,
        summary: feedbackData.summary,
        score: finalScore,
        passed_count: passedCount,
        total_criteria: criteria.length,
      },
      200,
      req
    );
  } catch (error) {
    console.error("Error in generate-feedback:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});
