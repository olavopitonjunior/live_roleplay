# AGENTS-EVOLUTION.md — Evolucao de Cenarios, Coach e Relatorio

## Contexto

Este documento instrui a implementacao da evolucao de tres camadas do Live Roleplay: Cenarios, Coach e Relatorio. A especificacao conceitual completa esta em `docs/spec-cenarios-coach-relatorio.md`. Este arquivo traduz essa especificacao em tasks implementaveis.

REGRA: Leia `docs/spec-cenarios-coach-relatorio.md` ANTES de implementar qualquer fase. Este arquivo contem as instrucoes de implementacao; aquele contem as decisoes de produto e a logica por tras delas.

REGRA: Implemente fase por fase, na ordem indicada. Nao pule fases. Cada fase depende da anterior.

REGRA: Mantenha compatibilidade com o que ja funciona. Sessoes existentes, feedbacks existentes e cenarios existentes devem continuar operando normalmente.

---

## Arquivos Criticos (Mapa de Impacto)

| Arquivo | Impacto | Fases |
|---------|---------|-------|
| `agent/prompts.py` | Reescrever build_agent_instructions() para compilar a partir de campos estruturados | 1, 2 |
| `agent/coach_orchestrator.py` | Adicionar emissao de estados, ferramentas acionaveis, deteccao de fase | 3 |
| `agent/main.py` | Integrar novo fluxo de cenario, briefing, resumo pos-sessao | 2, 3 |
| `agent/emotion_analyzer.py` | Conectar com reatividade emocional do cenario | 2 |
| `supabase/functions/generate-feedback/` | Expandir input e output para 5 camadas do relatorio | 4 |
| `supabase/functions/generate-scenario/` | Redesenhar para gerar todos os campos (expostos + ocultos) | 2 |
| `supabase/functions/suggest-scenario-fields/` | Adaptar para previa conversacional + campos editaveis | 2 |
| Frontend `src/components/Session/` | HUD do coach, ferramentas acionaveis, briefing | 3 |
| Frontend `src/components/Feedback/` | 5 camadas do relatorio, visao gestor | 4 |
| Frontend `src/components/Scenarios/` | Builder redesenhado (input minimo + previa + campos) | 2 |

---

## FASE 1: Schema e Modelo de Dados

**Objetivo**: Expandir o banco para suportar a nova estrutura de cenarios, coach e relatorio sem quebrar nada existente.

**Sintoma do problema atual**: Cenarios tem apenas `context`, `avatar_profile`, `objections` e `evaluation_criteria`. Todo comportamento dinamico vive hard-coded em `prompts.py`. Nao ha versionamento. Sessoes nao registram modo (solo/coach) nem eventos do coach.

### O que implementar

**1. Expandir tabela scenarios**

Adicionar campos JSONB para dados estruturados. Todos nullable para manter compatibilidade com cenarios existentes.

```sql
-- Migration: expand_scenarios_structured_fields

-- Bloco Situacao
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS session_type VARCHAR(50);
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS market_context JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS user_objective TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS opening_line TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS success_condition TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS end_condition TEXT;

-- Bloco Personagem
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS character_name VARCHAR(100);
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS character_role VARCHAR(100);
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS personality TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS hidden_objective TEXT;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS initial_emotion VARCHAR(50);
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS emotional_reactivity JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS communication_style JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS typical_phrases JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS knowledge_limits JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS backstory TEXT;

-- Bloco Avaliacao
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS criteria_weights JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS positive_indicators JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS negative_indicators JSONB;

-- Comportamento Dinamico
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS phase_flow JSONB;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS difficulty_escalation JSONB;

-- Versionamento
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS version_history JSONB DEFAULT '[]';
```

Estrutura esperada do `phase_flow` JSONB:

```json
{
  "phases": [
    {
      "id": "opening",
      "name": "Abertura",
      "duration_seconds": 30,
      "behavior": "Avatar se apresenta, estabelece contexto, da espaco para o usuario",
      "transition_trigger": "usuario responde ou primeira objecao levantada"
    },
    {
      "id": "body",
      "name": "Corpo",
      "duration_seconds": 120,
      "behavior": "Objecoes, discovery, negociacao conforme objetivo oculto",
      "transition_trigger": "tempo esgotando ou condicao de sucesso/fracasso"
    },
    {
      "id": "closing",
      "name": "Encerramento",
      "duration_seconds": 30,
      "behavior": "Avatar sinaliza decisao conforme desempenho do usuario",
      "transition_trigger": "avatar declara decisao ou tempo esgota"
    }
  ]
}
```

