# ADR-005: PoC com Pipecat Framework

## Status

**Em andamento** — Data: 2026-02-17, atualizado 2026-02-24

## Contexto

O agent atual (`agent/main.py`) utiliza o **LiveKit Agents SDK** como framework de orquestracao para o pipeline de voz. O codigo acumulou ~1800 linhas com logica de:

- Pipeline de voz (OpenAI Realtime via LiveKit plugin)
- Avatar (Hedra Character-3)
- Coaching em tempo real (conversation_coach.py, ai_coach.py)
- Analise de emocoes (emotion_analyzer.py)
- Coleta de metricas (metrics_collector.py)
- Gerenciamento de sessao e transcript

Uma migracao direta deste codebase para um pipeline modular (ver [ADR-002](002-stack-modular.md)) e arriscada: qualquer bug na migracao afeta producao imediatamente.

O **Pipecat** e um framework open-source de pipelines de voz AI que oferece:

- **Arquitetura baseada em frames**: Processamento de audio/texto como frames em pipeline, similar a pipes Unix
- **Pipecat Flows**: Maquina de estados finitos (FSM) para gerenciar fluxos de conversa, ideal para cenarios de roleplay estruturados
- **Suporte a LiveKit Transport**: Usa LiveKit como camada de transporte WebRTC, permitindo reutilizar o frontend existente sem alteracoes
- **Integracao nativa**: Plugins para Deepgram, Google Gemini, ElevenLabs, Cartesia e outros

## Decisao

Criar um projeto paralelo **`agent-pipecat/`** como PoC (Proof of Concept) que implementa:

1. **Pipeline modular**: Deepgram Nova-3 (STT) -> Gemini 2.5 Flash (LLM texto) -> ElevenLabs Flash v2.5 (TTS)
2. **Avatar**: TalkingHead.js renderizado no browser (ver [ADR-003](003-avatar-talkinghead.md))
3. **1 cenario como Pipecat Flow**: Converter um cenario de treinamento existente para FSM do Pipecat Flows, validando a abordagem para gerenciamento de cenarios
4. **LiveKit Transport**: Usar o plugin LiveKit do Pipecat para que o frontend existente funcione com ambos os agents (atual e PoC) sem modificacoes

### Arquitetura do PoC

```
Frontend (React)          LiveKit Cloud          agent-pipecat/
[Existente]  <--WebRTC-->  [Room]  <--WebRTC-->  [Pipecat Pipeline]
                                                    |
                                                    +-- Deepgram STT
                                                    +-- Gemini 2.5 Flash
                                                    +-- ElevenLabs TTS
                                                    +-- TalkingHead.js (via data channel)
```

### Criterios de Sucesso do PoC

| Criterio | Meta | Metodo de Validacao |
|----------|------|-------------------|
| Latencia total | <800ms | Medicao end-to-end (audio in -> audio out) |
| Qualidade STT PT-BR | >90% acuracia | Comparacao com transcricao manual |
| Naturalidade TTS | Aprovacao subjetiva | Teste com 5 usuarios |
| Custo por sessao | <$0.50 | Calculo baseado em uso real |
| Pipecat Flow funcional | 1 cenario completo | Teste end-to-end do cenario |

## Alternativas Consideradas

### Opcao A — Migracao direta do agent atual

- Reescrever `agent/main.py` (~1800 linhas) diretamente para usar pipeline modular
- **Rejeitado**: Risco muito alto. Qualquer bug afeta producao imediatamente. Impossivel comparar lado a lado com pipeline atual. Tempo de migracao estimado em 2-3 semanas sem rede de seguranca

### Opcao B — Migracao incremental do agent atual

- Trocar componentes um a um (primeiro STT, depois LLM, depois TTS) dentro do LiveKit Agents SDK
- **Rejeitado**: Complexidade de manter logica mista (parte OpenAI Realtime, parte modular) no mesmo codebase. LiveKit Agents SDK nao foi projetado para pipeline modular com componentes de diferentes provedores. Nao valida Pipecat Flows como alternativa para gerenciamento de cenarios

### Opcao C — PoC com Pipecat em projeto paralelo (escolhida)

- Projeto separado `agent-pipecat/` que roda em paralelo ao agent atual
- Mesmo frontend, mesmo LiveKit Cloud, agent diferente
- Permite comparacao A/B controlada
- Valida Pipecat Flows para cenarios
- Zero risco para producao

## Consequencias

### Positivas

- **Zero risco para producao**: O agent atual continua rodando normalmente. O PoC e um projeto completamente separado que nao interfere no codebase existente
- **Comparacao lado a lado**: Possibilidade de conectar o mesmo frontend a qualquer um dos agents (basta mudar a room no LiveKit), permitindo comparacao direta de latencia, qualidade e custo
- **Validacao de Pipecat Flows**: Testar FSM do Pipecat como alternativa para gerenciamento de cenarios de roleplay, potencialmente simplificando a logica de prompts e outcomes
- **Aprendizado isolado**: Equipe pode aprender Pipecat sem pressao de producao, documentando armadilhas e melhores praticas antes de qualquer migracao
- **Base para migracao futura**: Se o PoC for bem-sucedido, o codigo ja serve como base para o novo agent, reduzindo tempo de migracao

