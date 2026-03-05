/**
 * Edge Function: generate-scenario
 *
 * Uses Claude AI to generate complete scenario structures from
 * natural language descriptions. Admin-only endpoint.
 *
 * Updated for AGENTS-EVOLUTION Phase 2:
 * - OpenAI voice names (echo, ash, shimmer, sage, coral)
 * - Full structured fields: character, emotions, phases, market context, etc.
 * - RE/MAX-aware category suggestion
 * - Few-shot examples for consistent output quality
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

// ─── Voice mapping (Gemini → OpenAI) ────────────────────────────────────────
const VOICE_MAP: Record<string, string> = {
  Puck: "echo",
  Charon: "ash",
  Kore: "shimmer",
  Fenrir: "sage",
  Aoede: "coral",
};

const VALID_VOICES = ["echo", "ash", "shimmer", "sage", "coral"];

// ─── Request type ────────────────────────────────────────────────────────────
interface GenerateRequest {
  access_code: string;
  description: string;
  industry?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// ─── Generated scenario structures ──────────────────────────────────────────
interface GeneratedObjection {
  id: string;
  description: string;
}

interface GeneratedCriterion {
  id: string;
  description: string;
}

interface EmotionalTrigger {
  event: string;
  reaction: string;
  intensity: number;
}

interface CommunicationStyle {
  formality: string;
  verbosity: string;
  patterns: string[];
}

interface KnowledgeLimits {
  knows: string[];
  doesnt_know: string[];
}

interface MarketContext {
  industry: string;
  market_size: string;
  competitors: string[];
}

interface PhaseFlowPhase {
  name: string;
  duration_pct: number;
  triggers: string[];
}

interface DifficultyStage {
  threshold: string;
  behavior_change: string;
}

interface GeneratedScenario {
  // Core fields (existing)
  title: string;
  context: string;
  avatar_profile: string;
  objections: GeneratedObjection[];
  evaluation_criteria: GeneratedCriterion[];
  ideal_outcome: string;
  suggested_voice: string;

  // New structured fields (AGENTS-EVOLUTION Phase 2)
  suggested_category: string;
  character_name: string;
  character_role: string;
  personality: string;
  user_objective: string;
  opening_line: string;
  hidden_objective: string;
  initial_emotion: string;
  emotional_reactivity: { triggers: EmotionalTrigger[] };
  communication_style: CommunicationStyle;
  typical_phrases: string[];
  knowledge_limits: KnowledgeLimits;
  backstory: string;
  session_type: string;
  market_context: MarketContext;
  target_duration_seconds: number;
  success_condition: string;
  end_condition: string;
  phase_flow: { phases: PhaseFlowPhase[] };
  difficulty_escalation: { stages: DifficultyStage[] };
  criteria_weights: Record<string, number>;
  positive_indicators: string[];
  negative_indicators: string[];
}

// ─── Few-shot examples ──────────────────────────────────────────────────────

const FEW_SHOT_COLD_CALL = `{
  "title": "Cold Call: Software de Gestao",
  "context": "Voce e o diretor de uma empresa de medio porte (150 funcionarios) que ainda utiliza planilhas Excel para controle de projetos. Um vendedor de uma empresa de software de gestao esta ligando pela primeira vez. Voce nao solicitou essa ligacao e esta ocupado com reunioes.",
  "avatar_profile": "Ricardo Mendes, 45 anos, Diretor de Operacoes. Pragmatico e direto, pouca paciencia para abordagens genericas. Valoriza dados concretos e resultados comprovados. Ja teve experiencias ruins com fornecedores de TI que prometeram demais.",
  "objections": [
    {"id": "obj_1", "description": "Nao tenho tempo agora, estou muito ocupado."},
    {"id": "obj_2", "description": "Ja tentamos sistemas antes e nao funcionou, voltamos para o Excel."},
    {"id": "obj_3", "description": "Quanto custa? Nao temos orcamento para isso este trimestre."},
    {"id": "obj_4", "description": "Nosso processo funciona bem do jeito que esta."}
  ],
  "evaluation_criteria": [
    {"id": "crit_1", "description": "Abordagem inicial: conseguiu gerar interesse nos primeiros 30 segundos"},
    {"id": "crit_2", "description": "Qualificacao: fez perguntas para entender a dor real do cliente"},
    {"id": "crit_3", "description": "Proposta de valor: conectou beneficios do produto com problemas especificos"},
    {"id": "crit_4", "description": "Tratamento de objecoes: respondeu objecoes sem ser defensivo"},
    {"id": "crit_5", "description": "Proximo passo: conseguiu agendar uma demonstracao ou follow-up"}
  ],
  "ideal_outcome": "O vendedor consegue gerar interesse suficiente para agendar uma demonstracao de 30 minutos na proxima semana.",
  "suggested_voice": "sage",
  "suggested_category": "Geral",
  "character_name": "Ricardo Mendes",
  "character_role": "Diretor de Operacoes",
  "personality": "Pragmatico e orientado a resultados. Nao tolera enrolacao e espera que qualquer proposta venha acompanhada de dados concretos. Tem um lado competitivo e respeita vendedores que demonstram conhecimento real do mercado.",
  "user_objective": "Conseguir agendar uma reuniao de demonstracao com o prospect, mesmo ele nao tendo solicitado contato.",
  "opening_line": "Alo? Quem esta falando?",
  "hidden_objective": "Na verdade, Ricardo esta frustrado com as planilhas e ja cogitou trocar, mas quer testar se o vendedor realmente entende seus problemas antes de investir tempo.",
  "initial_emotion": "irritado",
  "emotional_reactivity": {
    "triggers": [
      {"event": "Vendedor faz pergunta generica sem pesquisa previa", "reaction": "Fica impaciente e ameaca desligar", "intensity": 8},
      {"event": "Vendedor menciona caso de sucesso no mesmo setor", "reaction": "Demonstra curiosidade e faz perguntas", "intensity": 6},
      {"event": "Vendedor pressiona para reuniao sem estabelecer valor", "reaction": "Fecha completamente e encerra a ligacao", "intensity": 9}
    ]
  },
  "communication_style": {
    "formality": "moderada",
    "verbosity": "baixa",
    "patterns": ["Respostas curtas e diretas", "Interrompe se achar irrelevante", "Usa dados e numeros para argumentar"]
  },
  "typical_phrases": [
    "Vai direto ao ponto, por favor.",
    "Isso na teoria e bonito, mas na pratica...",
    "Me mostra numeros, nao slides.",
    "Ja ouvi isso antes de outros fornecedores."
  ],
  "knowledge_limits": {
    "knows": ["Processos internos da empresa", "Custos operacionais atuais", "Problemas com planilhas", "Experiencias anteriores com TI"],
    "doesnt_know": ["Detalhes tecnicos de integracao", "Precos de mercado de SaaS", "Termos tecnicos como API, cloud-native"]
  },
  "backstory": "Ricardo construiu a empresa com o socio ha 12 anos. Sempre priorizou operacoes sobre tecnologia. A ultima tentativa de implantar um ERP em 2022 foi desastrosa — estourou prazo e orcamento, e a equipe rejeitou o sistema. Desde entao, voltaram para Excel e ele tem resistencia a novas tentativas.",
  "session_type": "cold_call",
  "market_context": {
    "industry": "Servicos profissionais / Consultoria",
    "market_size": "Empresa de medio porte, 150 funcionarios, faturamento ~R$50M/ano",
    "competitors": ["TOTVS", "Sankhya", "Monday.com", "Asana"]
  },
  "target_duration_seconds": 180,
  "success_condition": "Prospect concorda em agendar uma demonstracao ou call de follow-up com horario definido.",
  "end_condition": "Prospect desliga, vendedor consegue agendamento, ou tempo esgota sem progresso.",
  "phase_flow": {
    "phases": [
      {"name": "Abertura e rapport", "duration_pct": 20, "triggers": ["Vendedor se identifica", "Prospect questiona motivo da ligacao"]},
      {"name": "Descoberta e qualificacao", "duration_pct": 35, "triggers": ["Vendedor faz perguntas sobre processos atuais", "Prospect revela frustracao com planilhas"]},
      {"name": "Proposta de valor", "duration_pct": 25, "triggers": ["Vendedor conecta solucao com dor identificada", "Prospect faz perguntas sobre o produto"]},
      {"name": "Fechamento do proximo passo", "duration_pct": 20, "triggers": ["Vendedor propoe demonstracao", "Prospect aceita ou rejeita"]}
    ]
  },
  "difficulty_escalation": {
    "stages": [
      {"threshold": "Primeiros 30s sem valor claro", "behavior_change": "Prospect fica impaciente e diz que vai desligar"},
      {"threshold": "Vendedor faz pitch sem qualificar", "behavior_change": "Prospect levanta objecao de experiencia anterior negativa"},
      {"threshold": "Vendedor insiste apos 2 objecoes nao tratadas", "behavior_change": "Prospect encerra a conversa educadamente mas firmemente"}
    ]
  },
  "criteria_weights": {
    "crit_1": 25,
    "crit_2": 25,
    "crit_3": 20,
    "crit_4": 15,
    "crit_5": 15
  },
  "positive_indicators": [
    "Pesquisou sobre a empresa antes da ligacao",
    "Fez perguntas abertas sobre processos atuais",
    "Ouviu ativamente antes de apresentar solucao",
    "Tratou objecoes com empatia e dados",
    "Propoz proximo passo claro e de baixo comprometimento"
  ],
  "negative_indicators": [
    "Iniciou com pitch do produto sem qualificar",
    "Ignorou sinais de impaciencia do prospect",
    "Nao tratou objecoes diretamente",
    "Pressionou para venda ao inves de proximo passo",
    "Usou jargoes e buzzwords sem substancia"
  ]
}`;

const FEW_SHOT_INTERVIEW = `{
  "title": "Entrevista: Experiencia em Captacao",
  "context": "Voce e uma candidata a consultora imobiliaria na RE/MAX. Esta sendo entrevistada por um team leader sobre sua experiencia em captacao de imoveis. Voce tem 3 anos de experiencia no mercado imobiliario, mas vem de outra rede (Century 21) e quer mudar por questoes de comissionamento.",
  "avatar_profile": "Fernanda Costa, 29 anos, consultora imobiliaria com 3 anos de experiencia. Veio de outra rede e busca melhores condicoes de comissao. Comunicativa mas um pouco nervosa por ser entrevista.",
  "objections": [
    {"id": "obj_1", "description": "Na minha rede anterior, o processo de captacao era diferente, nao sei se me adapto."},
    {"id": "obj_2", "description": "Tenho receio do modelo 100% comissao sem salario fixo."},
    {"id": "obj_3", "description": "Minha carteira de clientes e na zona sul, nao sei se consigo atuar em outra regiao."},
    {"id": "obj_4", "description": "Preciso de pelo menos 2 semanas para fazer a transicao da rede anterior."}
  ],
  "evaluation_criteria": [
    {"id": "crit_1", "description": "Acolhimento: fez a candidata se sentir confortavel e ouvida"},
    {"id": "crit_2", "description": "Investigacao: explorou experiencia anterior com perguntas especificas"},
    {"id": "crit_3", "description": "Apresentacao do modelo: explicou vantagens da RE/MAX de forma clara"},
    {"id": "crit_4", "description": "Tratamento de objecoes: abordou preocupacoes com dados e exemplos"},
    {"id": "crit_5", "description": "Encerramento: definiu proximos passos claros para o processo"}
  ],
  "ideal_outcome": "Entrevistador identifica competencias da candidata, apresenta beneficios do modelo RE/MAX e define proximo passo no processo seletivo.",
  "suggested_voice": "shimmer",
  "suggested_category": "RE/MAX — Entrevista por Competencias",
  "character_name": "Fernanda Costa",
  "character_role": "Candidata a consultora imobiliaria",
  "personality": "Comunicativa e entusiasmada, mas com inseguranca sobre a mudanca de rede. Valoriza reconhecimento e autonomia. Tende a falar muito quando esta nervosa, mas responde bem a perguntas estruturadas.",
  "user_objective": "Conduzir uma entrevista por competencias eficaz, avaliar o fit da candidata e apresentar a proposta de valor da RE/MAX de forma convincente.",
  "opening_line": "Oi, boa tarde! Sou a Fernanda, muito prazer. Estou um pouco nervosa, confesso, mas muito animada com essa oportunidade.",
  "hidden_objective": "Fernanda ja decidiu que quer sair da Century 21, mas esta entrevistando em 3 redes diferentes. Quer ver qual oferece melhor suporte de marketing e tecnologia, alem da comissao.",
  "initial_emotion": "ansioso",
  "emotional_reactivity": {
    "triggers": [
      {"event": "Entrevistador pergunta sobre resultados numericos especificos", "reaction": "Fica um pouco desconfortavel pois nao bateu meta nos ultimos 2 meses", "intensity": 7},
      {"event": "Entrevistador explica ferramentas de marketing da RE/MAX", "reaction": "Fica muito animada e engajada", "intensity": 8},
      {"event": "Entrevistador questiona motivo de saida da rede anterior", "reaction": "Fica defensiva inicialmente, depois abre sobre frustracao com comissoes", "intensity": 6}
    ]
  },
  "communication_style": {
    "formality": "semi-formal",
    "verbosity": "alta",
    "patterns": ["Tende a dar respostas longas", "Usa exemplos pessoais com frequencia", "Faz perguntas sobre a empresa"]
  },
  "typical_phrases": [
    "Na minha experiencia anterior...",
    "Eu sempre fui muito dedicada ao cliente.",
    "O que me atrai na RE/MAX e...",
    "Posso ser sincera? O comissionamento la era frustrante."
  ],
  "knowledge_limits": {
    "knows": ["Processo de captacao na Century 21", "Mercado imobiliario zona sul", "Tecnicas basicas de negociacao", "Redes sociais para divulgacao"],
    "doesnt_know": ["Modelo de comissao RE/MAX em detalhe", "Ferramentas proprietarias da RE/MAX", "Diferencas de contrato entre redes"]
  },
  "backstory": "Fernanda entrou no mercado imobiliario apos sair do marketing digital. Gostou da autonomia mas se frustrou com a divisao de comissoes na Century 21 (50/50 com o broker). Tem uma carteira de ~20 clientes ativos e fechou 8 negocios no ultimo ano. Mora na zona sul e tem forte network local.",
  "session_type": "negotiation",
  "market_context": {
    "industry": "Mercado imobiliario / Franquias",
    "market_size": "RE/MAX Brasil — ~400 agencias, mercado em expansao pos-pandemia",
    "competitors": ["Century 21", "Keller Williams", "Lopes", "QuintoAndar"]
  },
  "target_duration_seconds": 180,
  "success_condition": "Entrevistador avalia competencias da candidata, apresenta proposta de valor e define proximo passo (ex: segundo encontro, acompanhamento de campo, ou proposta formal).",
  "end_condition": "Entrevistador conclui avaliacao e propoe proximo passo, ou candidata desiste da oportunidade.",
  "phase_flow": {
    "phases": [
      {"name": "Acolhimento e quebra-gelo", "duration_pct": 15, "triggers": ["Entrevistador se apresenta", "Candidata se apresenta"]},
      {"name": "Exploracao de experiencia", "duration_pct": 35, "triggers": ["Perguntas sobre captacao", "Perguntas sobre resultados", "Motivo de saida"]},
      {"name": "Apresentacao RE/MAX", "duration_pct": 30, "triggers": ["Candidata pergunta sobre a rede", "Entrevistador apresenta diferenciais"]},
      {"name": "Alinhamento e proximos passos", "duration_pct": 20, "triggers": ["Discussao de expectativas", "Definicao de timeline"]}
    ]
  },
  "difficulty_escalation": {
    "stages": [
      {"threshold": "Entrevistador nao faz perguntas abertas", "behavior_change": "Candidata da respostas superficiais e monossilabicas"},
      {"threshold": "Entrevistador nao aborda preocupacao com comissao", "behavior_change": "Candidata fica desconfiada e menos engajada"},
      {"threshold": "Entrevistador pressiona sobre resultados fracos", "behavior_change": "Candidata fica defensiva e considera encerrar a entrevista"}
    ]
  },
  "criteria_weights": {
    "crit_1": 15,
    "crit_2": 30,
    "crit_3": 25,
    "crit_4": 15,
    "crit_5": 15
  },
  "positive_indicators": [
    "Criou ambiente acolhedor no inicio",
    "Usou perguntas comportamentais (STAR method)",
    "Ouviu ativamente e aprofundou respostas",
    "Apresentou RE/MAX de forma personalizada ao perfil da candidata",
    "Definiu proximos passos concretos e timeline"
  ],
  "negative_indicators": [
    "Fez apenas perguntas fechadas (sim/nao)",
    "Nao explorou motivo real de saida da rede anterior",
    "Focou apenas em vender a RE/MAX sem avaliar competencias",
    "Ignorou preocupacoes da candidata sobre comissao",
    "Nao definiu proximo passo claro ao final"
  ]
}`;

// ─── Prompt builder ─────────────────────────────────────────────────────────

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

Gere um cenario estruturado completo com TODOS os campos abaixo.
Cada campo deve ser preenchido com conteudo relevante e coerente.

--- CAMPOS OBRIGATORIOS (CORE) ---

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
   - Escolha UMA das opcoes: "echo", "ash", "shimmer", "sage", "coral"
   - echo: voz masculina jovem e amigavel
   - ash: voz masculina madura e seria
   - shimmer: voz feminina jovem e energica
   - sage: voz masculina grave e autoritaria
   - coral: voz feminina madura e profissional
   - Escolha baseada no perfil do personagem

--- CAMPOS NOVOS (AGENTS-EVOLUTION Phase 2) ---

8. CATEGORIA SUGERIDA (suggested_category):
   - Categorias existentes: "RE/MAX — Entrevista por Competencias", "RE/MAX — Cold Calls e Negociacao", "Geral", "Testes"
   - Se o cenario envolve mercado imobiliario, sugira a categoria RE/MAX mais apropriada
   - Caso contrario, use "Geral" ou sugira uma nova categoria descritiva

9. NOME DO PERSONAGEM (character_name):
   - Nome completo realista e brasileiro

10. CARGO/PAPEL (character_role):
    - Papel ou posicao do personagem (ex: "Diretor Financeiro", "Candidata a consultora")

11. PERSONALIDADE (personality):
    - 2-3 frases descrevendo tracos de personalidade, motivacoes e estilo

12. OBJETIVO DO TREINANDO (user_objective):
    - O que o usuario que esta praticando deve tentar atingir nesta sessao

13. FALA DE ABERTURA (opening_line):
    - A primeira fala do personagem ao iniciar a conversa
    - Deve ser natural e coerente com a personalidade

14. OBJETIVO OCULTO (hidden_objective):
    - Motivacao real do personagem que nao e dita explicitamente
    - Cria profundidade e realismo ao cenario

15. EMOCAO INICIAL (initial_emotion):
    - Estado emocional no inicio: "neutro", "irritado", "ansioso", "receptivo", "desconfiado", etc.

16. REATIVIDADE EMOCIONAL (emotional_reactivity):
    - Objeto com array "triggers", cada um com: event, reaction, intensity (1-10)
    - 2-4 gatilhos emocionais relevantes

17. ESTILO DE COMUNICACAO (communication_style):
    - formality: "informal", "semi-formal", "formal"
    - verbosity: "baixa", "moderada", "alta"
    - patterns: lista de 2-4 padroes observaveis

18. FRASES TIPICAS (typical_phrases):
    - 3-5 frases que o personagem usaria com frequencia

19. LIMITES DE CONHECIMENTO (knowledge_limits):
    - knows: lista do que o personagem sabe
    - doesnt_know: lista do que o personagem NAO sabe

20. HISTORIA DE FUNDO (backstory):
    - 2-3 frases sobre o historico do personagem que explica seu comportamento

21. TIPO DE SESSAO (session_type):
    - Um de: "cold_call", "follow_up", "negotiation", "retention", "interview", "upsell", "complaint"

22. CONTEXTO DE MERCADO (market_context):
    - industry: setor do cenario
    - market_size: tamanho/porte relevante
    - competitors: 2-4 concorrentes reais ou ficticios

23. DURACAO ALVO (target_duration_seconds):
    - Numero entre 60 e 300 segundos (recomendado: 180 para a maioria)

24. CONDICAO DE SUCESSO (success_condition):
    - Descricao clara do que conta como sucesso nesta sessao

25. CONDICAO DE ENCERRAMENTO (end_condition):
    - Quando a sessao deve terminar naturalmente

26. FLUXO DE FASES (phase_flow):
    - Objeto com array "phases", cada um com: name, duration_pct (soma = 100), triggers
    - 3-5 fases da conversa

27. ESCALACAO DE DIFICULDADE (difficulty_escalation):
    - Objeto com array "stages", cada um com: threshold, behavior_change
    - 2-4 estagios de escalacao

28. PESOS DOS CRITERIOS (criteria_weights):
    - Objeto mapeando IDs dos criterios (crit_1, crit_2...) para pesos numericos (soma ~100)

29. INDICADORES POSITIVOS (positive_indicators):
    - 4-6 comportamentos que indicam bom desempenho

30. INDICADORES NEGATIVOS (negative_indicators):
    - 4-6 comportamentos que indicam desempenho ruim

═══════════════════════════════════════════════════════════════
EXEMPLOS DE CENARIOS BEM CONSTRUIDOS:
═══════════════════════════════════════════════════════════════

--- EXEMPLO 1: COLD CALL ---
${FEW_SHOT_COLD_CALL}

--- EXEMPLO 2: ENTREVISTA ---
${FEW_SHOT_INTERVIEW}

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA:
═══════════════════════════════════════════════════════════════

Retorne APENAS um JSON valido (sem markdown, sem comentarios) seguindo EXATAMENTE a mesma estrutura dos exemplos acima.
Todos os campos sao obrigatorios. Preencha cada um com conteudo relevante e coerente com o cenario descrito.`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Map legacy Gemini voice names to OpenAI voice names.
 * If already a valid OpenAI voice, return as-is.
 */