Estrutura esperada do `emotional_reactivity` JSONB:

```json
{
  "rules": [
    {
      "trigger": "usuario ignora 2 objecoes",
      "emotion_change": "impaciente",
      "description": "Demonstra frustracao sutil"
    },
    {
      "trigger": "usuario faz boa pergunta de discovery",
      "emotion_change": "interessado",
      "description": "Abre mais, oferece informacao voluntariamente"
    },
    {
      "trigger": "usuario empurra features sem ouvir",
      "emotion_change": "cetico",
      "description": "Recua, respostas mais curtas"
    }
  ]
}
```

**2. Criar tabela scenario_versions**

```sql
-- Migration: create_scenario_versions

CREATE TABLE scenario_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(scenario_id, version)
);

CREATE INDEX idx_scenario_versions_scenario ON scenario_versions(scenario_id);
```

O snapshot JSONB contem uma copia completa de todos os campos do cenario no momento da criacao da versao. Quando um cenario e editado, o sistema:
1. Copia todos os campos atuais para scenario_versions com a versao atual
2. Incrementa o campo version na tabela scenarios
3. Aplica as edicoes

**3. Expandir tabela sessions**

```sql
-- Migration: expand_sessions_coach_data

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_mode VARCHAR(20) DEFAULT 'solo';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scenario_version INTEGER;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coach_events JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phase_transitions JSONB DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tool_activations JSONB DEFAULT '[]';

-- coach_events: estados emocionais, hesitacoes, talk ratio por janela
-- phase_transitions: quando mudou de fase, o que causou
-- tool_activations: teleprompter, interpretacao, timeout com contexto
```

Estrutura esperada do `coach_events` JSONB:

```json
[
  {
    "type": "emotion_change",
    "timestamp_ms": 45000,
    "data": {
      "from": "neutro",
      "to": "interessado",
      "cause": "usuario fez pergunta sobre impacto no time"
    }
  },
  {
    "type": "hesitation",
    "timestamp_ms": 72000,
    "data": {
      "duration_ms": 4200,
      "after_avatar_said": "E o investimento, como fica?"
    }
  },
  {
    "type": "talk_ratio_snapshot",
    "timestamp_ms": 90000,
    "data": {
      "user_ratio": 0.65,
      "window_seconds": 30
    }
  }
]
```

Estrutura esperada do `tool_activations` JSONB:

```json
[
  {
    "tool": "teleprompter",
    "timestamp_ms": 55000,
    "context": {
      "avatar_last_said": "Nao sei se cabe no orcamento",
      "avatar_emotion": "cetico",
      "phase": "body"
    },
    "suggestion_given": "Reconheca a preocupacao e pergunte o que caro significa para ele",
    "user_action_after": "seguiu sugestao parcialmente"
  }
]
```

**4. Expandir tabela feedbacks**

```sql
-- Migration: expand_feedbacks_report_layers

ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS confidence_score FLOAT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS assistance_data JSONB;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS narrative_feedback TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS key_moments JSONB;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS next_steps TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS difficulty_context TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS session_validity VARCHAR(20) DEFAULT 'valid';
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS session_validity_reason TEXT;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS manager_notes TEXT;
```

**5. Backfill de cenarios existentes**

INSTRUCAO: Apos aplicar as migrations, preencher os novos campos dos cenarios existentes. Para cada cenario que tem `context` e `avatar_profile` preenchidos, usar GPT-4o-mini para gerar os campos ocultos (personalidade estruturada, objetivo oculto, reatividade emocional, fluxo de fases, etc.) e salvar nos novos campos JSONB. Nao alterar os campos existentes.

```python
# Script de backfill (rodar uma vez)
# Para cada cenario existente:
# 1. Ler context, avatar_profile, objections, evaluation_criteria
# 2. Chamar GPT-4o-mini com prompt de geracao de campos
# 3. Salvar nos novos campos JSONB
# 4. Criar primeira entrada em scenario_versions
```

**Referencia**: Cenarios existentes estao na tabela scenarios com os campos originais do PRD MVP. Ver `docs/archive/spec-v1-mvp.md` secao 4 para a estrutura atual.

---

## FASE 2: Builder de Cenarios e Compilacao de Prompt

**Objetivo**: Implementar o fluxo de criacao de cenarios (input minimo → previa conversacional → campos editaveis) e a compilacao do system prompt a partir dos campos estruturados.

