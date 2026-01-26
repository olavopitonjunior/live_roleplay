# Live Roleplay - Contexto do Projeto

Plataforma de treinamento de vendas com roleplay AI em tempo real. Usuários praticam negociação com um avatar AI que mantém personagem e contexto.

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (PWA)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Auth)
- **Agent**: Python 3.11+ com LiveKit Agents SDK
- **AI**: Google Gemini Live API (conversação) + Claude (feedback)
- **Avatar**: Simli API (lip-sync em tempo real)

## Estrutura do Projeto

```
live_roleplay/
├── frontend/          # React app (PWA)
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # useAuth, useSession, useFeedback, useScenarios
│       └── lib/          # Supabase client
├── agent/             # Python agent
│   ├── main.py        # Orquestração LiveKit + Gemini + Simli
│   └── prompts.py     # Construção de prompts dinâmicos
└── supabase/
    └── functions/     # Edge Functions (Deno)
        ├── create-livekit-token/
        └── generate-feedback/
```

## APIs Externas

Use `/api-docs` para consultar documentação detalhada de qualquer API.

| API | Arquivo Principal | Documentação |
|-----|-------------------|--------------|
| LiveKit | `agent/main.py` | https://docs.livekit.io/agents |
| Google Gemini Live | `agent/main.py` | https://ai.google.dev/gemini-api/docs |
| Simli | `agent/main.py` | https://docs.simli.com |
| Anthropic/Claude | `supabase/functions/generate-feedback/` | https://docs.anthropic.com |
| Supabase | `frontend/src/hooks/`, Edge Functions | https://supabase.com/docs |

## Padrões de Código

### Frontend
- Hooks customizados em `src/hooks/` para lógica de negócio
- Supabase SDK para todas as operações de banco
- LiveKit React SDK para WebRTC

### Agent (Python)
- `AgentSession` com plugins (google, simli, silero)
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
- `GOOGLE_API_KEY`
- `SIMLI_API_KEY`, `SIMLI_FACE_ID`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

## Comandos Úteis

```bash
# Frontend
cd frontend && npm run dev

# Agent
cd agent && python main.py dev

# Supabase local
supabase start
supabase functions serve
```

## Fluxo Principal

1. Usuário entra com código de acesso
2. Seleciona cenário de treinamento
3. Frontend solicita token LiveKit (Edge Function)
4. Conecta à room WebRTC
5. Agent inicia com Gemini + Simli
6. Sessão de roleplay (max 3 min)
7. Transcript salvo, feedback gerado via Claude
8. Usuário visualiza score e critérios
