# Especificação Técnica v2 — Live Roleplay

**Data:** Fevereiro 2026
**Versão:** 2.0
**Plataforma:** Treinamento de vendas com roleplay AI em tempo real

---

## 1. Visão Técnica

### Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USUÁRIO (Browser/PWA)                        │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Frontend React 18 + TypeScript + Vite + Tailwind CSS           │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │Components│ │  Hooks       │ │   Lib    │ │    Pages      │  │  │
│  │  │(UI)      │ │(useAuth,     │ │(Supabase │ │(Login, Room,  │  │  │
│  │  │          │ │ useSession,  │ │ client)  │ │ Feedback)     │  │  │
│  │  │          │ │ useFeedback) │ │          │ │               │  │  │
│  │  └──────────┘ └──────────────┘ └──────────┘ └───────────────┘  │  │
│  └───────────────────────┬──────────────────────────────────────────┘  │
│                          │ WebRTC (LiveKit SDK)                        │
│                          │ REST (Supabase SDK)                         │
└──────────────────────────┼─────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────────────┐
          │                │                         │
          ▼                ▼                         ▼
┌──────────────┐  ┌────────────────┐     ┌─────────────────────────┐
│  LiveKit     │  │  Supabase      │     │  Vercel (Hosting)       │
│  Cloud       │  │  Cloud         │     │  Frontend CDN + SSR     │
│              │  │                │     └─────────────────────────┘
│  ┌────────┐  │  │  ┌──────────┐  │
│  │WebRTC  │  │  │  │PostgreSQL│  │
│  │Rooms   │  │  │  │(12+ tbl) │  │
│  │SFU     │  │  │  ├──────────┤  │
│  └───┬────┘  │  │  │Auth      │  │
│      │       │  │  ├──────────┤  │
└──────┼───────┘  │  │Edge Func │  │
       │          │  │(6 funcs) │  │
       │          │  └──────────┘  │
       ▼          └────────────────┘
┌─────────────────────────────────────────────────────┐
│  Railway (Agent Python)                              │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  LiveKit Agents SDK 1.4.x                    │   │
│  │  ┌────────────┐  ┌────────────────────────┐  │   │
│  │  │ AgentSession│  │ Plugins               │  │   │
│  │  │            │  │ ┌──────────────────┐   │  │   │
│  │  │ prompts.py │  │ │OpenAI Realtime   │   │  │   │
│  │  │            │  │ │(STT+LLM+TTS)    │   │  │   │
│  │  └────────────┘  │ ├──────────────────┤   │  │   │
│  │                   │ │Silero VAD        │   │  │   │
│  │  ┌────────────┐  │ ├──────────────────┤   │  │   │
│  │  │Coach       │  │ │Hedra Character-3 │   │  │   │
│  │  │Orchestrator│  │ │(lip-sync avatar) │   │  │   │
│  │  │(unified)   │  │ │[DISABLED]        │   │  │   │
│  │  ├────────────┤  │ └──────────────────┘   │  │   │
│  │  │Emotion     │  └────────────────────────┘  │   │
│  │  │Analyzer    │                               │   │
│  │  │(GPT-4o-mini│  ┌────────────────────────┐  │   │
│  │  │ async)     │  │ Metrics Collector      │  │   │
│  │  └────────────┘  │ (custos por sessão)    │  │   │
│  │                   └────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
       │                      │
       ▼                      ▼
┌──────────────┐     ┌────────────────┐
│ OpenAI API   │     │  Claude API    │
│              │     │  (Anthropic)   │
│ - Realtime   │     │                │
│   (voice)    │     │ - Feedback     │
│ - GPT-4o-mini│     │   pós-sessão   │
│   (analysis) │     │   (structured) │
└──────────────┘     └────────────────┘
```

### Fluxo de Dados Principal

```
1. Login          → Código de acesso → Supabase Auth
2. Seleção        → Cenário + dificuldade → Frontend state
3. Conexão        → Edge Function gera token → LiveKit Cloud
4. Sessão         → Agent conecta à room → OpenAI Realtime (voz)
                  → Silero VAD detecta fala → Turnos de conversa
                  → GPT-4o-mini analisa emoção (async, ~1-2s)
                  → AI Coach gera sugestões (a cada 2-3 turnos)
                  → Conversation Coach detecta hesitação/silêncio
                  → Metrics Collector rastreia custos