**Dependencia**: Fase 1 completa (schema expandido).

### O que implementar

**1. Redesenhar Edge Function generate-scenario**

A Edge Function atual gera cenarios basicos. Precisa evoluir para:

Input: descricao livre + objetivo do usuario + nivel de dificuldade
Output: cenario completo com TODOS os campos (expostos + ocultos) preenchidos

INSTRUCAO: A funcao deve gerar os campos em uma unica chamada ao Claude/GPT-4o com prompt estruturado que pede JSON. O prompt deve instruir o modelo a gerar:

- character_name, character_role (inferidos da descricao)
- personality (2-3 frases de texto livre)
- hidden_objective (inferido do contexto e dificuldade)
- initial_emotion (derivado da dificuldade e tipo de cenario)
- emotional_reactivity (3-5 regras no formato JSONB documentado na Fase 1)
- communication_style (formal/informal, prolixo/curto, interrompe/espera)
- typical_phrases (3-5 expressoes que ancoram o personagem)
- knowledge_limits (o que sabe e nao sabe)
- backstory (2-3 frases de historico)
- opening_line (fala de abertura do avatar)
- success_condition, end_condition
- session_type (inferido)
- market_context
- target_duration_seconds (baseado no tipo e dificuldade)
- phase_flow (3 fases com duracoes e triggers)
- difficulty_escalation (regras de ajuste dinamico)
- evaluation_criteria com pesos
- positive_indicators, negative_indicators
- objections com keywords e timing sugerido

O prompt deve incluir exemplos dos cenarios pre-configurados como few-shot para garantir qualidade.

**2. Implementar fluxo de previa conversacional**

INSTRUCAO: Criar (ou adaptar) Edge Function que recebe o output do generate-scenario e produz uma previa em linguagem natural. A previa e um paragrafo curto que descreve: quem e o personagem, como vai se comportar, quais objecoes vai levantar, como a sessao comeca e termina, e como o usuario vai ser avaliado.

O frontend exibe essa previa como primeiro passo. O admin pode responder em linguagem natural ("muda X", "quero que Y"). A funcao recebe a correcao, ajusta os campos afetados e regenera a previa. Quando o admin aprova, o sistema avanca para os campos editaveis.

**3. Implementar tela de campos editaveis no frontend**

INSTRUCAO: Apos aprovacao da previa, exibir 6 campos editaveis:

- Nome e cargo do personagem (2 inputs texto)
- Personalidade (textarea, 2-3 frases)
- Objecoes (lista editavel — adicionar, remover, reordenar)
- Objetivo do usuario (input texto, pre-preenchido)
- Criterios de avaliacao (lista editavel)
- Fala de abertura (textarea curta)

Abaixo dos campos expostos, botao "Modo Avancado" que expande accordion com os demais campos agrupados por bloco (Situacao, Personagem, Avaliacao, Comportamento Dinamico). Todos pre-preenchidos pela IA, todos editaveis.

Referencia de UX: manter a estetica do design system do projeto (minimalist, typography-driven, sem icones, sem badges coloridos).

**4. Reescrever build_agent_instructions() em prompts.py**

INSTRUCAO: A funcao atual recebe scenario, outcomes e difficulty_level e monta um prompt monolitico. Reescrever para compilar a partir dos campos estruturados seguindo a arquitetura:

```python
def build_agent_instructions(scenario: dict) -> str:
    """
    Compila system prompt a partir dos campos estruturados do cenario.
    Segue a estrutura recomendada pelo guia de prompting OpenAI Realtime:
    1. Role & Objective
    2. Personality & Tone
    3. Context
    4. Instructions/Rules
    5. Conversation Flow
    6. Safety & Escalation
    """
    sections = []

    # 1. Role & Objective
    # Usar: character_name, character_role, hidden_objective
    # Incluir regras anti-inversao de papeis (manter as existentes)
    sections.append(build_role_section(scenario))

    # 2. Personality & Tone
    # Usar: personality, communication_style, typical_phrases
    sections.append(build_personality_section(scenario))

    # 3. Context
    # Usar: market_context, backstory, knowledge_limits
    sections.append(build_context_section(scenario))

    # 4. Instructions/Rules
    # Usar: emotional_reactivity, difficulty_escalation, objections com timing
    # Incluir regras existentes de prompts.py que ainda se aplicam
    sections.append(build_instructions_section(scenario))

    # 5. Conversation Flow
    # Usar: phase_flow, opening_line, success_condition, end_condition
    sections.append(build_flow_section(scenario))

    # 6. Safety & Escalation
    # Usar: end_condition, fallback behaviors
    sections.append(build_safety_section(scenario))

    return "\n\n".join(sections)
```

