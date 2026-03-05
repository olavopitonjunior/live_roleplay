/**
 * Edge Function: suggest-scenario-fields
 *
 * Uses Claude AI to generate complementary scenario fields
 * based on user-provided title and context.
 * Supports generating all fields, a single specific field, or a preview.
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

// Voice mapping: legacy Gemini names -> OpenAI names
const VOICE_MAP: Record<string, string> = {
  Puck: "echo",
  Charon: "ash",
  Kore: "shimmer",
  Fenrir: "sage",
  Aoede: "coral",
};

const VALID_OPENAI_VOICES = ["echo", "ash", "shimmer", "sage", "coral"];

// Field types that can be generated
type FieldType =
  // Original fields
  | 'avatar_profile'
  | 'objections'
  | 'evaluation_criteria'
  | 'ideal_outcome'
  // Bloco Personagem
  | 'character_name'
  | 'character_role'
  | 'personality'
  | 'hidden_objective'
  | 'initial_emotion'
  | 'emotional_reactivity'
  | 'communication_style'
  | 'typical_phrases'
  | 'knowledge_limits'
  | 'backstory'
  // Bloco Situacao
  | 'user_objective'
  | 'opening_line'
  | 'session_type'
  | 'market_context'
  | 'target_duration_seconds'
  | 'success_condition'
  | 'end_condition'
  // Comportamento Dinamico
  | 'phase_flow'
  | 'difficulty_escalation'
  // Bloco Avaliacao
  | 'criteria_weights'
  | 'positive_indicators'
  | 'negative_indicators'
  // Modes
  | 'all'
  | 'preview';

// Request type
interface SuggestRequest {
  access_code: string;
  title: string;
  context: string;
  field?: FieldType; // Optional: generate only this field, default 'all'
}

// Generated fields structure (all optional since single-field mode returns partial)
interface SuggestedFields {
  // Original fields
  avatar_profile?: string;
  objections?: { id: string; description: string }[];
  evaluation_criteria?: { id: string; description: string }[];
  ideal_outcome?: string;
  suggested_voice?: string;
  // Bloco Personagem
  character_name?: string;
  character_role?: string;
  personality?: string;
  hidden_objective?: string;
  initial_emotion?: string;
  emotional_reactivity?: {
    triggers: { event: string; reaction: string; intensity: number }[];
  };
  communication_style?: {
    formality: string;
    verbosity: string;
    patterns: string[];
  };
  typical_phrases?: string[];
  knowledge_limits?: Record<string, unknown>;
  backstory?: string;
  // Bloco Situacao
  user_objective?: string;
  opening_line?: string;
  session_type?: string;
  market_context?: Record<string, unknown>;
  target_duration_seconds?: number;
  success_condition?: string;
  end_condition?: string;
  // Comportamento Dinamico
  phase_flow?: {
    phases: { name: string; duration_pct: number; triggers: string[] }[];
  };
  difficulty_escalation?: {
    stages: { threshold: string; behavior_change: string }[];
  };
  // Bloco Avaliacao
  criteria_weights?: Record<string, number>;
  positive_indicators?: string[];
  negative_indicators?: string[];
  // Preview
  preview?: string;
}

// All valid field names (for validation)
const VALID_FIELDS: FieldType[] = [
  'avatar_profile', 'objections', 'evaluation_criteria', 'ideal_outcome',
  'character_name', 'character_role', 'personality', 'hidden_objective',
  'initial_emotion', 'emotional_reactivity', 'communication_style',
  'typical_phrases', 'knowledge_limits', 'backstory',
  'user_objective', 'opening_line', 'session_type', 'market_context',
  'target_duration_seconds', 'success_condition', 'end_condition',
  'phase_flow', 'difficulty_escalation',
  'criteria_weights', 'positive_indicators', 'negative_indicators',
  'all', 'preview',
];

/**
 * Map voice value from legacy Gemini names to OpenAI names.
 * If already an OpenAI voice, returns as-is.
 * Falls back to "echo" if unrecognized.
 */
function mapVoice(voice: string): string {
  // Already a valid OpenAI voice
  if (VALID_OPENAI_VOICES.includes(voice)) {
    return voice;
  }
  // Legacy Gemini name -> OpenAI
  if (VOICE_MAP[voice]) {
    return VOICE_MAP[voice];
  }
  // Unknown -> default
  return "echo";
}

