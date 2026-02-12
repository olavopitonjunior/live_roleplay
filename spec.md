# Agent Roleplay - Spec (Technical Specification)

## 1. Visão Técnica

Aplicação PWA com arquitetura baseada em LiveKit Agents para orquestração da sessão conversacional:

**Frontend (React PWA)**
Interface única para web e mobile. Conecta à sala LiveKit para receber áudio e vídeo do avatar. Comunica com Supabase para autenticação, cenários e histórico.

**Backend (Supabase)**
Armazena cenários configurados, sessões e feedbacks. Edge Functions processam a geração de feedback pós-sessão via Claude API.

**Agente Conversacional (LiveKit Agents + Gemini + Hedra)**
- LiveKit Agents orquestra a sessão e gerencia a comunicação WebRTC
- Google Gemini Live API processa a conversa (voice-to-voice)
- Hedra gera o avatar visual com lip-sync sincronizado ao áudio

**Geração de Feedback (Claude API)**
Ao final da sessão, a transcrição é enviada para Claude API que avalia contra os critérios configurados no cenário.

**Fluxo simplificado:**
1. Usuário autentica via código de acesso
2. Escolhe cenário
3. Frontend conecta à sala LiveKit
4. LiveKit Agents inicia sessão com contexto do cenário
5. Conversa acontece em tempo real (voz + avatar)
6. Usuário encerra sessão
7. Transcrição vai para Edge Function
8. Claude analisa e gera feedback
9. Feedback salvo no Supabase e exibido ao usuário

---

## 2. Stack

**Frontend**
- React 18
- Vite (build tool)
- PWA com Workbox
- LiveKit Client SDK (@livekit/components-react)
- Supabase Client (@supabase/supabase-js)
- Tailwind CSS

**Backend**
- Supabase (PostgreSQL + Auth + Edge Functions)
- Deno (runtime das Edge Functions)

**Agente**
- Python 3.11+
- LiveKit Agents SDK (livekit-agents)
- Plugin Google (livekit-plugins-google)
- Plugin ElevenLabs (livekit-plugins-elevenlabs)
- Plugin Hedra (livekit-plugins-hedra)

**APIs Externas**
- LiveKit Cloud (salas e comunicação WebRTC)
- Google Gemini Realtime API (STT + LLM)
- ElevenLabs TTS (síntese de voz - half-cascade)
- Hedra API (avatar)
- Claude API (geração de feedback)

**Infraestrutura**
- Vercel ou Cloudflare Pages (frontend)
- Supabase Cloud (backend)
- LiveKit Cloud (agente)

---

## 3. Estrutura do Projeto

```
agent-roleplay/
├── frontend/
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   └── AccessCodeForm.tsx
│   │   │   ├── Scenarios/
│   │   │   │   ├── ScenarioList.tsx
│   │   │   │   ├── ScenarioCard.tsx
│   │   │   │   └── ScenarioForm.tsx
│   │   │   ├── Session/
│   │   │   │   ├── SessionRoom.tsx
│   │   │   │   ├── AvatarView.tsx
│   │   │   │   └── SessionControls.tsx
│   │   │   ├── Feedback/
│   │   │   │   ├── FeedbackView.tsx
│   │   │   │   └── CriteriaChecklist.tsx
│   │   │   └── History/
│   │   │       ├── HistoryList.tsx
│   │   │       └── HistoryItem.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Session.tsx
│   │   │   ├── Feedback.tsx
│   │   │   ├── History.tsx
│   │   │   └── Admin/
│   │   │       └── Scenarios.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useScenarios.ts
│   │   │   ├── useSession.ts
│   │   │   └── useFeedback.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts
│   │   │   └── livekit.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── agent/
│   ├── main.py
│   ├── prompts.py
│   ├── requirements.txt
│   └── .env.example
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       ├── generate-feedback/
│       │   └── index.ts
│       └── create-livekit-token/
│           └── index.ts
│
└── README.md
```

---

## 4. Modelos de Dados

### access_codes
Códigos de acesso para autenticação simples.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| code | varchar(20) | Código único de acesso |
| role | varchar(20) | 'admin' ou 'user' |
| is_active | boolean | Se o código está ativo |
| created_at | timestamp | Data de criação |

### scenarios
Cenários de treinamento configurados.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| title | varchar(100) | Nome do cenário |
| context | text | Descrição do contexto da conversa |
| avatar_profile | text | Perfil/personalidade do avatar |
| objections | jsonb | Lista de objeções possíveis |
| evaluation_criteria | jsonb | Lista de critérios de avaliação |
| is_active | boolean | Se o cenário está disponível |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Data de atualização |

**Estrutura de objections:**
```json
[
  { "id": "obj_1", "description": "Preço alto" },
  { "id": "obj_2", "description": "Dúvidas sobre cobertura" }
]
```

**Estrutura de evaluation_criteria:**
```json
[
  { "id": "crit_1", "description": "Identificou a preocupação principal do cliente" },
  { "id": "crit_2", "description": "Respondeu a objeção de preço" }
]
```