INSTRUCAO CRITICA: Manter TODAS as regras anti-inversao de papeis que existem no prompts.py atual (secao "SEU PAPEL (CRITICO)" e as 11 regras). Essas regras foram resultado de bugs reais (BUG-018). Nao remover nenhuma — incorporar na secao Role & Objective.

INSTRUCAO: A funcao deve ter fallback graceful. Se um campo JSONB esta vazio ou nulo (cenario antigo que nao foi migrado), a funcao usa o comportamento atual — monta o prompt a partir de context e avatar_profile como faz hoje. Isso garante compatibilidade.

**5. Implementar versionamento no save de cenario**

INSTRUCAO: Quando um cenario e editado (qualquer campo alterado), antes de salvar:
1. Copiar snapshot completo de todos os campos para scenario_versions
2. Incrementar campo version
3. Salvar edicoes

Quando uma sessao e criada, registrar scenario_version = cenario.version na tabela sessions. O generate-feedback usa essa versao para buscar o snapshot correto.

**Referencia de codigo**:
- `agent/prompts.py` — funcao atual build_agent_instructions()
- `supabase/functions/generate-scenario/` — funcao atual de geracao
- `supabase/functions/suggest-scenario-fields/` — funcao de sugestao de campos
- `docs/spec-cenarios-coach-relatorio.md` secao 2 — decisoes de produto

---

## FASE 3: Coach Evoluido

**Objetivo**: Evoluir o coach_orchestrator.py para emitir estados continuos (HUD), responder a ferramentas acionaveis, detectar fase do cenario, e operar em modo silencioso.

**Dependencia**: Fase 2 completa (cenarios com campos estruturados e phase_flow).

### O que implementar

**1. Adicionar emissao de estados continuos ao orchestrator**

O orchestrator ja rastreia emocao, SPIN stage e talk ratio internamente. Adicionar emissao desses estados como participant attributes do LiveKit a cada atualizacao.

INSTRUCAO: No `livekit/agents`, estudar `examples/role-playing/` para o pattern de participant attributes. Implementar:

```python
# No coach_orchestrator.py, novo metodo
async def emit_hud_state(self):
    """Emite estado atual para o frontend via participant attributes"""
    state = {
        "avatar_emotion": self.current_emotion,
        "talk_ratio": self.calculate_current_talk_ratio(),
        "current_phase": self.current_phase_id,
        "session_elapsed_seconds": self.elapsed_seconds,
        "objections_status": {
            "raised": self.objections_raised_count,
            "addressed": self.objections_addressed_count,
            "total_expected": self.total_expected_objections
        }
    }
    await self.participant.set_attributes(state)
```

Frontend le via `useParticipantAttributes` do LiveKit React SDK e renderiza o HUD.

INSTRUCAO: O HUD no frontend consiste em tres componentes visuais leves, posicionados de forma a nao competir com o avatar/audio:

- `EmotionIndicator` — rotulo que mostra estado emocional do avatar (usa emotionConfig existente mas sem emoji — apenas texto e cor)
- `TalkRatioBar` — barra horizontal proporcional mostrando balanco de fala
- `PhaseIndicator` — indicador de fase atual (Abertura / Discovery / Objecao / Fechamento)

**2. Implementar deteccao de fase do cenario**

O orchestrator recebe o phase_flow do cenario no inicio da sessao e detecta transicoes.

INSTRUCAO: Implementar classe PhaseDetector dentro do orchestrator:

```python
class PhaseDetector:
    def __init__(self, phase_flow: dict):
        self.phases = phase_flow.get("phases", [])
        self.current_phase_index = 0
        self.phase_start_time = 0

    def evaluate(self, context: dict) -> str | None:
        """Retorna novo phase_id se houve transicao, None se nao"""
        current_phase = self.phases[self.current_phase_index]
        elapsed_in_phase = context["elapsed_ms"] - self.phase_start_time

        # Transicao por tempo (duracao da fase esgotada)
        if elapsed_in_phase > current_phase["duration_seconds"] * 1000:
            return self._advance_phase(context["elapsed_ms"])

        # Transicao por trigger (avatar levantou objecao, condicao atingida)
        if self._trigger_met(current_phase, context):
            return self._advance_phase(context["elapsed_ms"])

        return None
```