5. Encerramento   → Transcript salvo → Supabase
6. Feedback       → Claude API gera avaliação → Rubrics 1-4
7. Visualização   → Score + critérios + evidências → Frontend
```

---

## 2. Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | React | 18.x |
| | TypeScript | 5.x |
| | Vite | 5.x |
| | Tailwind CSS | 3.x |
| | LiveKit React SDK | 2.x |
| | PWA (Service Worker) | — |
| **Backend** | Supabase (PostgreSQL) | Cloud |
| | Supabase Auth | Cloud |
| | Supabase Edge Functions | Deno runtime |
| **Agent** | Python | 3.11+ |
| | LiveKit Agents SDK | 1.4.x |
| | aiohttp | 3.x |
| **AI — Conversação** | OpenAI Realtime API | gpt-4o-realtime-preview |
| | (unificado: STT + LLM + TTS) | |
| **AI — Análise** | OpenAI GPT-4o-mini | gpt-4o-mini |
| | (emotion analyzer + AI coach) | |
| **AI — Feedback** | Claude API (Anthropic) | claude-3.5-sonnet |
| | (avaliação pós-sessão) | |
| **VAD** | Silero VAD | via LiveKit plugin |
| | min_silence_duration | 0.15s |
| **Avatar** | Hedra Character-3 | API v1 |
| | (lip-sync em tempo real) | DISABLE_AVATAR=true |
| **Hosting — Frontend** | Vercel | Cloud |
| **Hosting — Agent** | Railway | Cloud |
| **Hosting — Backend** | Supabase | Cloud |
| **WebRTC** | LiveKit | Cloud |
| **Testes E2E** | Playwright | 1.x |

---

## 3. Estrutura do Projeto

```
live_roleplay/
├── agent/                          # Agent Python (Railway)
│   ├── main.py                     # Orquestração LiveKit + OpenAI Realtime + Hedra
│   ├── prompts.py                  # Compilação de prompts a partir de campos estruturados (6 seções)
│   ├── coach_orchestrator.py       # Coaching unificado: keywords + AI + silêncio + SPIN (ADR-006)
│   ├── emotion_analyzer.py         # Análise emocional GPT-4o-mini (8 estados)
│   ├── metrics_collector.py        # Coleta de métricas e custos por sessão
│   ├── requirements.txt            # Dependências Python
│   ├── Dockerfile                  # Container para Railway
│   ├── entrypoint.sh               # Script de inicialização (download + start)
│   ├── railway.json                # Config Railway (startCommand, restartPolicy)
│   └── scripts/                    # Scripts auxiliares do agent
│
├── frontend/                       # React App (Vercel)
│   └── src/
│       ├── components/             # Componentes UI (Room, Feedback, Scenario, etc.)
│       ├── hooks/                  # Hooks customizados
│       │   ├── useAuth             # Autenticação via código de acesso
│       │   ├── useSession          # Gerenciamento de sessão de roleplay
│       │   ├── useFeedback         # Busca e exibição de feedback
│       │   └── useScenarios        # Listagem e seleção de cenários
│       ├── lib/                    # Supabase client e utilitários
│       ├── pages/                  # Páginas da aplicação
│       ├── types/                  # Tipos TypeScript
│       └── assets/                 # Recursos estáticos
│
├── supabase/
│   └── functions/                  # Edge Functions (Deno/TypeScript)
│       ├── _shared/                # Código compartilhado entre funções
│       ├── create-livekit-token/   # Geração de token de acesso LiveKit
│       ├── generate-feedback/      # Feedback pós-sessão via Claude API
│       ├── generate-scenario/      # Geração de cenários via AI
│       ├── suggest-scenario-fields/# Sugestões de campos para cenários
│       ├── get-api-metrics/        # Métricas de uso de APIs
│       └── manage-scenario/        # CRUD de cenários
│
├── tests/
│   ├── e2e/                        # Testes Playwright (26 specs)
│   └── benchmark/                  # Suite de comparação de stacks
│       ├── automated/              # Testes automatizados (latência, custo, WER)
│       ├── semi_auto/              # Testes semi-automáticos (estabilidade, objeções)
│       ├── manual/                 # Formulário de avaliação manual
│       ├── fixtures/               # Dados de teste (frases, cenários, inputs)
│       └── results/                # Resultados JSON timestamped
│
├── docs/
│   ├── spec.md                     # Esta especificação técnica (v2)
│   ├── database-architecture-v2.1.md # Arquitetura de banco (12+ tabelas)
│   ├── adr/                        # Architecture Decision Records
│   └── prd/                        # Product Requirements Documents
│       ├── 00-visao-estrategica.md
│       ├── 01-conversation-intelligence.md
│       ├── 02-avatar-emocional.md
│       ├── 03-gamificacao.md
│       ├── 04-realtime-coaching.md
│       ├── 05-analytics-dashboard.md
│       ├── 06-enterprise-features.md
│       ├── 07-advanced-ai.md
│       └── 08-avaliacao-evidenciada-v2.md
│
├── observability/                  # Configurações de observabilidade
├── scripts/                        # Scripts de automação
├── AGENTS.md                       # Instruções para agentes AI
├── CLAUDE.md                       # Contexto do projeto para Claude
├── BUGS.md                         # Registro de bugs
├── CHANGELOG.md                    # Histórico de mudanças
└── README.md                       # Documentação principal
```

---

## 4. Modelos de Dados

A arquitetura de banco de dados completa está documentada em `docs/database-architecture-v2.1.md`. O sistema atual possui **12+ tabelas** organizadas em 5 categorias.

### Tabelas Principais

| Categoria | Tabela | Descrição |
|-----------|--------|-----------|
| **Acesso** | `access_codes` | Códigos de login (trial/enterprise) |
| **Conteúdo** | `scenarios` | Cenários com 22+ campos estruturados (contexto, personagem, fluxo, avaliação, versionamento) |
| | `criterion_rubrics` | Rubricas de avaliação 1-4 por critério |
| | `scenario_objections` | Objeções com keywords para detecção |
| | `scenario_outcomes` | Resultados possíveis do cenário (fechou, escalou, cancelou) |
| **Sessões** | `sessions` | Sessões de roleplay (transcript, duração, room_name, scenario_version, coach_events) |
| | `feedbacks` | Avaliações estruturadas (scores, critérios, narrative_feedback, key_moments) |
| | `session_evidences` | Trechos do transcript linkados a critérios |
| | `session_objection_status` | Status de cada objeção na sessão (detectada/respondida) |
| **Perfil** | `user_difficulty_profiles` | Nível adaptativo por usuário/cenário |
| | `user_learning_profiles` | Evolução cross-session (padrões, pontos fortes/fracos) |
| **Métricas** | `api_metrics` | Custos de APIs por sessão (OpenAI, Claude, LiveKit, Avatar) |

### Relacionamentos Chave

```
access_codes ──1:N──► sessions
scenarios    ──1:N──► sessions
scenarios    ──1:N──► scenario_objections
scenarios    ──1:N──► scenario_outcomes
scenarios    ──1:N──► criterion_rubrics
sessions     ──1:1──► feedbacks
sessions     ──1:N──► session_evidences
sessions     ──1:N──► session_objection_status
sessions     ──1:1──► api_metrics
access_codes ──1:1──► user_difficulty_profiles
access_codes ──1:1──► user_learning_profiles
```

---

## 5. Integrações

### OpenAI Realtime API

- **Modelo:** `gpt-4o-realtime-preview`
- **Função:** Conversação em tempo real (STT + LLM + TTS unificado)
- **Protocolo:** WebSocket via LiveKit Agents SDK
- **Configuração:** Voz, temperatura, instruções dinâmicas por cenário
- **Arquivo:** `agent/main.py`

### OpenAI GPT-4o-mini

- **Função:** Análise auxiliar em tempo real
  - **Emotion Analyzer:** Detecção de 8 estados emocionais do cliente (async, ~1-2s)
  - **AI Coach:** Sugestões contextuais para o usuário (streaming, a cada 2-3 turnos)
- **Arquivos:** `agent/emotion_analyzer.py`, `agent/coach_orchestrator.py`

### Claude API (Anthropic)

- **Modelo:** Claude 3.5 Sonnet
- **Função:** Geração de feedback pós-sessão estruturado
- **Saída:** Score geral, critérios com rubricas 1-4, evidências do transcript
- **Arquivo:** `supabase/functions/generate-feedback/`

### LiveKit Cloud

- **Função:** Infraestrutura WebRTC (rooms, SFU, signaling)
- **SDK Frontend:** `@livekit/components-react`
- **SDK Agent:** `livekit-agents` (Python)
- **Token:** Gerado via Edge Function `create-livekit-token`

### Hedra Character-3

- **Função:** Avatar com lip-sync em tempo real
- **Status:** SUSPENSO desde Feb 27 2026 (serviço Hedra pausado). Sessões rodam em audio-only mode.
- **Desativação:** `avatar = None` em `agent/main.py` + `DISABLE_AVATAR=true` no Railway
- **Plugin:** `livekit.plugins.hedra`
- **Arquivo:** `agent/main.py`

### Supabase

- **PostgreSQL:** Armazenamento de dados (12+ tabelas)
- **Auth:** Autenticação via códigos de acesso
- **Edge Functions:** 5 funções serverless (Deno runtime)
- **Acesso do Agent:** REST via `aiohttp` com service role key

---

## 6. Edge Functions

| Função | Rota | Descrição |
|--------|------|-----------|
| `create-livekit-token` | `POST /create-livekit-token` | Gera token JWT para room LiveKit. Cria sessão no banco com `scenario_version`. Passa `target_duration_seconds` no metadata do agent. |
| `generate-feedback` | `POST /generate-feedback` | Gera feedback estruturado via Claude API. Recebe `session_id`, busca transcript e cenário, envia para Claude, salva score e critérios. |
| `generate-scenario` | `POST /generate-scenario` | Gera cenários com todos os 30+ campos estruturados. Inclui guardrails de perspectiva do avatar e correspondência voz-gênero. |
| `manage-scenario` | `POST /manage-scenario` | CRUD de cenários com versionamento automático (snapshot + incremento de versão a cada edição). |
| `suggest-scenario-fields` | `POST /suggest-scenario-fields` | Sugere campos individuais para cenários. Usado no formulário de criação/edição de cenários. |
| `get-api-metrics` | `GET /get-api-metrics` | Retorna métricas de uso de APIs agregadas. Suporta filtros por período, cenário e código de acesso. |

### Padrões Comuns

- Todas as funções incluem CORS handling
- Autenticação via `Authorization: Bearer <token>` ou service role key
- Respostas em JSON com `{ data, error }` pattern
- Edge Functions **não** fazem auto-deploy — deploy manual obrigatório via `supabase functions deploy` ou MCP

---

## 7. Arquitetura do Agent

### Pipeline de Processamento

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Áudio do     │────►│ Silero VAD   │────►│ OpenAI Realtime  │
│ Usuário      │     │ (0.15s min   │     │ (STT+LLM+TTS)   │
│ (WebRTC)     │     │  silence)    │     │                  │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                                    ▼               ▼               ▼
                           ┌──────────────┐ ┌────────────┐ ┌──────────────┐
                           │ Áudio de     │ │ Transcript │ │ Data Events  │
                           │ Resposta     │ │ (user +    │ │ (tokens,     │
                           │ (TTS)        │ │  agent)    │ │  duração)    │
                           └──────┬───────┘ └──────┬─────┘ └──────┬───────┘
                                  │                │              │
                                  ▼                ▼              ▼
                           ┌──────────────┐ ┌────────────┐ ┌──────────────┐
                           │ [Hedra]      │ │ Coaching   │ │ Metrics      │
                           │ Lip-sync     │ │ Pipeline   │ │ Collector    │
                           │ [DISABLED]   │ │            │ │              │
                           └──────────────┘ └──────┬─────┘ └──────────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                                    ▼              ▼              ▼
                           ┌─────────────────────────────────────────────┐
                           │ Coach Orchestrator (unified — ADR-006)      │
                           │ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
                           │ │ Keywords  │ │ Heuristic │ │ AI Coach  │  │
                           │ │ (SPIN)    │ │ (silence, │ │ (GPT-4o-  │  │
                           │ │ Zero cost │ │  hesitat.) │ │  mini)    │  │
                           │ └───────────┘ └───────────┘ └───────────┘  │
                           │ InjectionQueue + AgentState gating         │
                           └─────────────────────────────────────────────┘
```