### Negativas

- **Esforco de desenvolvimento**: Estimativa de 1-2 semanas para implementar o PoC com 1 cenario funcional. Tempo que poderia ser investido em features do produto
- **Dois codebases temporariamente**: Necessidade de manter `agent/` e `agent-pipecat/` durante o periodo de avaliacao, duplicando parte do esforco de manutencao
- **Resultados do PoC podem nao ser conclusivos**: Um unico cenario pode nao representar a complexidade total dos cenarios de producao

### Riscos

- **Maturidade do Pipecat (< 1.0)**: Pipecat ainda nao atingiu versao 1.0. API pode mudar entre versoes, documentacao pode ser incompleta, e bugs inesperados podem surgir
- **Pipecat Flows e recente**: O modulo de Flows e uma adicao relativamente nova ao Pipecat. Pode nao cobrir todos os casos de uso necessarios para cenarios complexos de roleplay
- **Diferenca de ambiente**: O PoC roda em ambiente de desenvolvimento; resultados de latencia e estabilidade podem diferir em producao (especialmente considerando [ADR-004](004-aws-sp-infra.md))

## Progresso do PoC (2026-02-19 a 2026-02-20)

### Fase 1 — Pipeline base (completo, commit `81b9b18`)

Implementacao inicial do pipeline Pipecat com Simli avatar:

- **STT**: Deepgram Nova-3 (pt-BR, endpointing 300ms, utterance_end 1500ms)
- **LLM**: Gemini 2.5 Flash via `GoogleLLMService`
- **TTS**: ElevenLabs Flash v2.5 (language=pt, stability=0.5, similarity_boost=0.75)
- **Avatar**: Simli 2D lip-sync (256x256, qualidade limitada)
- **Transport**: LiveKit WebRTC
- **Resultado**: Pipeline funcional, LLM TTFB ~0.77s, avatar com lip-sync desincronizado

### Fase 2-4 — Expansao multi-provider (completo, commit `905f35c`)

Expansao para suportar provedores alternativos com swap via CLI flags:

#### Provider Presets (`--provider-preset`)

| Preset | STT | LLM | TTS |
|--------|-----|-----|-----|
| `default` | Deepgram Nova-3 | Gemini 2.5 Flash | ElevenLabs Flash v2.5 |
| `aws-full` | AWS Transcribe | Bedrock Claude 3.5 Sonnet | AWS Polly Camila (neural) |
| `aws-polly` | Deepgram | Gemini | Polly Camila |
| `aws-bedrock` | Deepgram | Bedrock Claude | ElevenLabs |
| `nova-sonic` | Amazon Nova Sonic S2S (modelo unico) | — | — |

Implementado em `providers.py` com factory functions e lazy imports.

#### Avatar Providers (`--avatar-provider`)

| Provider | Mecanismo | Qualidade |
|----------|-----------|-----------|
| `simli` | Video 2D lip-sync (via VideoImageFrame) | Baixa (256x256, sem expressoes) |
| `nvidia-a2f` | NVIDIA Audio2Face-3D NIM → 68 blendshapes ARKit via data channel → Three.js renderer | Alta (3D, expressoes faciais completas) |
| `none` | Audio-only | N/A |

NVIDIA Audio2Face-3D integrado via gRPC streaming (`nvidia-audio2face-3d` SDK).
Frontend Three.js renderer em `Avatar3D.tsx` usando React Three Fiber + ReadyPlayerMe GLB.

#### Emotion Providers (`--emotion-provider`)

| Provider | Metodo | Latencia |
|----------|--------|----------|
| `gpt4o` | GPT-4o-mini analise de texto (a cada 2 turnos) | ~1-2s |
| `hume` | Hume AI prosodia de audio (48 dimensoes, a cada 5s) | ~500ms |

#### Correcoes de Foundation

- Transcript salvo como string (nao JSON array) para compatibilidade com generate-feedback
- Feedback gerado automaticamente apos sessoes qualificadas (≥3 turnos, ≥500 chars)
- `set_feedback_requested()` + `trigger_feedback_generation()` adicionados ao supabase_client

### Fase 5 — Live Tests (2026-02-21)

Testes executados com o cenario "Retencao de Cliente Insatisfeito" (`cc2baea3`).

#### Test A — Audio-only baseline (`--no-avatar`)

- **Resultado**: Idle timeout (ninguem entrou na sala em 5 min). Pipeline inicializou corretamente.
- **Conclusao**: Infraestrutura funcional, validacao de setup.

#### Test B — Hume emotion detection (`--emotion-provider hume --no-avatar`)

- **Resultado**: Pipeline funcional, 10 entradas de transcript, conversa end-to-end OK.
- **STT TTFB**: ~743ms (Deepgram Nova-3)
- **LLM TTFB**: ~1.1s (Gemini 2.5 Flash)
- **TTS TTFB**: ~22ms (ElevenLabs Flash v2.5)
- **Hume prosody**: **Zero resultados**. O `HumeEmotionProcessor` foi linkado no pipeline (`input → hume → stt → ...`) mas nao produziu nenhum log de prosodia. Possivel incompatibilidade de tipo de frame ou falha silenciosa na API WebSocket.
- **Conclusao**: Pipeline de voz modular funciona perfeitamente. Hume precisa de debug adicional.