// Build prompt for generating a single field
function buildSingleFieldPrompt(title: string, context: string, field: FieldType): string {
  const baseContext = `Voce e um especialista em treinamento de vendas e criacao de cenarios de roleplay.
Com base no titulo e contexto fornecidos, gere o campo solicitado.
Tudo em portugues brasileiro.

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

Tambem sugira uma voz (suggested_voice) entre: "echo" (masculina jovem), "ash" (masculina madura), "shimmer" (feminina jovem), "sage" (masculina grave), "coral" (feminina madura).

Retorne APENAS JSON:
{"avatar_profile": "...", "suggested_voice": "echo"}`;

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

    case 'character_name':
      return baseContext + `INSTRUCAO: Gere o NOME DO PERSONAGEM (character_name):
- Nome completo realista, brasileiro
- Deve combinar com o perfil descrito no contexto

Retorne APENAS JSON:
{"character_name": "..."}`;

    case 'character_role':
      return baseContext + `INSTRUCAO: Gere o CARGO/PAPEL DO PERSONAGEM (character_role):
- Cargo ou papel do cliente/prospect na empresa
- Deve ser coerente com o contexto da negociacao

Retorne APENAS JSON:
{"character_role": "..."}`;

    case 'personality':
      return baseContext + `INSTRUCAO: Gere a PERSONALIDADE do personagem (personality):
- Descricao em 1-2 paragrafos
- Inclua tracos dominantes, estilo de tomada de decisao, como reage sob pressao
- Deve influenciar como o avatar se comporta durante o roleplay

Retorne APENAS JSON:
{"personality": "..."}`;

    case 'user_objective':
      return baseContext + `INSTRUCAO: Gere o OBJETIVO DO USUARIO (user_objective):
- O que o vendedor/usuario deve tentar alcançar nesta sessao
- 1-2 frases claras e objetivas

Retorne APENAS JSON:
{"user_objective": "..."}`;

    case 'opening_line':
      return baseContext + `INSTRUCAO: Gere a FALA DE ABERTURA do avatar (opening_line):
- A primeira frase que o avatar/cliente dira ao iniciar a conversa
- Deve ser natural e coerente com o contexto e personalidade
- Em portugues brasileiro, linguagem oral

Retorne APENAS JSON:
{"opening_line": "..."}`;

    case 'hidden_objective':
      return baseContext + `INSTRUCAO: Gere o OBJETIVO OCULTO do personagem (hidden_objective):
- Uma motivacao ou objetivo que o cliente tem mas nao revela diretamente
- O vendedor precisa descobrir durante a conversa
- 1-2 frases

Retorne APENAS JSON:
{"hidden_objective": "..."}`;

    case 'initial_emotion':
      return baseContext + `INSTRUCAO: Gere a EMOCAO INICIAL do personagem (initial_emotion):
- A emocao com que o avatar comeca a conversa
- Uma palavra ou expressao curta (ex: "frustrado", "curioso", "desconfiado", "neutro")

Retorne APENAS JSON:
{"initial_emotion": "..."}`;

    case 'emotional_reactivity':
      return baseContext + `INSTRUCAO: Gere a REATIVIDADE EMOCIONAL do personagem (emotional_reactivity):
- Lista de gatilhos emocionais: evento que dispara, reacao do avatar, intensidade (1-10)
- 3-5 gatilhos relevantes ao contexto
- Formato: triggers com event, reaction, intensity

Retorne APENAS JSON:
{"emotional_reactivity": {"triggers": [{"event": "vendedor ignora preocupacao", "reaction": "fica irritado e fecha postura", "intensity": 7}, ...]}}`;

    case 'communication_style':
      return baseContext + `INSTRUCAO: Gere o ESTILO DE COMUNICACAO do personagem (communication_style):
- formality: nivel de formalidade ("formal", "semi-formal", "informal")
- verbosity: nivel de verbosidade ("conciso", "moderado", "prolixo")
- patterns: 2-4 padroes de fala caracteristicos (ex: "usa muitas perguntas", "interrompe frequentemente")

Retorne APENAS JSON:
{"communication_style": {"formality": "...", "verbosity": "...", "patterns": ["...", "..."]}}`;

    case 'typical_phrases':
      return baseContext + `INSTRUCAO: Gere FRASES TIPICAS do personagem (typical_phrases):
- 3-6 frases ou expressoes que o personagem usaria naturalmente
- Devem refletir personalidade, cargo e contexto
- Em portugues brasileiro, linguagem oral

Retorne APENAS JSON:
{"typical_phrases": ["...", "...", "..."]}`;

    case 'knowledge_limits':
      return baseContext + `INSTRUCAO: Gere os LIMITES DE CONHECIMENTO do personagem (knowledge_limits):
- O que o personagem sabe e NAO sabe sobre o produto/servico
- Informacoes que ele tem de competidores
- Nivel de familiaridade tecnica
- Formato: objeto com chaves descritivas

Retorne APENAS JSON:
{"knowledge_limits": {"produto": "conhece apenas o basico", "mercado": "...", "tecnologia": "...", "competidores": "..."}}`;

    case 'backstory':
      return baseContext + `INSTRUCAO: Gere a HISTORIA DE FUNDO do personagem (backstory):
- 1-2 paragrafos sobre a historia do personagem
- Experiencias passadas relevantes, como chegou na posicao atual
- Eventos recentes que influenciam a negociacao

Retorne APENAS JSON:
{"backstory": "..."}`;

    case 'session_type':
      return baseContext + `INSTRUCAO: Gere o TIPO DE SESSAO (session_type):
- Classifique o tipo de interacao (ex: "cold_call", "negociacao", "retencao", "upsell", "entrevista", "follow_up", "demo", "fechamento")
- Uma unica string

Retorne APENAS JSON:
{"session_type": "..."}`;

    case 'market_context':
      return baseContext + `INSTRUCAO: Gere o CONTEXTO DE MERCADO (market_context):
- Informacoes relevantes sobre o mercado/industria
- Tendencias, concorrentes, momento economico
- Formato: objeto com chaves descritivas

Retorne APENAS JSON:
{"market_context": {"industria": "...", "tendencias": "...", "concorrentes": ["..."], "momento": "..."}}`;

    case 'target_duration_seconds':
      return baseContext + `INSTRUCAO: Sugira a DURACAO ALVO da sessao em segundos (target_duration_seconds):
- Baseie-se na complexidade do cenario
- Valores tipicos: 120 (2min) para simples, 180 (3min) para medio, 300 (5min) para complexo

Retorne APENAS JSON:
{"target_duration_seconds": 180}`;

    case 'success_condition':
      return baseContext + `INSTRUCAO: Gere a CONDICAO DE SUCESSO (success_condition):
- O que define que a sessao foi bem-sucedida do ponto de vista do vendedor
- 1-2 frases claras e mensuraveis

Retorne APENAS JSON:
{"success_condition": "..."}`;

    case 'end_condition':
      return baseContext + `INSTRUCAO: Gere a CONDICAO DE ENCERRAMENTO (end_condition):
- O que faz a sessao terminar (alem do timeout)
- Ex: "cliente aceita proposta", "cliente desliga", "acordo fechado"
- 1 frase

Retorne APENAS JSON:
{"end_condition": "..."}`;

    case 'phase_flow':
      return baseContext + `INSTRUCAO: Gere o FLUXO DE FASES da sessao (phase_flow):
- 3-5 fases da conversa com nome, porcentagem de duracao e gatilhos de transicao
- As porcentagens devem somar 100
- Exemplo: abertura (15%), exploracao (30%), apresentacao (25%), objecoes (20%), fechamento (10%)

Retorne APENAS JSON:
{"phase_flow": {"phases": [{"name": "Abertura", "duration_pct": 15, "triggers": ["cumprimento", "apresentacao"]}, ...]}}`;

    case 'difficulty_escalation':
      return baseContext + `INSTRUCAO: Gere a ESCALADA DE DIFICULDADE (difficulty_escalation):
- 2-4 estagios de aumento de dificuldade durante a sessao
- Cada estagio tem um threshold (gatilho) e behavior_change (mudanca de comportamento)

Retorne APENAS JSON:
{"difficulty_escalation": {"stages": [{"threshold": "apos 2 minutos sem progresso", "behavior_change": "cliente fica impaciente e mais resistente"}, ...]}}`;

    case 'criteria_weights':
      return baseContext + `INSTRUCAO: Gere os PESOS DOS CRITERIOS (criteria_weights):
- Pesos relativos para cada criterio de avaliacao (somando 1.0)
- Use IDs como crit_1, crit_2 etc.
- Distribua de acordo com importancia no contexto

Retorne APENAS JSON:
{"criteria_weights": {"crit_1": 0.25, "crit_2": 0.25, "crit_3": 0.25, "crit_4": 0.25}}`;

    case 'positive_indicators':
      return baseContext + `INSTRUCAO: Gere os INDICADORES POSITIVOS (positive_indicators):
- 4-6 comportamentos/acoes que indicam boa performance do vendedor
- Especificos para este cenario

Retorne APENAS JSON:
{"positive_indicators": ["...", "...", "..."]}`;

    case 'negative_indicators':
      return baseContext + `INSTRUCAO: Gere os INDICADORES NEGATIVOS (negative_indicators):
- 4-6 comportamentos/acoes que indicam ma performance do vendedor
- Especificos para este cenario

Retorne APENAS JSON:
{"negative_indicators": ["...", "...", "..."]}`;

    default:
      return buildAllFieldsPrompt(title, context);
  }
}