### Estrutura de Prompts (`prompts.py`)

O sistema compila prompts a partir de campos estruturados do cenário via `build_agent_instructions()`. Cada seção é construída por uma função dedicada com fallbacks para cenários antigos.

```
build_agent_instructions(scenario, outcomes, difficulty_level)
│
├── 1. PAPEL (_build_role_section)
│   ├── character_name + character_role → identidade do avatar
│   ├── Regras anti-inversão de papéis (12 regras)
│   └── Fallback: "CLIENTE/PROSPECT" se sem character_name
│
├── 2. PERSONALIDADE (_build_personality_section)
│   ├── personality (texto livre)
│   ├── communication_style (formality, verbosity, patterns)
│   ├── typical_phrases (âncoras de personagem)
│   └── emotional_reactivity (triggers → reactions)
│
├── 3. CONTEXTO (_build_context_section)
│   ├── context (perspectiva do AVATAR, não do usuário)
│   ├── session_type → comportamento específico:
│   │   ├── cold_call: surpresa, desconfiança, ameaça desligar
│   │   ├── interview: candidato sendo avaliado
│   │   ├── negotiation: defende posição com dados
│   │   └── retention: cliente firme em cancelar
│   ├── market_context, backstory, user_objective
│   └── Fallback: context genérico se sem session_type
│
├── 4. INSTRUÇÕES (_build_instructions_section)
│   ├── Dificuldade 1-10 (fácil/médio/difícil)
│   ├── Objeções com timing e severidade
│   └── Outcomes com frases de encerramento
│
├── 5. FLUXO (_build_flow_section)
│   ├── phase_flow.phases[] (nome, duração, triggers)
│   ├── difficulty_escalation.stages[] (threshold, behavior)
│   ├── emotional_reactivity.triggers[] (event → reaction)
│   ├── success_condition, end_condition
│   └── Fallback: instruções baseadas em dificuldade se sem phase_flow
│
└── 6. SEGURANÇA (_build_safety_section)
    ├── opening_line (com defaults por session_type)
    ├── 12 regras de comportamento
    └── target_duration_seconds
```