function mapVoice(voice: string): string {
  if (VALID_VOICES.includes(voice)) return voice;
  return VOICE_MAP[voice] || "echo";
}

/**
 * Validate and sanitize the generated scenario.
 * Core fields are required; new Phase 2 fields are best-effort.
 */
function validateScenario(
  scenario: Record<string, unknown>
): { valid: true; scenario: GeneratedScenario } | { valid: false; error: string } {
  // 1. Validate core required fields
  const coreFields = [
    "title",
    "context",
    "avatar_profile",
    "objections",
    "evaluation_criteria",
    "ideal_outcome",
  ];

  for (const field of coreFields) {
    if (!scenario[field]) {
      return { valid: false, error: `Generated scenario missing required field: ${field}` };
    }
  }

  // 2. Validate arrays have content
  if (!Array.isArray(scenario.objections) || (scenario.objections as unknown[]).length === 0) {
    return { valid: false, error: "Generated scenario has no objections" };
  }

  if (
    !Array.isArray(scenario.evaluation_criteria) ||
    (scenario.evaluation_criteria as unknown[]).length === 0
  ) {
    return { valid: false, error: "Generated scenario has no evaluation criteria" };
  }

  // 3. Normalize IDs
  scenario.objections = (scenario.objections as GeneratedObjection[]).map((obj, index) => ({
    id: obj.id || `obj_${index + 1}`,
    description: obj.description,
  }));

  scenario.evaluation_criteria = (scenario.evaluation_criteria as GeneratedCriterion[]).map(
    (crit, index) => ({
      id: crit.id || `crit_${index + 1}`,
      description: crit.description,
    })
  );

  // 4. Map voice (handles both legacy Gemini and new OpenAI names)
  scenario.suggested_voice = mapVoice(
    (scenario.suggested_voice as string) || "echo"
  );

  // 5. Defaults for Phase 2 fields (best-effort — don't fail if missing)
  scenario.suggested_category =
    (scenario.suggested_category as string) || "Geral";
  scenario.character_name =
    (scenario.character_name as string) || "";
  scenario.character_role =
    (scenario.character_role as string) || "";
  scenario.personality =
    (scenario.personality as string) || "";
  scenario.user_objective =
    (scenario.user_objective as string) || "";
  scenario.opening_line =
    (scenario.opening_line as string) || "";
  scenario.hidden_objective =
    (scenario.hidden_objective as string) || "";
  scenario.initial_emotion =
    (scenario.initial_emotion as string) || "neutro";
  scenario.emotional_reactivity =
    (scenario.emotional_reactivity as { triggers: EmotionalTrigger[] }) || { triggers: [] };
  scenario.communication_style =
    (scenario.communication_style as CommunicationStyle) || {
      formality: "moderada",
      verbosity: "moderada",
      patterns: [],
    };
  scenario.typical_phrases =
    (scenario.typical_phrases as string[]) || [];
  scenario.knowledge_limits =
    (scenario.knowledge_limits as KnowledgeLimits) || { knows: [], doesnt_know: [] };
  scenario.backstory =
    (scenario.backstory as string) || "";
  scenario.session_type =
    (scenario.session_type as string) || "negotiation";
  scenario.market_context =
    (scenario.market_context as MarketContext) || {
      industry: "",
      market_size: "",
      competitors: [],
    };
  scenario.target_duration_seconds =
    typeof scenario.target_duration_seconds === "number"
      ? Math.max(60, Math.min(300, scenario.target_duration_seconds))
      : 180;
  scenario.success_condition =
    (scenario.success_condition as string) || "";
  scenario.end_condition =
    (scenario.end_condition as string) || "";
  scenario.phase_flow =
    (scenario.phase_flow as { phases: PhaseFlowPhase[] }) || { phases: [] };
  scenario.difficulty_escalation =
    (scenario.difficulty_escalation as { stages: DifficultyStage[] }) || { stages: [] };
  scenario.criteria_weights =
    (scenario.criteria_weights as Record<string, number>) || {};
  scenario.positive_indicators =
    (scenario.positive_indicators as string[]) || [];
  scenario.negative_indicators =
    (scenario.negative_indicators as string[]) || [];

  return { valid: true, scenario: scenario as unknown as GeneratedScenario };
}

// ─── Main handler ───────────────────────────────────────────────────────────

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

    // Call Claude API with retry logic (max_tokens 8192 for larger structured output)
    const message = await withRetry(
      async () => {
        return await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
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
    let parsedJson: Record<string, unknown>;
    try {
      // Try to extract JSON from response (handles extra text around JSON)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsedJson = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      return corsErrorResponse(
        "Failed to parse AI response. Please try again.",
        500,
        req
      );
    }

    // Validate and sanitize the generated scenario
    const validation = validateScenario(parsedJson);
    if (!validation.valid) {
      return corsErrorResponse(validation.error, 500, req);
    }

    const generatedScenario = validation.scenario;

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
