/**
 * Edge Function: generate-scenario
 *
 * Uses Claude AI to generate complete scenario structures from
 * natural language descriptions. Admin-only endpoint.
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

// Request type
interface GenerateRequest {
  access_code: string;
  description: string;
  industry?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// Generated scenario structure
interface GeneratedObjection {
  id: string;
  description: string;
}

interface GeneratedCriterion {
  id: string;
  description: string;
}

interface GeneratedScenario {
  title: string;
  context: string;
  avatar_profile: string;
  objections: GeneratedObjection[];
  evaluation_criteria: GeneratedCriterion[];
  ideal_outcome: string;
  suggested_voice: string;
}

// Build prompt for scenario generation
function buildGenerationPrompt(
  description: string,
  industry?: string,
  difficulty?: string
): string {
  const industryContext = industry
    ? `\nINDUSTRIA ESPECIFICA: ${industry}
Adapte o cenario para esta industria, usando terminologia e situacoes comuns do setor.`
    : "";

  const difficultyContext = difficulty
    ? `\nNIVEL DE DIFICULDADE: ${difficulty}
${
      difficulty === "easy"
        ? "Crie um cenario com objecoes mais simples e um cliente relativamente receptivo."
        : difficulty === "hard"
        ? "Crie um cenario desafiador com objecoes complexas e um cliente dificil de convencer."
        : "Crie um cenario com dificuldade moderada e objecoes realistas."
    }`
    : "";

  return `Voce e um especialista em treinamento de vendas e criacao de cenarios de roleplay.
Crie um cenario completo de treinamento baseado na descricao fornecida pelo usuario.

═══════════════════════════════════════════════════════════════
DESCRICAO DO USUARIO:
═══════════════════════════════════════════════════════════════
${description}
${industryContext}
${difficultyContext}

═══════════════════════════════════════════════════════════════
INSTRUCOES PARA CRIACAO DO CENARIO:
═══════════════════════════════════════════════════════════════

Gere um cenario estruturado com os seguintes elementos:

1. TITULO (title):
   - Nome curto e descritivo (maximo 50 caracteres)
   - Deve indicar claramente o tipo de situacao

2. CONTEXTO (context):
   - Descricao detalhada da situacao (2-3 paragrafos)
   - Inclua: quem e o cliente, qual produto/servico, situacao atual
   - Seja especifico sobre o momento da venda/negociacao

3. PERFIL DO AVATAR (avatar_profile):
   - Nome, idade e cargo do cliente
   - Personalidade e estilo de comunicacao
   - Motivacoes, preocupacoes e possiveis resistencias
   - 1-2 paragrafos descritivos

4. OBJECOES (objections):
   - Lista de 3-5 objecoes realistas que o cliente apresentara
   - Varie o tipo: preco, prazo, confianca, competidor, etc.
   - Cada objecao deve ter um ID unico (obj_1, obj_2, etc.)

5. CRITERIOS DE AVALIACAO (evaluation_criteria):
   - 4-6 criterios claros e mensuraveis
   - Focados em tecnicas de venda especificas
   - Cada criterio deve ter um ID unico (crit_1, crit_2, etc.)

6. RESULTADO IDEAL (ideal_outcome):
   - Descricao do que seria uma venda/negociacao bem-sucedida
   - 1-2 frases objetivas

7. VOZ SUGERIDA (suggested_voice):
   - Escolha UMA das opcoes: "Puck", "Charon", "Kore", "Fenrir", "Aoede"
   - Puck: voz masculina jovem e amigavel
   - Charon: voz masculina madura e seria
   - Kore: voz feminina jovem e energica
   - Fenrir: voz masculina grave e autoritaria
   - Aoede: voz feminina madura e profissional
   - Escolha baseada no perfil do avatar

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA:
═══════════════════════════════════════════════════════════════

Retorne APENAS um JSON valido (sem markdown, sem comentarios) com esta estrutura exata:

{
  "title": "Titulo do Cenario",
  "context": "Descricao completa do contexto...",
  "avatar_profile": "Perfil detalhado do avatar/cliente...",
  "objections": [
    {"id": "obj_1", "description": "Primeira objecao..."},
    {"id": "obj_2", "description": "Segunda objecao..."},
    {"id": "obj_3", "description": "Terceira objecao..."}
  ],
  "evaluation_criteria": [
    {"id": "crit_1", "description": "Primeiro criterio de avaliacao..."},
    {"id": "crit_2", "description": "Segundo criterio de avaliacao..."},
    {"id": "crit_3", "description": "Terceiro criterio de avaliacao..."},
    {"id": "crit_4", "description": "Quarto criterio de avaliacao..."}
  ],
  "ideal_outcome": "Descricao do resultado ideal...",
  "suggested_voice": "Puck"
}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const body: GenerateRequest = await req.json();

    // Validate required fields
    if (!body.access_code) {
      return corsErrorResponse("Missing access_code", 400, req);
    }
    if (!body.description?.trim()) {
      return corsErrorResponse("Missing description", 400, req);
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate access code is admin
    const { data: codeData, error: codeError } = await supabase
      .from("access_codes")
      .select("id, role")
      .eq("code", body.access_code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (codeError || !codeData) {
      return corsErrorResponse("Invalid or inactive access code", 401, req);
    }

    if (codeData.role !== "admin") {
      return corsErrorResponse("Admin access required", 403, req);
    }

    // Initialize Anthropic client
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicApiKey) {
      return corsErrorResponse("Anthropic API not configured", 500, req);
    }

    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    // Build prompt
    const prompt = buildGenerationPrompt(
      body.description,
      body.industry,
      body.difficulty
    );

    console.log("Generating scenario for description:", body.description.substring(0, 100));

    // Call Claude API with retry logic
    const message = await withRetry(
      async () => {
        return await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
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

    // Log token usage
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    console.log(`Claude API tokens: ${inputTokens} input, ${outputTokens} output`);

    // Parse Claude's response
    let generatedScenario: GeneratedScenario;
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      generatedScenario = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return corsErrorResponse(
        "Failed to parse AI response. Please try again.",
        500,
        req
      );
    }

    // Validate required fields in generated scenario
    const requiredFields = [
      "title",
      "context",
      "avatar_profile",
      "objections",
      "evaluation_criteria",
      "ideal_outcome",
    ];

    for (const field of requiredFields) {
      if (!generatedScenario[field as keyof GeneratedScenario]) {
        return corsErrorResponse(
          `Generated scenario missing required field: ${field}`,
          500,
          req
        );
      }
    }

    // Validate arrays have content
    if (!Array.isArray(generatedScenario.objections) || generatedScenario.objections.length === 0) {
      return corsErrorResponse("Generated scenario has no objections", 500, req);
    }

    if (
      !Array.isArray(generatedScenario.evaluation_criteria) ||
      generatedScenario.evaluation_criteria.length === 0
    ) {
      return corsErrorResponse("Generated scenario has no evaluation criteria", 500, req);
    }

    // Ensure objections have proper IDs
    generatedScenario.objections = generatedScenario.objections.map((obj, index) => ({
      id: obj.id || `obj_${index + 1}`,
      description: obj.description,
    }));

    // Ensure criteria have proper IDs
    generatedScenario.evaluation_criteria = generatedScenario.evaluation_criteria.map(
      (crit, index) => ({
        id: crit.id || `crit_${index + 1}`,
        description: crit.description,
      })
    );

    // Validate suggested voice
    const validVoices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"];
    if (!validVoices.includes(generatedScenario.suggested_voice)) {
      generatedScenario.suggested_voice = "Puck"; // Default
    }

    // Return generated scenario (not saved yet - user will review and save)
    return corsJsonResponse(
      {
        success: true,
        scenario: generatedScenario,
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
        },
      },
      200,
      req
    );
  } catch (error) {
    console.error("Error in generate-scenario:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});