### Coaching Unificado (`coach_orchestrator.py` — ADR-006)

Todas as camadas de coaching são gerenciadas por um único `CoachOrchestrator` com `InjectionQueue` (prioridade HIGH/MEDIUM/LOW) e gating por `AgentState` (mensagens enfileiradas durante SPEAKING).

| Tipo | Método | Custo | Frequência |
|------|--------|-------|------------|
| Keywords (SPIN) | Detecção síncrona de palavras-chave | Zero | Toda fala do usuário |
| Heurístico | Hesitação (respostas curtas) + silêncio (watchdog) | Zero | Proativo (background loop) |
| AI Coach | GPT-4o-mini streaming com contexto | ~$0.001/chamada | A cada 2-3 turnos |

### Análise Emocional

- **8 estados:** enthusiastic, happy, receptive, curious, neutral, hesitant, skeptical, frustrated
- **Método:** GPT-4o-mini analisa conversa completa de forma assíncrona
- **Latência:** ~1-2 segundos (trade-off aceitável para análise precisa)
- **Sem tags no áudio:** Removido em 2026-02-14 para evitar verbalização

### Ciclo de Vida da Sessão

```
1. CRIAÇÃO        → Edge Function cria sessão (com scenario_version) + gera token LiveKit
2. CONEXÃO        → Agent conecta à room, carrega cenário do Supabase
3. INICIALIZAÇÃO  → Compila prompt de campos estruturados, inicializa plugins
4. GREETING       → Agent envia opening_line do cenário (ou default por session_type)
5. CONVERSA       → Loop de turnos (duração selecionável, padrão 3 min)
                  → Coaching em tempo real (CoachOrchestrator unificado)
                  → Emotion analysis (async, GPT-4o-mini)
                  → Metrics collection (contínuo)
6. ENCERRAMENTO   → Transcript final salvo no Supabase
                  → Métricas de custo salvas
7. FEEDBACK       → Claude API gera avaliação estruturada
                  → Score, critérios com rubricas, evidências
8. CLEANUP        → Desconexão da room, liberação de recursos
```