O mecanismo de deteccao de trigger combina: comportamento do avatar (levantou objecao = entrou em fase de objecao), tempo decorrido, e keywords detectadas na conversa.

**3. Implementar ferramentas acionaveis**

Tres ferramentas, acionadas pelo frontend via RPC do LiveKit.

INSTRUCAO: No `livekit/agents`, estudar `examples/rpc_agent.py` para o pattern de RPC.

**Ferramenta 1 — Teleprompter**

```python
# Registrar RPC handler no agent
@session.rpc("tool_teleprompter")
async def handle_teleprompter(request):
    """Retorna sugestao do que o usuario deveria dizer"""
    # Se pre-calculo existe e ainda e relevante, retorna imediatamente
    if self.precomputed_suggestion and self._is_suggestion_fresh():
        return json.dumps(self.precomputed_suggestion)

    # Senao, gera sob demanda via GPT-4o-mini
    suggestion = await self._generate_teleprompter(
        avatar_last_said=self.last_avatar_utterance,
        avatar_emotion=self.current_emotion,
        current_phase=self.current_phase,
        pending_objections=self.pending_objections,
        user_objective=self.scenario["user_objective"],
        conversation_context=self.recent_transcript
    )
    return json.dumps(suggestion)
```

Output do teleprompter — JSON com duas camadas:

```json
{
    "strategy": "Reconheca a preocupacao com preco e explore o que caro significa para ele",
    "suggested_phrase": "Entendo sua preocupacao com o investimento. Posso perguntar: quando voce diz que e caro, esta comparando com alguma alternativa especifica?"
}
```

INSTRUCAO: Implementar pre-calculo. A cada turno do avatar, o orchestrator dispara uma chamada background a GPT-4o-mini para gerar sugestao. O resultado fica em cache. Se o usuario aciona o teleprompter, a sugestao ja esta pronta (latencia zero). Se nao aciona, descarta quando o proximo turno do avatar chega.

```python
# No hook on_agent_speech_end
async def _precompute_teleprompter(self):
    """Pre-calcula sugestao em background para latencia zero"""
    suggestion = await self._generate_teleprompter(...)
    self.precomputed_suggestion = {
        "data": suggestion,
        "generated_at_ms": self.elapsed_ms,
        "for_avatar_utterance": self.last_avatar_utterance[:50]
    }
```

**Ferramenta 2 — "O que ele quis dizer?"**

```python
@session.rpc("tool_interpret")
async def handle_interpret(request):
    """Interpreta intencao por tras da ultima fala do avatar"""
    interpretation = await self._generate_interpretation(
        avatar_said=self.last_avatar_utterance,
        hidden_objective=self.scenario.get("hidden_objective", ""),
        avatar_emotion=self.current_emotion,
        current_phase=self.current_phase,
        conversation_context=self.recent_transcript
    )
    return json.dumps({"interpretation": interpretation})
```

O prompt para GPT-4o-mini deve incluir o objetivo oculto do personagem para gerar interpretacoes que revelem a intencao real. Ex: se o objetivo oculto e "quer desconto mas nao vai pedir" e o avatar disse "Preciso pensar com calma", a interpretacao deveria ser "Ele esta esperando que voce ofereca uma condicao melhor. Nao e um nao — e uma abertura para negociacao de preco."

**Ferramenta 3 — Timeout/Pause**

```python
@session.rpc("tool_timeout")
async def handle_timeout(request):
    """Pausa a sessao e retorna resumo do estado atual"""
    self.is_paused = True
    self.pause_start_ms = self.elapsed_ms

    summary = {
        "avatar_last_said": self.last_avatar_utterance,
        "avatar_emotion": self.current_emotion,
        "current_phase": self.current_phase,
        "pending_objection": self.current_pending_objection,
        "time_elapsed_seconds": self.elapsed_ms // 1000,
        "time_remaining_seconds": (self.max_duration_ms - self.elapsed_ms) // 1000
    }
    return json.dumps(summary)

@session.rpc("tool_resume")
async def handle_resume(request):
    """Retoma a sessao apos pause"""
    pause_duration = self.elapsed_ms - self.pause_start_ms
    self.total_pause_time_ms += pause_duration
    self.is_paused = False
    return json.dumps({"resumed": True})
```

