# Pipecat PoC Agent

PoC paralelo ao agent de producao (`agent/`). Testa stack modular como alternativa ao OpenAI Realtime monolitico. Referencia: [ADR-005](../docs/adr/005-pipecat-poc.md).

## Stack

| Componente | Servico | Modelo/Versao |
|------------|---------|---------------|
| STT | Deepgram | Nova-3 (pt-BR) |
| LLM | Google Gemini | 2.5 Flash |
| TTS | ElevenLabs | Flash v2.5 |
| Avatar | Simli | Trinity |
| Transport | LiveKit | WebRTC |
| VAD | Silero | Local |

## Arquitetura

```
Frontend (React) <--WebRTC--> LiveKit Cloud <--WebRTC--> agent-pipecat/
                                                          |-- Deepgram STT
                                                          |-- Gemini 2.5 Flash
                                                          |-- ElevenLabs TTS
                                                          |-- Simli Avatar
                                                          +-- Pipecat Flows (opcional)
```

## Pipeline

```
transport.input() -> STT -> TranscriptProc -> context.user() -> LLM ->
  AssistantTranscriptProc -> EmotionProc -> TTS -> [SimliVideoService] -> transport.output()
```

Simli recebe `TTSAudioRawFrame`, envia audio ao servidor Simli via WebRTC interno, recebe video de volta e pusha `OutputImageRawFrame` downstream para o LiveKit transport publicar.

## Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `main.py` | Entry point, pipeline setup, event handlers, Simli integration |
| `processors.py` | TranscriptProcessor, AssistantTranscriptProcessor, EmotionProcessor |
| `supabase_client.py` | REST client (fetch scenario, save transcript) |
| `flows/retention_flow.py` | FSM para cenario de retencao (5 estados) |
| `Dockerfile` | Container para deploy |

## Modulos Compartilhados (agent/)

Importados via `sys.path.insert` para reutilizar codigo:

- `prompts.py` — `build_agent_instructions()`
- `emotion_analyzer.py` — GPT-4o-mini emotion detection
- `ai_coach.py` — GPT-4o-mini coaching suggestions

## Uso

```bash
# Instalar dependencias
pip install -r requirements.txt

# Com avatar (padrao):
python main.py --scenario-id <uuid>

# Sem avatar (audio-only, para comparar latencia):
python main.py --scenario-id <uuid> --no-avatar

# Com Pipecat Flows (FSM estruturada):
python main.py --scenario-id <uuid> --use-flows

# Modo explicito (token proprio):
python main.py --room-url wss://... --token <jwt> --room-name <name> --scenario-id <uuid>
```

No modo self-service (sem `--token`), o agent gera tokens automaticamente e imprime a URL de teste para conectar via https://meet.livekit.io.

## Variaveis de Ambiente

Ver `.env.example` para a lista completa. Principais:

| Variavel | Descricao |
|----------|-----------|
| `LIVEKIT_URL` | URL do LiveKit Cloud |
| `DEEPGRAM_API_KEY` | Deepgram STT |
| `GOOGLE_API_KEY` | Gemini 2.5 Flash |
| `ELEVEN_API_KEY` | ElevenLabs TTS |
| `SIMLI_API_KEY` | Simli avatar |
| `SIMLI_FACE_ID` | Simli face ID |
| `SUPABASE_URL` | Supabase project |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |

## Comparacao com Agent de Producao

| Aspecto | Producao (`agent/`) | PoC (`agent-pipecat/`) |
|---------|--------------------|-----------------------|
| Framework | LiveKit Agents SDK | Pipecat |
| LLM | OpenAI Realtime (audio nativo) | Gemini 2.5 Flash (texto) |
| STT | Integrado no Realtime | Deepgram Nova-3 |
| TTS | Integrado no Realtime | ElevenLabs Flash v2.5 |
| Avatar | Hedra Character-3 | Simli Trinity |
| Pipeline | Monolitico | Modular (swap componentes) |
| Deploy | Railway | TBD |

## Status

- [x] Pipeline audio (STT -> LLM -> TTS)
- [x] Transcript capture
- [x] Emotion processor (placeholder)
- [x] Pipecat Flows (retention scenario)
- [x] Self-service test mode (auto-token)
- [x] Simli avatar integration
- [ ] Metricas de latencia comparativa
- [ ] Deploy Railway (Dockerfile pronto)
