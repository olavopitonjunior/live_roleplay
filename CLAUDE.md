# Live Roleplay - Contexto do Projeto

Plataforma de treinamento de vendas com roleplay AI em tempo real. Usuários praticam negociação com um avatar AI que mantém personagem e contexto.

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (PWA)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Agent**: Python 3.11+ com LiveKit Agents SDK
- **AI**: OpenAI Realtime API (gpt-4o-realtime-preview) + GPT-4o-mini (analysis) + Claude (feedback)
- **Avatar**: Hedra Character-3 (lip-sync em tempo real)

## Estrutura do Projeto

```
live_roleplay/
├── frontend/          # React app (PWA)
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # useAuth, useSession, useFeedback, useScenarios
│       └── lib/          # Supabase client
├── agent/             # Python agent
│   ├── main.py        # Orquestração LiveKit + OpenAI Realtime + Hedra
│   ├── prompts.py     # Construção de prompts dinâmicos
│   ├── conversation_coach.py  # Coaching layer 2 (silence/hesitation)
│   ├── ai_coach.py    # GPT-4o-mini coaching suggestions em tempo real
│   ├── emotion_analyzer.py  # GPT-4o-mini emotion detection
│   └── metrics_collector.py # Coleta de métricas da sessão
├── supabase/
│   └── functions/     # Edge Functions (Deno)
│       ├── create-livekit-token/
│       ├── generate-feedback/
│       ├── generate-scenario/
│       ├── suggest-scenario-fields/
│       └── get-api-metrics/
└── tests/             # Playwright E2E tests (26 specs)
```

## APIs Externas

Use `/api-docs` para consultar documentação detalhada de qualquer API.

| API | Arquivo Principal | Documentação |
|-----|-------------------|--------------|
| LiveKit | `agent/main.py` | https://docs.livekit.io/agents |
| OpenAI Realtime | `agent/main.py` | https://platform.openai.com/docs/guides/realtime |
| Hedra | `agent/main.py` | https://www.hedra.com/docs |
| Anthropic/Claude | `supabase/functions/generate-feedback/` | https://docs.anthropic.com |
| Supabase | `frontend/src/hooks/`, Edge Functions | https://supabase.com/docs |

## Padrões de Código

### Frontend
- Hooks customizados em `src/hooks/` para lógica de negócio
- Supabase SDK para todas as operações de banco
- LiveKit React SDK para WebRTC

### Agent (Python)
- `AgentSession` com plugins (openai, hedra, silero)
- Voice mode: `gpt-4o-realtime-preview` com text+audio output
- Text analysis: `gpt-4o-mini` para emotion analyzer + AI coach
- Event handlers para captura de transcript
- aiohttp para chamadas REST ao Supabase

### Edge Functions (Deno/TypeScript)
- CORS handling em todas as funções
- Service role key para operações privilegiadas

## Variáveis de Ambiente

### Frontend (.env)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_LIVEKIT_URL`

### Agent (.env)
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `OPENAI_API_KEY`
- `HEDRA_API_KEY`, `HEDRA_AVATAR_ID`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Comandos Úteis

```bash
# Frontend (porta 5174)
cd frontend && npm run dev

# Agent
cd agent && python main.py dev

# Supabase local
supabase start
supabase functions serve

# E2E Tests
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:headed
```

## Fluxo Principal

1. Usuário entra com código de acesso
2. Seleciona cenário de treinamento
3. Frontend solicita token LiveKit (Edge Function)
4. Conecta à room WebRTC
5. Agent inicia com OpenAI Realtime + Hedra
6. Sessão de roleplay (max 3 min)
7. Transcript salvo, feedback gerado via Claude
8. Usuário visualiza score e critérios

## Deployment Checklist

Ao fazer mudanças que afetam múltiplos serviços, verificar TODOS os deploys:

| Serviço | Deploy Method | Auto-deploy? |
|---------|--------------|--------------|
| **Agent (Railway)** | `railway up` ou git push | Sim (git push) |
| **Frontend (Vercel)** | `git push` para `main` | Sim (git push) |
| **Edge Functions (Supabase)** | MCP `deploy_edge_function` ou `supabase functions deploy` | **NÃO** — deploy manual obrigatório |
| **DB Migrations (Supabase)** | MCP `apply_migration` ou `supabase db push` | **NÃO** — deploy manual obrigatório |

**REGRA CRÍTICA**: Ao renomear colunas no DB, SEMPRE redeploy Edge Functions que referenciam essas colunas. Edge Functions deployadas no Supabase NÃO se atualizam automaticamente — é preciso deploy manual via MCP ou CLI.