#### Test C — NVIDIA Audio2Face (`--avatar-provider nvidia-a2f`)

- **Resultado (tentativa 1 — 2026-02-21)**: Pipeline funcional, 11 entradas de transcript. A2F gRPC inicializou mas retornou **PermissionDenied** — API key sem acesso ao NIM endpoint.
- **Resultado (tentativa 2 — 2026-02-24, nova API key)**: **SUCESSO COMPLETO**. Pipeline funcional, 5 entradas de transcript.
- **STT TTFB**: ~697ms (Deepgram)
- **LLM TTFB**: 1.08-1.20s (Gemini)
- **TTS TTFB**: 37-254ms (ElevenLabs)
- **A2F gRPC**: Funcionou end-to-end:
  ```
  Audio2Face: new gRPC stream opened
  Audio2Face: header received (71 blendshapes)
  Audio2Face: 500 blendshape frames published
  Audio2Face: end-of-audio sent, stream closed
  ```
- **71 blendshapes ARKit** recebidos (James model com tongue shapes). 500 frames publicados via data channel em ~2s de audio.
- **Emotion GPT-4o**: Funcionou — `Emotion: frustrated (intensity=0, trend=stable)`
- **Conclusao**: Integracao NVIDIA A2F completa. gRPC → blendshapes → data channel funciona. Proximo passo: validar frontend Avatar3D.tsx recebendo e renderizando os blendshapes.

#### Resumo de Latencia (Pipeline Modular)

| Componente | TTFB Medido | Notas |
|-----------|-------------|-------|
| Deepgram STT | 550-743ms | pt-BR, endpointing 300ms |
| Gemini 2.5 Flash | 860-1810ms | Varia com contexto |
| ElevenLabs TTS | 22-165ms | Flash v2.5, muito rapido |
| **E2E estimado** | **~1.5-2.7s** | STT + LLM + TTS |

**Nota**: E2E estimado nao inclui tempo de rede (WebRTC ~50-100ms) nem VAD (200ms start). Comparar com OpenAI Realtime: ~800ms E2E.

### Fase 5B — Hume Prosody Fix (completo, 2026-02-24)

Correcao do `HumeEmotionProcessor` que retornava zero resultados em todas as fases de teste.

#### Bugs encontrados e corrigidos

1. **WebSocket library**: `aiohttp.ws_connect()` causa 404 no endpoint Hume. Corrigido para usar `websockets.connect()` (mesma lib que o SDK oficial usa).
2. **Audio format**: Hume requer arquivo de midia valido (WAV), nao PCM raw. Adicionado wrapper WAV via `wave` module antes do base64-encode.
3. **Buffer overflow**: Buffer acumula alem de 5s durante analise in-flight. Adicionado cap de `max_bytes = sample_rate * 2 * 5` (5s de mono 16-bit) e threshold reduzido para 4500ms.

#### Resultado do teste (2026-02-24)

```
Hume: first audio frame received (prosody analysis active)
Hume: analyzing 4538ms of audio (145200 bytes)
Hume prosody: Confusion=0.528 → hesitant | top3=[Confusion=0.528, Doubt=0.308, Surprise(neg)=0.278]
```

- 2 analises executadas — ambas com 4538ms, ambas sob o limite de 5s
- Zero erros E0203 (audio too long)
- Mapeamento Hume→simples funcional (Confusion → hesitant)
- Atributos publicados via `set_attributes()` no LiveKit room

#### Pendencias restantes

- ~~**Hume debug**: Investigar por que `HumeEmotionProcessor.process_frame()` nao dispara analise~~ RESOLVIDO (2026-02-24)
- ~~**NVIDIA A2F**: Obter API key com permissao para Audio2Face NIM endpoint~~ RESOLVIDO (2026-02-24)
- **Frontend A2F render**: Validar que Avatar3D.tsx recebe blendshapes via data channel e anima o GLB
- **AWS presets**: Nao testados (requer AWS credentials configurados)
- **Nova Sonic S2S**: Nao testado (requer AWS credentials)

## Referencias

- [Pipecat — GitHub](https://github.com/pipecat-ai/pipecat)
- [Pipecat Flows — Documentacao](https://github.com/pipecat-ai/pipecat-flows)
- [LiveKit Transport para Pipecat](https://github.com/pipecat-ai/pipecat/tree/main/src/pipecat/transports/services/livekit)
- [NVIDIA Audio2Face-3D NIM](https://build.nvidia.com/nvidia/audio2face-3d)
- [Hume Streaming API](https://dev.hume.ai/docs/expression-measurement/streaming)
- [ADR-002 — Stack Modular](002-stack-modular.md)
- [ADR-003 — Avatar TalkingHead.js](003-avatar-talkinghead.md)
- [ADR-004 — AWS Sao Paulo](004-aws-sp-infra.md)
