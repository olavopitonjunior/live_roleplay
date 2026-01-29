/**
 * Edge Function: suggest-scenario-fields
 *
 * Uses Claude AI to generate complementary scenario fields
 * based on user-provided title and context.
 * Supports generating all fields or a single specific field.
 * Admin-only endpoint.
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

// Field types that can be generated
type FieldType = 'avatar_profile' | 'objections' | 'evaluation_criteria' | 'ideal_outcome' | 'all';

// Request type
interface SuggestRequest {
  access_code: string;
  title: string;
  context: string;
  field?: FieldType; // Optional: generate only this field, default 'all'
}

// Generated fields structure
interface SuggestedFields {
  avatar_profile?: string;
  objections?: { id: string; description: string }[];
  evaluation_criteria?: { id: string; description: string }[];
  ideal_outcome?: string;
  suggested_voice?: string;
}

// Build prompt for generating a single field
function buildSingleFieldPrompt(title: string, context: string, field: FieldType): string {
  const baseContext = `Voce e um especialista em treinamento de vendas e criacao de cenarios de roleplay.
Com base no titulo e contexto fornecidos, gere o campo solicitado.

TITULO: ${title}

CONTEXTO: ${context}

`;

  switch (field) {
    case 'avatar_profile':
      return baseContext + `INSTRUCAO: Gere o PERFIL DO AVATAR (avatar_profile):
- Crie um nome, idade e cargo para o cliente/prospect
- Defina personalidade e estilo de comunicacao
- Inclua motivacoes, preocupacoes e resistencias
- 1-2 paragrafos descritivos

Tambem sugira uma voz (suggested_voice) entre: "Puck" (masculina jovem), "Charon" (masculina madura), "Kore" (feminina jovem), "Fenrir" (masculina grave), "Aoede" (feminina madura).

Retorne APENAS JSON:
{"avatar_profile": "...", "suggested_voice": "Puck"}`;

    case 'objections':
      return baseContext + `INSTRUCAO: Gere as OBJECOES DO CLIENTE (objections):
- 3-5 objecoes realistas que o cliente apresentara
- Baseie-se no contexto para criar objecoes especificas
- Varie: preco, prazo, confianca, competidor, necessidade, etc.
- Cada objecao deve ter ID unico (obj_1, obj_2, etc.)

Retorne APENAS JSON:
{"objections": [{"id": "obj_1", "description": "..."}, ...]}`;

    case 'evaluation_criteria':
      return baseContext + `INSTRUCAO: Gere os CRITERIOS DE AVALIACAO (evaluation_criteria):
- 4-6 criterios claros e mensuraveis
- Focados em tecnicas de venda aplicaveis ao contexto
- Cada criterio deve ter ID unico (crit_1, crit_2, etc.)

Retorne APENAS JSON:
{"evaluation_criteria": [{"id": "crit_1", "description": "..."}, ...]}`;

    case 'ideal_outcome':
      return baseContext + `INSTRUCAO: Gere o RESULTADO IDEAL (ideal_outcome):
- Descricao de uma venda/negociacao bem-sucedida
- 1-2 frases objetivas baseadas no contexto

Retorne APENAS JSON:
{"ideal_outcome": "..."}`;

    default:
      return buildAllFieldsPrompt(title, context);
  }
}

// Build prompt for all fields (original behavior)
function buildAllFieldsPrompt(title: string, context: string): string {
  return `Voce e um especialista em treinamento de vendas e criacao de cenarios de roleplay.
Com base no titulo e contexto fornecidos pelo usuario, gere os campos complementares para completar o cenario.

═══════════════════════════════════════════════════════════════
TITULO DO CENARIO:
═══════════════════════════════════════════════════════════════
${title}

═══════════════════════════════════════════════════════════════
CONTEXTO FORNECIDO PELO USUARIO:
═══════════════════════════════════════════════════════════════
${context}

═══════════════════════════════════════════════════════════════
INSTRUCOES:
═══════════════════════════════════════════════════════════════

Com base no titulo e contexto acima, gere APENAS os seguintes campos:

1. PERFIL DO AVATAR (avatar_profile):
   - Crie um nome, idade e cargo para o cliente/prospect
   - Defina personalidade e estilo de comunicacao
   - Inclua motivacoes, preocupacoes e resistencias
   - 1-2 paragrafos descritivos que complementem o contexto

2. OBJECOES (objections):
   - 3-5 objecoes realistas que o cliente apresentara
   - Baseie-se no contexto para criar objecoes especificas
   - Varie: preco, prazo, confianca, competidor, necessidade, etc.
   - Cada objecao deve ter ID unico (obj_1, obj_2, etc.)

3. CRITERIOS DE AVALIACAO (evaluation_criteria):
   - 4-6 criterios claros e mensuraveis
   - Focados em tecnicas de venda aplicaveis ao contexto
   - Cada criterio deve ter ID unico (crit_1, crit_2, etc.)

4. RESULTADO IDEAL (ideal_outcome):
   - Descricao de uma venda/negociacao bem-sucedida
   - 1-2 frases objetivas baseadas no contexto

5. VOZ SUGERIDA (suggested_voice):
   - Escolha UMA: "Puck", "Charon", "Kore", "Fenrir", "Aoede"
   - Puck: masculina jovem, amigavel
   - Charon: masculina madura, seria
   - Kore: feminina jovem, energica
   - Fenrir: masculina grave, autoritaria
   - Aoede: feminina madura, profissional
   - Baseie-se no perfil do avatar

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA:
═══════════════════════════════════════════════════════════════

Retorne APENAS um JSON valido (sem markdown, sem comentarios):

{
  "avatar_profile": "Perfil detalhado do avatar/cliente...",
  "objections": [
    {"id": "obj_1", "description": "Primeira objecao..."},
    {"id": "obj_2", "description": "Segunda objecao..."},
    {"id": "obj_3", "description": "Terceira objecao..."}
  ],
  "evaluation_criteria": [
    {"id": "crit_1", "description": "Primeiro criterio..."},
    {"id": "crit_2", "description": "Segundo criterio..."},
    {"id": "crit_3", "description": "Terceiro criterio..."},
    {"id": "crit_4", "description": "Quarto criterio..."}
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
    const body: SuggestRequest = await req.json();
    const fieldToGenerate: FieldType = body.field || 'all';

    // Validate required fields
    if (!body.access_code) {
      return corsErrorResponse("Missing access_code", 400, req);
    }
    if (!body.title?.trim()) {
      return corsErrorResponse("Missing title", 400, req);
    }
    if (!body.context?.trim()) {
      return corsErrorResponse("Missing context", 400, req);
    }
    if (body.context.trim().length < 50) {
      return corsErrorResponse(
        "Context must be at least 50 characters for AI to generate quality suggestions",
        400,
        req
      );
    }

    // Validate field parameter
    const validFields: FieldType[] = ['avatar_profile', 'objections', 'evaluation_criteria', 'ideal_outcome', 'all'];
    if (!validFields.includes(fieldToGenerate)) {
      return corsErrorResponse(
        `Invalid field: ${fieldToGenerate}. Valid options: ${validFields.join(', ')}`,
        400,
        req
      );
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

    // Build prompt based on field
    const prompt = fieldToGenerate === 'all'
      ? buildAllFieldsPrompt(body.title, body.context)
      : buildSingleFieldPrompt(body.title, body.context, fieldToGenerate);

    console.log(
      `Generating ${fieldToGenerate} for:`,
      body.title.substring(0, 50)
    );

    // Use smaller max_tokens for single fields
    const maxTokens = fieldToGenerate === 'all' ? 2048 : 1024;

    // Call Claude API with retry logic
    const message = await withRetry(
      async () => {
        return await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
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
          console.log(
            `Claude API retry ${attempt}, waiting ${delay}ms:`,
            error.message
          );
        },
      }
    );

    // Extract response text
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Log token usage
    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    console.log(
      `Claude API tokens: ${inputTokens} input, ${outputTokens} output`
    );

    // Parse Claude's response
    let suggestedFields: SuggestedFields;
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      suggestedFields = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return corsErrorResponse(
        "Failed to parse AI response. Please try again.",
        500,
        req
      );
    }

    // Validate and normalize based on field type
    if (fieldToGenerate === 'all' || fieldToGenerate === 'avatar_profile') {
      if (fieldToGenerate === 'all' && !suggestedFields.avatar_profile) {
        return corsErrorResponse("Missing avatar_profile in response", 500, req);
      }
    }

    if (fieldToGenerate === 'all' || fieldToGenerate === 'objections') {
      if (suggestedFields.objections) {
        if (!Array.isArray(suggestedFields.objections) || suggestedFields.objections.length === 0) {
          if (fieldToGenerate === 'objections') {
            return corsErrorResponse("No objections generated", 500, req);
          }
        } else {
          // Ensure objections have proper IDs
          suggestedFields.objections = suggestedFields.objections.map(
            (obj, index) => ({
              id: obj.id || `obj_${index + 1}`,
              description: obj.description,
            })
          );
        }
      } else if (fieldToGenerate === 'all') {
        return corsErrorResponse("Missing objections in response", 500, req);
      }
    }

    if (fieldToGenerate === 'all' || fieldToGenerate === 'evaluation_criteria') {
      if (suggestedFields.evaluation_criteria) {
        if (!Array.isArray(suggestedFields.evaluation_criteria) || suggestedFields.evaluation_criteria.length === 0) {
          if (fieldToGenerate === 'evaluation_criteria') {
            return corsErrorResponse("No evaluation criteria generated", 500, req);
          }
        } else {
          // Ensure criteria have proper IDs
          suggestedFields.evaluation_criteria = suggestedFields.evaluation_criteria.map(
            (crit, index) => ({
              id: crit.id || `crit_${index + 1}`,
              description: crit.description,
            })
          );
        }
      } else if (fieldToGenerate === 'all') {
        return corsErrorResponse("Missing evaluation_criteria in response", 500, req);
      }
    }

    if (fieldToGenerate === 'all' || fieldToGenerate === 'ideal_outcome') {
      if (fieldToGenerate === 'all' && !suggestedFields.ideal_outcome) {
        return corsErrorResponse("Missing ideal_outcome in response", 500, req);
      }
    }

    // Validate suggested voice if present
    if (suggestedFields.suggested_voice) {
      const validVoices = ["Puck", "Charon", "Kore", "Fenrir", "Aoede"];
      if (!validVoices.includes(suggestedFields.suggested_voice)) {
        suggestedFields.suggested_voice = "Puck"; // Default
      }
    }

    // Return suggested fields
    return corsJsonResponse(
      {
        success: true,
        field: fieldToGenerate,
        fields: suggestedFields,
        tokens_used: {
          input: inputTokens,
          output: outputTokens,
        },
      },
      200,
      req
    );
  } catch (error) {
    console.error("Error in suggest-scenario-fields:", error);
    return corsErrorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
      req
    );
  }
});