INSTRUCAO: Quando pausado, o timer da sessao congela. O tempo de pause nao conta para a duracao da sessao nem para talk ratio. O avatar retoma exatamente de onde parou.

**4. Registrar eventos do coach**

INSTRUCAO: Toda mudanca de estado, acionamento de ferramenta e deteccao relevante e registrada como evento na lista coach_events da sessao.

```python
def _record_event(self, event_type: str, data: dict):
    """Registra evento para o relatorio"""
    event = {
        "type": event_type,
        "timestamp_ms": self.elapsed_ms,
        "data": data
    }
    self.session_events.append(event)
```

Eventos a registrar:
- `emotion_change` — de/para/causa
- `phase_transition` — de/para/trigger
- `hesitation` — duracao, apos qual fala do avatar
- `talk_ratio_snapshot` — ratio, janela
- `tool_teleprompter` — contexto, sugestao, acao do usuario depois
- `tool_interpret` — fala do avatar, interpretacao
- `tool_timeout` — duracao do pause, contexto
- `objection_detected` — qual objecao, quando
- `objection_addressed` — qual objecao, como
- `missed_opportunity` (modo solo) — momento em que ferramenta teria ajudado

Ao final da sessao, salvar coach_events, phase_transitions e tool_activations na tabela sessions.

**5. Implementar modo silencioso**

INSTRUCAO: Quando session_mode = 'solo', o orchestrator:
- NAO emite participant attributes para o HUD
- NAO aceita RPCs de ferramentas (retorna erro amigavel se chamado)
- CONTINUA registrando eventos internamente
- ADICIONA eventos do tipo `missed_opportunity` quando detecta que o usuario teria se beneficiado de ajuda

```python
if self.session_mode == "solo":
    # Registrar mas nao emitir
    self._record_event("missed_opportunity", {
        "reason": "hesitacao longa apos objecao de preco",
        "tool_that_would_help": "teleprompter",
        "avatar_said": self.last_avatar_utterance[:100]
    })
```

**6. Implementar briefing pre-sessao**

INSTRUCAO: Antes da sessao iniciar (apos conexao a room mas antes do primeiro turno), enviar briefing via RPC ou data channel ao frontend.

```python
async def send_briefing(self):
    briefing = {
        "character_name": self.scenario.get("character_name"),
        "character_role": self.scenario.get("character_role"),
        "context_summary": self._generate_brief_context(),
        "user_objective": self.scenario.get("user_objective"),
        "session_mode": self.session_mode,
        "target_duration_seconds": self.scenario.get("target_duration_seconds"),
        "coach_available": self.session_mode == "com_coach"
    }
    await self.send_rpc("session_briefing", briefing)
```

**7. Implementar resumo pos-sessao**

INSTRUCAO: Quando a sessao termina, no modo com coach, enviar resumo rapido antes do relatorio completo.

```python
async def send_session_summary(self):
    if self.session_mode != "com_coach":
        return

    summary = {
        "objections_addressed": self.objections_addressed_count,
        "objections_total": self.total_objections_raised,
        "final_emotion": self.current_emotion,
        "session_duration_seconds": self.elapsed_ms // 1000,
        "tools_used": len(self.tool_activation_events),
        "message": self._generate_quick_summary()
    }
    await self.send_rpc("session_quick_summary", summary)
```

**Referencia de codigo**:
- `agent/coach_orchestrator.py` — orchestrator atual com InjectionQueue e gating
- `agent/ai_coach.py` — logica de coaching GPT-4o-mini (sera absorvida/adaptada)
- `agent/emotion_analyzer.py` — analise emocional (conectar com reatividade do cenario)
- `livekit/agents/examples/role-playing/` — participant attributes
- `livekit/agents/examples/rpc_agent.py` — RPC pattern
- `docs/spec-cenarios-coach-relatorio.md` secao 3 — decisoes de produto

---

## FASE 4: Relatorio Evoluido

**Objetivo**: Expandir generate-feedback para produzir as 5 camadas do relatorio, adaptando ao modo da sessao.

**Dependencia**: Fase 3 completa (coach registrando eventos).

### O que implementar

**1. Expandir input do generate-feedback**

INSTRUCAO: A Edge Function atualmente recebe session_id e busca transcript + cenario. Expandir para buscar:

```typescript
// Dados a buscar para o relatorio
const sessionData = {
    // Existente
    transcript: session.transcript,
    scenario: scenario,  // Buscar versao correta via scenario_version

    // Novo
    session_mode: session.session_mode,
    coach_events: session.coach_events,
    phase_transitions: session.phase_transitions,
    tool_activations: session.tool_activations,
    duration_seconds: session.duration_seconds,
    scenario_difficulty: scenario.difficulty_level,

    // Historico do usuario (novo)
    previous_sessions: await getPreviousSessions(session.access_code_id, scenario.id, 5),
    user_learning_profile: await getUserLearningProfile(session.access_code_id)
};
```

INSTRUCAO CRITICA: Buscar cenario pela versao registrada na sessao (session.scenario_version), nao pela versao atual do cenario. Usar tabela scenario_versions.

**2. Redesenhar prompt do Claude para 5 camadas**

INSTRUCAO: O prompt ao Claude deve pedir output JSON estruturado com todas as camadas. Uma unica chamada.

```typescript
const claudePrompt = `
Analise esta sessao de roleplay de treinamento de vendas e gere um relatorio completo.

## CENARIO
${JSON.stringify(scenarioSnapshot)}

## TRANSCRIPT
${transcript}

## MODO DA SESSAO
${session_mode} (solo = sem assistencia do coach | com_coach = com HUD e ferramentas)

## EVENTOS DO COACH
${JSON.stringify(coach_events)}

## FERRAMENTAS ACIONADAS
${JSON.stringify(tool_activations)}

## HISTORICO DO USUARIO (ultimas 5 sessoes neste cenario)
${JSON.stringify(previous_sessions_summary)}

## INSTRUCOES

Retorne APENAS um JSON valido com a seguinte estrutura:

{
    "session_validity": {
        "status": "valid" | "invalid",
        "reason": "motivo se invalido"
    },
    "score": {
        "overall": 0-100,
        "confidence": 0.0-1.0,
        "difficulty_context": "texto explicando equivalencia por dificuldade"
    },
    "criteria_results": [
        {
            "criteria_id": "string",
            "level": 1-4,
            "weight": 0.0-1.0,
            "observation": "texto",
            "evidence_text": "trecho do transcript",
            "evidence_start_index": 0,
            "evidence_end_index": 0
        }
    ],
    "narrative_feedback": "paragrafo narrativo contando o que aconteceu na sessao",
    "key_moments": [
        {
            "timestamp_ms": 0,
            "label": "objecao_tratada" | "oportunidade_perdida" | "virada_emocional" | "uso_ferramenta" | "boa_pergunta" | "risco",
            "description": "texto curto",
            "transcript_excerpt": "trecho"
        }
    ],
    "coach_analysis": {
        "mode": "solo" | "com_coach",
        "assistance_summary": {
            "teleprompter_count": 0,
            "interpret_count": 0,
            "timeout_count": 0,
            "total_pause_seconds": 0
        },
        "missed_opportunities": [
            {
                "timestamp_ms": 0,
                "description": "texto",
                "suggested_tool": "teleprompter" | "interpret" | "timeout"
            }
        ]
    },
    "evolution": {
        "score_trend": "subindo" | "estavel" | "descendo",
        "comparison_with_previous": "texto comparando com sessoes anteriores",
        "improving_areas": ["lista de competencias melhorando"],
        "declining_areas": ["lista de competencias piorando"]
    },
    "next_steps": "recomendacao concreta e acionavel para a proxima sessao"
}

REGRAS:
- Se session_validity.status = "invalid", ainda gere narrative_feedback e key_moments se houver dados suficientes, mas NAO gere score nem criteria_results
- narrative_feedback deve ser um paragrafo fluido que conta a historia da sessao, nao uma lista de pontos
- key_moments: 3-5 momentos, priorizando os mais impactantes
- Se modo = "solo", coach_analysis.missed_opportunities deve listar momentos onde o usuario hesitou ou perdeu oportunidades
- Se modo = "com_coach", coach_analysis deve refletir as ferramentas usadas e o impacto
- next_steps deve ser especifico ao que aconteceu nesta sessao, nao generico
- difficulty_context deve converter o score para equivalencia em dificuldade media
- confidence deve ser < 0.7 se transcript cobriu menos de 80% da sessao ou se houve menos de 6 turnos
`;
```

**3. Processar e salvar output**

INSTRUCAO: Apos receber o JSON do Claude, validar, processar e salvar nos campos expandidos:

```typescript
// Salvar nas colunas expandidas
await supabase.from('feedbacks').update({
    // Existente (manter compatibilidade)
    score: result.score.overall,
    summary: result.narrative_feedback,  // Manter campo existente preenchido
    criteria_results: result.criteria_results,

    // Novo
    confidence_score: result.score.confidence,
    narrative_feedback: result.narrative_feedback,
    key_moments: result.key_moments,
    assistance_data: result.coach_analysis,
    next_steps: result.next_steps,
    difficulty_context: result.score.difficulty_context,
    session_validity: result.session_validity.status,
    session_validity_reason: result.session_validity.reason
}).eq('session_id', session_id);
```

**4. Implementar frontend do relatorio**

INSTRUCAO: A pagina de feedback atual exibe score + criterios + summary. Expandir para as 5 camadas:

Componentes a criar/modificar:

- `ReportHeader` — score geral com indicador de confianca, indicador de assistencia, contextualizacao por dificuldade
- `NarrativeFeedback` — paragrafo narrativo (substituir ou complementar o summary atual)
- `KeyMoments` — lista de 3-5 momentos com etiquetas coloridas e link para transcript
- `CoachAnalysis` — secao condicional: "Assistencia do Coach" (modo com coach) ou "Oportunidades Perdidas" (modo solo)
- `EvolutionSection` — comparativo com sessoes anteriores, tendencias por competencia
- `NextSteps` — caixa de destaque com recomendacao acionavel
- `ManagerNotes` — textarea visivel apenas para gestores (role = admin/manager), salva em feedbacks.manager_notes
- `InvalidSessionState` — estado alternativo quando sessao nao e avaliavel

INSTRUCAO: Manter componentes existentes de criterios (CriteriaChecklist, evidencias) — eles ja funcionam. As novas camadas sao adicionais, nao substitutas.

**5. Implementar visao do gestor**

INSTRUCAO: Quando o usuario logado tem role admin ou manager, o relatorio exibe:
- Tudo que o usuario ve
- Campo de notas do gestor (editavel, salva em feedbacks.manager_notes)
- Badge visual de assistencia em destaque (quantas ferramentas usadas)
- Link para comparar com outros membros da equipe no mesmo cenario (se analytics existir)

**Referencia de codigo**:
- `supabase/functions/generate-feedback/` — funcao atual (~1069 linhas)
- `frontend/src/components/Feedback/` — componentes atuais
- `docs/prd/08-avaliacao-evidenciada-v2.md` — PRD de avaliacao que ja existe
- `docs/spec-cenarios-coach-relatorio.md` secao 4 — decisoes de produto

---

## FASE 5: Cenarios Pre-configurados

**Objetivo**: Recriar os cenarios existentes na nova estrutura com todos os campos preenchidos.

**Dependencia**: Fases 1-4 completas.

### O que implementar

**1. Recriar cenarios existentes**

INSTRUCAO: Os cenarios atuais (Venda de Seguro de Vida, Negociacao de Contrato B2B, Retencao de Cliente Insatisfeito, e os 6 cenarios RE/MAX da migration 020) devem ser enriquecidos com todos os campos da nova estrutura.

Para cada cenario:
1. Usar o generate-scenario atualizado (Fase 2) passando a descricao existente
2. Revisar e ajustar os campos gerados para garantir qualidade
3. Garantir que phase_flow, emotional_reactivity e difficulty_escalation estao completos e coerentes
4. Criar entrada em scenario_versions (versao 1)

Os cenarios pre-configurados servem como referencia de qualidade — devem ser exemplares. Nao sao versoes simplificadas.

**2. Criar cenario modelo para testes**

INSTRUCAO: Criar 1 cenario completo documentado com todos os campos preenchidos e comentados, servindo como template/referencia para o generate-scenario e para testes E2E. Salvar como fixture em `tests/fixtures/scenario_complete_example.json`.

---

## Regras Transversais

- REGRA PRINCIPAL: Antes de implementar qualquer fase, leia `docs/spec-cenarios-coach-relatorio.md` e este arquivo.
- Nao quebre o que ja funciona. Todos os campos novos sao nullable. Fallbacks para cenarios antigos.
- Se main.py ou coach_orchestrator.py ficarem grandes demais, quebre em modulos.
- Commits atomicos: um commit por sub-task dentro de cada fase.
- Para cada fase implementada, documente o que mudou no CHANGELOG.md.
- Teste com os cenarios existentes antes de considerar a fase completa.
- Se encontrar conflito entre este documento e o AGENTS.md principal, este documento tem prioridade para as fases aqui descritas.