### sessions
Sessões de treino realizadas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| access_code_id | uuid | FK para access_codes |
| scenario_id | uuid | FK para scenarios |
| livekit_room_name | varchar(100) | Nome da sala no LiveKit |
| transcript | text | Transcrição da conversa |
| started_at | timestamp | Início da sessão |
| ended_at | timestamp | Fim da sessão |
| duration_seconds | integer | Duração em segundos |
| status | varchar(20) | 'active', 'completed', 'cancelled' |

### feedbacks
Avaliações geradas após cada sessão.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK para sessions |
| criteria_results | jsonb | Resultado por critério |
| summary | text | Resumo geral da performance |
| score | integer | Pontuação (0-100) |
| created_at | timestamp | Data de criação |

**Estrutura de criteria_results:**
```json
[
  { "criteria_id": "crit_1", "passed": true, "observation": "Identificou corretamente" },
  { "criteria_id": "crit_2", "passed": false, "observation": "Não abordou o tema" }
]
```

---

## 5. Integrações

### LiveKit Cloud
**Propósito:** Gerenciar salas e comunicação WebRTC em tempo real.

**Configuração necessária:**
- LIVEKIT_URL (wss://...)
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

**Uso no frontend:**
- Conectar à sala via token JWT
- Receber tracks de áudio e vídeo do avatar
- Enviar áudio do usuário

**Uso no agente:**
- LiveKit Agents SDK gerencia conexão
- Publica áudio/vídeo via plugins

### Google Gemini Realtime API
**Propósito:** Processar conversa em tempo real (STT + LLM).

**Configuração necessária:**
- GOOGLE_API_KEY

**Uso no agente:**
- Plugin livekit-plugins-google
- Modelo: gemini-2.5-flash-native-audio-preview
- Modo half-cascade: `modalities=[Modality.TEXT]` + ElevenLabs TTS
- Instructions: montado dinamicamente com contexto do cenário

### ElevenLabs TTS
**Propósito:** Síntese de voz de baixa latência (half-cascade mode).

**Configuração necessária (opcional):**
- ELEVEN_API_KEY
- ELEVEN_VOICE_ID

**Uso no agente:**
- Plugin livekit-plugins-elevenlabs
- Modelo: eleven_flash_v2_5 (~75ms TTFB)
- Se não configurado, fallback para Gemini voice-to-voice nativo

### Hedra API
**Propósito:** Gerar avatar visual com lip-sync (Character-3).

**Configuração necessária:**
- HEDRA_API_KEY
- HEDRA_AVATAR_ID (avatar escolhido)

**Uso no agente:**
- Plugin livekit-plugins-hedra
- Recebe áudio do Gemini e gera vídeo sincronizado
- Publica vídeo na sala LiveKit

### Claude API
**Propósito:** Analisar transcrição e gerar feedback.

**Configuração necessária:**
- ANTHROPIC_API_KEY

**Uso na Edge Function:**
- Recebe transcrição + critérios do cenário
- Retorna avaliação estruturada em JSON

---

## 6. Telas e Componentes

### Tela: Login
**Rota:** /

**Componentes:**
- AccessCodeForm: Campo de input para código de acesso + botão entrar

**Comportamento:**
- Valida código no Supabase
- Redireciona para Home se válido
- Exibe erro se inválido

### Tela: Home
**Rota:** /home

**Componentes:**
- ScenarioList: Grid de cenários disponíveis
- ScenarioCard: Card com título e breve descrição do cenário

**Comportamento:**
- Lista cenários ativos
- Clique no card inicia sessão
- Link para histórico no header

### Tela: Session
**Rota:** /session/:scenarioId

**Componentes:**
- SessionRoom: Container principal da sessão LiveKit
- AvatarView: Exibe vídeo do avatar
- SessionControls: Botão de encerrar sessão, indicador de tempo

**Comportamento:**
- Conecta à sala LiveKit ao montar
- Exibe avatar em tela cheia
- Timer mostrando tempo decorrido
- Botão para encerrar sessão
- Encerra automaticamente aos 3 minutos
- Redireciona para Feedback ao encerrar

### Tela: Feedback
**Rota:** /feedback/:sessionId

**Componentes:**
- FeedbackView: Container do feedback
- CriteriaChecklist: Lista de critérios com status (passou/não passou)

**Comportamento:**
- Exibe loading enquanto feedback é gerado
- Mostra checklist com resultado por critério
- Mostra resumo geral e pontuação
- Botões: "Novo treino" (volta para Home), "Ver histórico"

### Tela: History
**Rota:** /history

**Componentes:**
- HistoryList: Lista de sessões anteriores
- HistoryItem: Card com cenário, data, pontuação

**Comportamento:**
- Lista sessões do usuário ordenadas por data
- Clique abre detalhes do feedback

### Tela: Admin/Scenarios
**Rota:** /admin/scenarios

**Componentes:**
- ScenarioList: Lista de todos os cenários
- ScenarioForm: Formulário de criação/edição

**Comportamento:**
- CRUD de cenários
- Campos: título, contexto, perfil do avatar, objeções, critérios
- Apenas acessível com código de admin

---

## 7. Endpoints

### Supabase Edge Functions

**POST /functions/v1/create-livekit-token**
Gera token JWT para conectar à sala LiveKit.

Request:
```json
{
  "scenario_id": "uuid",
  "access_code": "string"
}
```

Response:
```json
{
  "token": "jwt_token",
  "room_name": "room_uuid",
  "session_id": "uuid"
}
```

**POST /functions/v1/generate-feedback**
Gera feedback da sessão via Claude API.

Request:
```json
{
  "session_id": "uuid"
}
```

Response:
```json
{
  "feedback_id": "uuid",
  "criteria_results": [...],
  "summary": "string",
  "score": 85
}
```

### Supabase Database (via client SDK)

**Scenarios**
- GET: Listar cenários ativos
- GET by ID: Detalhes do cenário
- POST: Criar cenário (admin)
- PATCH: Atualizar cenário (admin)
- DELETE: Desativar cenário (admin)

**Sessions**
- GET: Listar sessões do usuário
- GET by ID: Detalhes da sessão
- PATCH: Atualizar status/transcrição

**Feedbacks**
- GET by session_id: Feedback da sessão

---

## 8. Regras de Negócio

### Autenticação
- Código de acesso deve existir e estar ativo
- Código define role (admin ou user)
- Sessão expira após 24 horas de inatividade
- Admin acessa todas as funcionalidades
- User acessa apenas treino e histórico próprio

### Sessão de Treino
- Duração máxima: 180 segundos (3 minutos)
- Usuário pode encerrar a qualquer momento
- Sessão inicia quando usuário conecta à sala LiveKit
- Sessão encerra quando:
  - Usuário clica em encerrar
  - Tempo máximo é atingido
  - Conexão é perdida por mais de 30 segundos
- Transcrição é salva ao final da sessão

### Montagem do Prompt do Agente
O agente recebe instructions dinâmicas baseadas no cenário:

```
Você é um personagem em um cenário de treinamento.

CONTEXTO:
{scenario.context}

SEU PERFIL:
{scenario.avatar_profile}

OBJEÇÕES QUE VOCÊ DEVE APRESENTAR:
{scenario.objections}

REGRAS:
- Mantenha-se no personagem durante toda a conversa
- Apresente as objeções de forma natural, não todas de uma vez
- Reaja às respostas do usuário de forma realista
- Se o usuário responder bem uma objeção, siga em frente
- Se responder mal, insista ou demonstre insatisfação
- A conversa deve durar no máximo 3 minutos
```

### Geração de Feedback
Prompt para Claude API:

```
Analise a transcrição de uma sessão de treinamento e avalie o desempenho do usuário.

CONTEXTO DO CENÁRIO:
{scenario.context}

CRITÉRIOS DE AVALIAÇÃO:
{scenario.evaluation_criteria}

TRANSCRIÇÃO:
{session.transcript}

Retorne um JSON com:
1. criteria_results: array com cada critério, se passou (boolean) e observação
2. summary: resumo geral do desempenho em 2-3 frases
3. score: pontuação de 0 a 100

Seja específico nas observações, citando trechos da conversa quando relevante.
```

### Cálculo de Score
- Cada critério atendido = 100 / total_criterios pontos
- Score final = soma dos pontos dos critérios atendidos
- Arredondado para inteiro

---

## 9. Sequência de Implementação

### Fase 1: Fundação
1. Criar projeto Supabase e configurar schema
2. Criar projeto frontend com Vite + React + Tailwind
3. Configurar PWA básico (manifest, service worker)
4. Implementar autenticação por código de acesso
5. Criar tela de login funcional

**Entregável:** Usuário consegue fazer login com código

### Fase 2: Cenários
1. Criar CRUD de cenários no Supabase
2. Implementar tela de listagem de cenários
3. Implementar formulário de criação/edição (admin)
4. Popular 3 cenários de teste

**Entregável:** Admin consegue criar cenários, usuário consegue visualizar lista

### Fase 3: Agente
1. Criar projeto do agente Python
2. Configurar LiveKit Agents + Gemini + Hedra
3. Implementar montagem dinâmica do prompt
4. Testar conversa localmente

**Entregável:** Agente conversa com contexto do cenário

### Fase 4: Sessão
1. Criar Edge Function para gerar token LiveKit
2. Implementar tela de sessão com LiveKit Client
3. Integrar vídeo do avatar
4. Implementar controles (encerrar, timer)
5. Salvar transcrição ao final

**Entregável:** Usuário consegue completar uma sessão de treino

### Fase 5: Feedback
1. Criar Edge Function para gerar feedback via Claude
2. Implementar tela de feedback
3. Exibir checklist e resumo

**Entregável:** Usuário recebe feedback após sessão

### Fase 6: Histórico e Polish
1. Implementar tela de histórico
2. Ajustes de UX/UI
3. Testes em mobile
4. Otimizações de performance

**Entregável:** MVP completo para validação