---

## 8. Referências

| Documento | Caminho | Descrição |
|-----------|---------|-----------|
| Architecture Decision Records | `docs/adr/` | Decisões arquiteturais documentadas |
| Agent Instructions | `AGENTS.md` | Instruções para agentes AI interagindo com o projeto |
| Project Context | `CLAUDE.md` | Contexto completo para Claude Code |
| Database Architecture | `docs/database-architecture-v2.1.md` | Arquitetura de banco v2.1 (12+ tabelas) |
| Product Requirements | `docs/prd/` | 9 documentos de requisitos de produto |
| Bug Tracking | `BUGS.md` | Registro de bugs identificados |
| Changelog | `CHANGELOG.md` | Histórico de mudanças |
| Benchmark Suite | `tests/benchmark/` | Suite de comparação de stacks |

### Links Externos

| Recurso | URL |
|---------|-----|
| LiveKit Agents SDK | https://docs.livekit.io/agents |
| OpenAI Realtime API | https://platform.openai.com/docs/guides/realtime |
| Hedra Character-3 | https://www.hedra.com/docs |
| Claude API (Anthropic) | https://docs.anthropic.com |
| Supabase | https://supabase.com/docs |
| Vercel | https://vercel.com/docs |
| Railway | https://docs.railway.com |