// Build prompt for preview mode
function buildPreviewPrompt(title: string, context: string): string {
  return `Voce e um especialista em treinamento de vendas e design de cenarios de roleplay.
Com base no titulo e contexto fornecidos, escreva um PARAGRAFO DE PREVIEW em portugues brasileiro descrevendo o cenario para revisao de um administrador.

TITULO: ${title}

CONTEXTO: ${context}

INSTRUCAO: Escreva um paragrafo natural (3-6 frases) que descreva:
1. Quem e o personagem/cliente e como ele se comporta
2. Quais objecoes ele levantara e como reagira
3. Como a sessao começa e em que condicoes termina
4. Como o usuario (vendedor) sera avaliado

O texto deve ser fluido, nao uma lista. Use linguagem clara e profissional.
NAO use markdown, NAO use bullet points. Apenas um paragrafo corrido.

Retorne APENAS JSON:
{"preview": "..."}`;
}

// Build prompt for all fields (expanded with all structured fields)
function buildAllFieldsPrompt(title: string, context: string): string {
  return `Voce e um especialista em treinamento de vendas e criacao de cenarios de roleplay.
Com base no titulo e contexto fornecidos pelo usuario, gere TODOS os campos estruturados para completar o cenario.
Tudo em portugues brasileiro.

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

Gere TODOS os seguintes campos:

--- BLOCO PRINCIPAL ---

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
   - Escolha UMA: "echo", "ash", "shimmer", "sage", "coral"
   - echo: masculina jovem, amigavel
   - ash: masculina madura, seria
   - shimmer: feminina jovem, energica
   - sage: masculina grave, autoritaria
   - coral: feminina madura, profissional
   - Baseie-se no perfil do avatar

--- BLOCO PERSONAGEM ---

6. NOME DO PERSONAGEM (character_name): Nome completo brasileiro

7. CARGO/PAPEL (character_role): Cargo na empresa ou papel na negociacao

8. PERSONALIDADE (personality): 1-2 paragrafos descrevendo tracos, estilo de decisao, reacao sob pressao

9. OBJETIVO DO USUARIO (user_objective): O que o vendedor deve alcançar (1-2 frases)

10. FALA DE ABERTURA (opening_line): Primeira frase do avatar ao iniciar (linguagem oral, pt-BR)

11. OBJETIVO OCULTO (hidden_objective): Motivacao que o cliente nao revela diretamente (1-2 frases)

12. EMOCAO INICIAL (initial_emotion): Emocao com que o avatar comeca (ex: "frustrado", "curioso", "neutro")

13. REATIVIDADE EMOCIONAL (emotional_reactivity):
    - triggers: lista de 3-5 gatilhos com event, reaction, intensity (1-10)

14. ESTILO DE COMUNICACAO (communication_style):
    - formality: "formal", "semi-formal" ou "informal"
    - verbosity: "conciso", "moderado" ou "prolixo"
    - patterns: 2-4 padroes de fala

15. FRASES TIPICAS (typical_phrases): 3-6 frases/expressoes caracteristicas

16. LIMITES DE CONHECIMENTO (knowledge_limits): Objeto com o que o personagem sabe/nao sabe

17. HISTORIA DE FUNDO (backstory): 1-2 paragrafos sobre historia e experiencias do personagem

--- BLOCO SITUACAO ---

18. TIPO DE SESSAO (session_type): Classificacao (ex: "cold_call", "negociacao", "retencao", "upsell", "entrevista")

19. CONTEXTO DE MERCADO (market_context): Objeto com industria, tendencias, concorrentes, momento

20. DURACAO ALVO (target_duration_seconds): Numero em segundos (120-300)

21. CONDICAO DE SUCESSO (success_condition): O que define sucesso (1-2 frases)

22. CONDICAO DE ENCERRAMENTO (end_condition): O que faz a sessao terminar (1 frase)

--- COMPORTAMENTO DINAMICO ---

23. FLUXO DE FASES (phase_flow):
    - phases: 3-5 fases com name, duration_pct (somando 100), triggers

24. ESCALADA DE DIFICULDADE (difficulty_escalation):
    - stages: 2-4 estagios com threshold e behavior_change

--- BLOCO AVALIACAO ---

25. PESOS DOS CRITERIOS (criteria_weights): Objeto {crit_id: peso} somando 1.0

26. INDICADORES POSITIVOS (positive_indicators): 4-6 comportamentos que indicam boa performance

27. INDICADORES NEGATIVOS (negative_indicators): 4-6 comportamentos que indicam ma performance

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
  "suggested_voice": "echo",
  "character_name": "Nome Completo",
  "character_role": "Cargo ou papel",
  "personality": "Descricao da personalidade...",
  "user_objective": "Objetivo do vendedor...",
  "opening_line": "Primeira frase do avatar...",
  "hidden_objective": "Objetivo oculto do cliente...",
  "initial_emotion": "frustrado",
  "emotional_reactivity": {
    "triggers": [
      {"event": "vendedor ignora preocupacao", "reaction": "fica irritado", "intensity": 7}
    ]
  },
  "communication_style": {
    "formality": "semi-formal",
    "verbosity": "moderado",
    "patterns": ["usa perguntas diretas", "interrompe quando impaciente"]
  },
  "typical_phrases": ["Olha, vou ser direto...", "Ja tentei isso antes..."],
  "knowledge_limits": {"produto": "conhece o basico", "mercado": "bem informado", "competidores": "conhece 2-3 opcoes"},
  "backstory": "Historia do personagem...",
  "session_type": "negociacao",
  "market_context": {"industria": "...", "tendencias": "...", "concorrentes": ["..."], "momento": "..."},
  "target_duration_seconds": 180,
  "success_condition": "Condicao de sucesso...",
  "end_condition": "Condicao de encerramento...",
  "phase_flow": {
    "phases": [
      {"name": "Abertura", "duration_pct": 15, "triggers": ["cumprimento"]},
      {"name": "Exploracao", "duration_pct": 30, "triggers": ["perguntas"]},
      {"name": "Apresentacao", "duration_pct": 25, "triggers": ["proposta"]},
      {"name": "Objecoes", "duration_pct": 20, "triggers": ["resistencia"]},
      {"name": "Fechamento", "duration_pct": 10, "triggers": ["acordo"]}
    ]
  },
  "difficulty_escalation": {
    "stages": [
      {"threshold": "apos 2 minutos", "behavior_change": "cliente fica mais exigente"}
    ]
  },
  "criteria_weights": {"crit_1": 0.25, "crit_2": 0.25, "crit_3": 0.25, "crit_4": 0.25},
  "positive_indicators": ["...", "...", "...", "..."],
  "negative_indicators": ["...", "...", "...", "..."]
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
    if (!VALID_FIELDS.includes(fieldToGenerate)) {
      return corsErrorResponse(
        `Invalid field: ${fieldToGenerate}. Valid options: ${VALID_FIELDS.join(', ')}`,
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
    let prompt: string;
    if (fieldToGenerate === 'preview') {
      prompt = buildPreviewPrompt(body.title, body.context);
    } else if (fieldToGenerate === 'all') {
      prompt = buildAllFieldsPrompt(body.title, body.context);
    } else {
      prompt = buildSingleFieldPrompt(body.title, body.context, fieldToGenerate);
    }

    console.log(
      `Generating ${fieldToGenerate} for:`,
      body.title.substring(0, 50)
    );

    // Token limits: all=8192, preview=1024, single field=1024
    const maxTokens = fieldToGenerate === 'all' ? 8192 : 1024;

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
    } catch (_parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return corsErrorResponse(
        "Failed to parse AI response. Please try again.",
        500,
        req
      );
    }

    // --- Preview mode: return early with just the preview text ---
    if (fieldToGenerate === 'preview') {
      if (!suggestedFields.preview) {
        return corsErrorResponse("Missing preview in response", 500, req);
      }
      return corsJsonResponse(
        {
          success: true,
          field: "preview",
          fields: { preview: suggestedFields.preview },
          tokens_used: {
            input: inputTokens,
            output: outputTokens,
          },
        },
        200,
        req
      );
    }

    // --- Validate and normalize based on field type ---

    // avatar_profile validation
    if (fieldToGenerate === 'all' || fieldToGenerate === 'avatar_profile') {
      if (fieldToGenerate === 'all' && !suggestedFields.avatar_profile) {
        return corsErrorResponse("Missing avatar_profile in response", 500, req);
      }
    }

    // objections validation and normalization
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

    // evaluation_criteria validation and normalization
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

    // ideal_outcome validation
    if (fieldToGenerate === 'all' || fieldToGenerate === 'ideal_outcome') {
      if (fieldToGenerate === 'all' && !suggestedFields.ideal_outcome) {
        return corsErrorResponse("Missing ideal_outcome in response", 500, req);
      }
    }

    // --- Voice mapping: convert legacy Gemini names to OpenAI names ---
    if (suggestedFields.suggested_voice) {
      suggestedFields.suggested_voice = mapVoice(suggestedFields.suggested_voice);
    }

    // For "all" mode, ensure a voice is always present
    if (fieldToGenerate === 'all' && !suggestedFields.suggested_voice) {
      suggestedFields.suggested_voice = "echo";
    }

    // --- Voice-gender enforcement ---
    const femaleVoices = ["shimmer", "coral"];
    const maleVoices = ["echo", "ash", "sage"];
    // Infer gender from character_gender field or from voice
    let inferredGender = suggestedFields.character_gender as string | undefined;
    if (!inferredGender && suggestedFields.suggested_voice) {
      inferredGender = femaleVoices.includes(suggestedFields.suggested_voice) ? "female" : "male";
    }
    if (inferredGender) {
      suggestedFields.character_gender = inferredGender;
      if (suggestedFields.suggested_voice) {
        const allowedVoices = inferredGender === "female" ? femaleVoices : maleVoices;
        if (!allowedVoices.includes(suggestedFields.suggested_voice)) {
          suggestedFields.suggested_voice = inferredGender === "female" ? "shimmer" : "echo";
        }
      }
    }

    // --- Normalize criteria_weights: ensure values sum to ~1.0 ---
    if (suggestedFields.criteria_weights && typeof suggestedFields.criteria_weights === 'object') {
      const weights = suggestedFields.criteria_weights;
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      if (sum > 0 && Math.abs(sum - 1.0) > 0.01) {
        // Normalize to sum to 1.0
        for (const key of Object.keys(weights)) {
          weights[key] = Math.round((weights[key] / sum) * 100) / 100;
        }
      }
    }

    // --- Normalize target_duration_seconds: ensure it's a reasonable number ---
    if (suggestedFields.target_duration_seconds !== undefined) {
      const dur = suggestedFields.target_duration_seconds;
      if (typeof dur !== 'number' || dur < 60 || dur > 600) {
        suggestedFields.target_duration_seconds = 180; // Default 3 minutes
      }
    }

    // --- Normalize phase_flow: ensure duration_pct values ---
    if (suggestedFields.phase_flow?.phases && Array.isArray(suggestedFields.phase_flow.phases)) {
      const totalPct = suggestedFields.phase_flow.phases.reduce(
        (sum, phase) => sum + (phase.duration_pct || 0), 0
      );
      // If total is way off 100, normalize
      if (totalPct > 0 && Math.abs(totalPct - 100) > 5) {
        suggestedFields.phase_flow.phases = suggestedFields.phase_flow.phases.map(phase => ({
          ...phase,
          duration_pct: Math.round((phase.duration_pct / totalPct) * 100),
        }));
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
