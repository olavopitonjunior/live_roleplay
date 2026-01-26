# Skill: Consulta de Documentação de APIs

Esta skill consulta e resume a documentação oficial das APIs externas usadas no projeto Live Roleplay.

## APIs do Projeto

O projeto integra as seguintes APIs externas:

| API | Uso no Projeto | Documentação Oficial |
|-----|----------------|---------------------|
| **LiveKit** | WebRTC, rooms, tokens | https://docs.livekit.io |
| **LiveKit Agents (Python)** | Orquestração do agente | https://docs.livekit.io/agents |
| **Google Gemini Live API** | Conversação em tempo real (STT+LLM+TTS) | https://ai.google.dev/gemini-api/docs |
| **Simli** | Avatar com lip-sync | https://docs.simli.com |
| **Anthropic/Claude** | Geração de feedback | https://docs.anthropic.com |
| **Supabase** | Database, Auth, Edge Functions | https://supabase.com/docs |

## Instruções

Quando o usuário invocar `/api-docs`, você deve:

1. **Identificar qual API** o usuário quer consultar (pergunte se não for claro)

2. **Buscar informação atualizada** usando WebFetch ou WebSearch na documentação oficial:
   - LiveKit: https://docs.livekit.io
   - LiveKit Agents: https://docs.livekit.io/agents
   - Gemini: https://ai.google.dev/gemini-api/docs
   - Simli: https://docs.simli.com
   - Anthropic: https://docs.anthropic.com/en/docs
   - Supabase: https://supabase.com/docs

3. **Retornar um resumo estruturado** com:
   - Endpoint/método relevante
   - Parâmetros obrigatórios e opcionais
   - Autenticação necessária
   - Rate limits (se aplicável)
   - Exemplo de uso
   - Erros comuns

## Consultas Comuns

### LiveKit
- Criação de tokens JWT
- Configuração de rooms
- Eventos de participantes
- Tracks de áudio/vídeo

### LiveKit Agents (Python)
- AgentSession e ciclo de vida
- Plugins (google, simli, silero)
- Event handlers (on_user_input_transcribed, on_agent_speech_committed)
- VAD (Voice Activity Detection)

### Google Gemini Live API
- Modelos disponíveis (gemini-2.0-flash-live-001, etc.)
- Configuração de voz e temperatura
- Streaming de áudio
- System instructions

### Simli
- Configuração de face_id
- AvatarSession
- Sincronização labial
- Qualidade de vídeo

### Anthropic/Claude
- Messages API
- Modelos (claude-sonnet-4-20250514, etc.)
- Max tokens e limites
- Structured output (JSON)

### Supabase
- REST API e SDK
- Row Level Security (RLS)
- Edge Functions (Deno)
- Realtime subscriptions

## Exemplo de Uso

Usuário: `/api-docs como configurar voice activity detection no livekit agents?`

Resposta esperada: Buscar na documentação do LiveKit Agents sobre Silero VAD, mostrar configuração, parâmetros e exemplo de código.

## Contexto do Projeto

Arquivos relevantes para entender o uso das APIs:
- `agent/main.py` - Integração com LiveKit Agents, Gemini, Simli
- `agent/prompts.py` - Prompts para Gemini e Claude
- `frontend/src/hooks/useSession.ts` - Chamadas ao Supabase
- `supabase/functions/create-livekit-token/` - Geração de tokens
- `supabase/functions/generate-feedback/` - Chamada à API do Claude
