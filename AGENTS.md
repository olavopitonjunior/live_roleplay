# AGENTS.md - Live Roleplay

## Projeto

Live Roleplay é um sistema de voice AI para treinamento de vendas B2B via roleplay imersivo. O vendedor pratica com um avatar conversacional que simula um comprador (persona), enquanto um coach AI observa e envia dicas em tempo real. Ao final, um feedback estruturado é gerado automaticamente.

## Arquitetura Atual

### Stack

- Frontend: React 18 + TypeScript + Vite (PWA)
- Backend Agent: Python (LiveKit Agents SDK 1.4.x) - rodando no Railway
- LLM: Google Gemini Live (multimodal, half-cascade: TEXT + ElevenLabs TTS)
- TTS: ElevenLabs Flash v2.5 (~75ms TTFB) — fallback para Gemini voice nativo
- Avatar: Hedra (Character-3 model)
- Coaching: conversation_coach.py (Layer 2) + ai_coach.py (Gemini Flash)
- Database/Auth: Supabase (12 tabelas + 6 Edge Functions)
- Feedback: Edge Function generate-feedback (1069 linhas, usa Claude API)

### Arquivos Críticos

| Arquivo | Linhas | Responsabilidade |
|---------|--------|-----------------|
| `agent/main.py` | ~1378 | Orquestração principal: LiveKit + Gemini + Hedra |
| `agent/ai_coach.py` | ~907 | Lógica de coaching com Gemini Flash |
| `agent/coaching.py` | - | Keywords de coaching em PT-BR |
| `agent/emotion_analyzer.py` | - | Análise emocional AI + fallback keywords |
| `supabase/functions/generate-feedback/` | ~1069 | Geração de feedback com Claude API |
| `src/` | - | Frontend React + TypeScript |

### Comunicação Atual (Problema Arquitetural)

O Live Roleplay usa HTTP via Supabase para comunicar agent <-> frontend. O correto no ecossistema LiveKit é usar os canais nativos: RPC, Text Streams, e Participant Attributes. Essa migração é transversal a todos os 5 problemas abaixo.

---

## Repositórios de Referência

REGRA PRINCIPAL: Antes de implementar qualquer feature, clone o repositório de referência indicado e estude o código existente. Copie e adapte. Não reimplemente do zero.

| Tier | Projeto | Stars | Forks | Nota | Clone |
|------|---------|-------|-------|------|-------|
| 1 | LiveKit Agents | 9.2k | 2.8k | 9.3 | `git clone https://github.com/livekit/agents.git` |
| 1 | Pipecat | 9.1k | 1.5k | 9.0 | `git clone https://github.com/pipecat-ai/pipecat.git` |
| 2 | TEN Framework | 9.9k | 1.2k | 8.3 | `git clone https://github.com/TEN-framework/ten-framework.git` |
| 2 | Pipecat Flows | 200+ | 90+ | 8.5 | `git clone https://github.com/pipecat-ai/pipecat-flows.git` |
| 2 | Immersion | <50 | <10 | 7.8 | `git clone https://github.com/justanothernoob4648/immersion.git` |
| 3 | Interviewer | 1.9k | 400+ | 7.3 | `git clone https://github.com/IliaLarchenko/Interviewer.git` |
| 3 | FoloUp | 200+ | 50+ | 7.2 | `git clone https://github.com/FoloUp/FoloUp.git` |
| 3 | GPTInterviewer | 500+ | 100+ | 6.3 | `git clone https://github.com/jiatastic/GPTInterviewer.git` |

Nota = média da votação de 3 agentes avaliando Arquitetura, Integração e Produção (escala 0-10).

---

## Referência Arquitetural — Como os Melhores Projetos Resolvem Cada Dimensão

Use esta seção como mapa de decisões ao implementar qualquer mudança. Cada dimensão documenta como os repositórios analisados resolvem o problema, qual solução adotar no Live Roleplay, e onde encontrar o código de referência para copiar/adaptar.

---

### R1. Integrador de Vídeo (Avatar)

**LiveKit Agents (Tier 1):**
Plugin system oficial com plugins para Hedra, Tavus, Simli, HeyGen e Beyond Presence. O avatar entra na room como participante direto via ByteStream interno. Zero relay, zero re-encoding. O TTS gera áudio, o áudio vai direto para o avatar provider via plugin, o avatar publica vídeo+áudio sincronizados na room.
- Código: `livekit/agents/examples/avatars/hedra/`, `avatars/tavus/`, `avatars/simli/`
- Anti-pattern: relay manual (captura áudio > websocket > recebe vídeo > republica) dobra a latência.

**Pipecat (Tier 1):**
TavusVideoService, HeyGenVideoService e SimliVideoService como services no pipeline. Avatar recebe áudio do pipeline e publica vídeo via SmallWebRTCTransport ou DailyTransport.
- Código: `pipecat-ai/pipecat/src/pipecat/services/tavus.py`, `services/heygen.py`, `services/simli.py`

**TEN Framework (Tier 2):**
Extensões para Trulience, HeyGen e Tavus. Configuração via graph JSON. Avatar selecionado por ID no frontend.

**Immersion (Tier 2):**
TavusVideoService do Pipecat. Avatar persona configurada via TAVUS_REPLICA_ID no .env.

**Diferenças entre providers:**

| Provider | Realismo | Emoção | Latência | Integração LiveKit |
|----------|----------|--------|----------|-------------------|
| Hedra (Character-3) | Alto | Implícita via áudio TTS | Médio | Plugin oficial |
| Tavus (Phoenix-4) | Muito alto | Percepção visual (Raven) | Sub-1s | Plugin oficial |
| Simli | Alto | Explícita via emotion_id | Baixo | Plugin oficial |
| HeyGen (LiveAvatar) | Alto | Controle refinado | Médio | Plugin oficial |
| Beyond Presence (Bey) | Alto | Via TTS | <100ms render | Plugin oficial |
| Rhubarb+Three.js | Baixo (3D) | Explícita via facialExpression | Zero rede | Local no browser |

**Decisão para Live Roleplay:** Manter Hedra via plugin oficial do LiveKit. VERIFICAR se main.py está usando relay manual ou plugin oficial. Se relay manual, migrar para plugin oficial copiando pattern de `livekit/agents/examples/avatars/hedra/`. Se futuro exigir emoção determinística, avaliar Simli (emotion_id nativo) como alternativa.

---

### R2. Integrador de Voz (STT + TTS)

**LiveKit Agents (Tier 1):**
Sistema de plugins. STT: Deepgram Nova-3 streaming (~200ms TTFT), OpenAI Whisper, AssemblyAI, AWS Transcribe. TTS: Cartesia Sonic-3 (~90ms TTFA), ElevenLabs, OpenAI TTS. Unified inference API permite trocar providers com 1 linha.
- Código: `livekit/agents/livekit-plugins-deepgram/`, `livekit-plugins-cartesia/`

**Pipecat (Tier 1):**
DeepgramFluxSTTService (streaming com flush automático — reduz ~100ms). CartesiaTTSService, ElevenLabsTTSService. 40+ integrações.
- Código: `pipecat-ai/pipecat/src/pipecat/services/deepgram.py`, `services/cartesia.py`
- Diferencial: Flush automático de transcrições pendentes quando VAD detecta parada de fala.

**Immersion (Tier 2):**
DeepgramFluxSTTService + ElevenLabsTTSService. Escolha por qualidade de voz e suporte multilíngue.

**TEN Framework (Tier 2):**
Deepgram, ElevenLabs, Fish Audio como extensões. Configurável via graph JSON.

**Comparativo de TTS para controle emocional:**

| TTS Provider | Latência TTFA | Controle emocional | Plugin LiveKit |
|-------------|---------------|-------------------|----------------|
| Cartesia Sonic-3 | ~90ms | Parâmetros via API | Oficial |
| ElevenLabs | ~150ms | Emotion via prompt | Oficial |
| OpenAI TTS | ~200ms | Limitado | Oficial |
| Gemini Live (nativo) | N/A (voice mode) | Via prompt de contexto | Nativo |

**Decisão para Live Roleplay:** O Live Roleplay usa Gemini Live (multimodal, voice nativo) — não precisa de STT/TTS separados para conversa principal. Para o coach (ai_coach.py), se precisar gerar áudio de coaching, usar Cartesia Sonic-3 pela latência de 90ms. Para melhorar emoção do avatar, avaliar se o áudio do Gemini Live tem entonação suficiente para o Hedra ou se precisa de TTS dedicado com controle emocional (Cartesia ou ElevenLabs) como intermediário.

---

### R3. LLMs — Interpretação de Conversa, Cenário e Relatórios

**LiveKit Agents (Tier 1):**
Separação clara de LLMs por função via unified inference API. Pattern: 1 LLM capaz para conversa principal, 1 LLM menor e mais rápido para análise paralela.
- Código: `livekit/agents/livekit-plugins-openai/`, `livekit-plugins-google/`

**Pipecat (Tier 1):**
OpenAILLMService como wrapper genérico para qualquer provider compatível OpenAI (incluindo OpenRouter). Suporte nativo a Anthropic, Google Gemini, AWS Bedrock.
- Código: `pipecat-ai/pipecat/src/pipecat/services/openai.py`

**Immersion (Tier 2):**
OpenRouter-backed OpenAILLMService. Modelo configurável via AgentBuildConfig.openrouter_model. Permite trocar modelo sem alterar código.

**FoloUp (Tier 3):**
OpenAI para geração de perguntas de entrevista (adaptativas por resposta) e análise consolidada pós-sessão. Scoring incremental: cada resposta gera score parcial que alimenta contexto cumulativo.

**GPTInterviewer (Tier 3):**
OpenAI GPT-4 + FAISS + LangChain para busca semântica. LLM avalia resposta do candidato comparando com documento de referência via RAG. Feedback fundamentado no material de referência.

**Mapeamento de LLMs por função no Live Roleplay:**

| Função | LLM atual | Alternativa recomendada | Repositório de referência |
|--------|-----------|------------------------|--------------------------|
| Conversa principal (persona) | Gemini Live | Manter (multimodal nativo) | LiveKit Agents |
| Coaching em tempo real | Gemini Flash | Manter + layer system | Immersion (ConversationCoach) |
| Scoring por turno | Não existe | Gemini Flash (chamada paralela) | FoloUp |
| Feedback pós-sessão | Claude API (Edge Function) | Manter + categoryScores 0-100 | Interviewer, FoloUp |
| Busca em playbook (RAG) | Não existe | Gemini + FAISS | GPTInterviewer |

**Decisão para Live Roleplay:** Manter separação atual (Gemini Live para conversa, Gemini Flash para coach, Claude para feedback). Adicionar: scoring por turno com Gemini Flash em paralelo (mesma chamada do coach, output estruturado separado), e RAG com FAISS para playbook de vendas.

---

### R4. Resolução de Latência na Interação com Avatar

**LiveKit Agents (Tier 1) — Otimizações compostas:**

| Otimização | Redução | Como implementar | Código de referência |
|-----------|---------|-----------------|---------------------|
| Avatar como participante nativo | -1s+ | Plugin oficial Hedra (zero relay) | `examples/avatars/hedra/` |
| preemptive_generation=True | -200ms | Parâmetro no AgentSession | AgentSession config |
| Semantic turn detection | -500ms | Modelo transformer detecta fim de fala | `livekit-plugins-turn-detector/` |
| Pre-connect audio buffer | -300ms | `withPreconnectAudio: true` no frontend | Flag no LiveKit React SDK |
| Filler response | Percepção | Avatar diz "hmm..." durante processamento | `examples/fast-preresponse.py` |

**Pipecat (Tier 1) — Otimizações complementares:**

| Otimização | Redução | Código de referência |
|-----------|---------|---------------------|
| UserTurnCompletionLLMServiceMixin | -200ms | `pipecat/services/llm_service.py` |
| DeepgramFlux flush automático | -100ms | `pipecat/services/deepgram.py` |
| Streaming audio chunks | -200ms | Cartesia/ElevenLabs streaming mode |

**Simli (SaaS):**
maxSessionLength e maxIdleTime nativos no avatar provider. Timeout configurável sem código adicional.

**Vapi AI (SaaS):**
maxDuration, backchanneling para detecção de silêncio, fill injections para preencher gaps.

**Decisão para Live Roleplay — Ordem de implementação por impacto:**
1. Verificar se Hedra está como participante nativo (maior impacto absoluto)
2. Implementar filler responses (maior impacto percebido pelo usuário)
3. Ativar preemptive_generation
4. Ativar semantic turn detection
5. Implementar pre-connect audio buffer no frontend

---

### R5. Criação de Cenários, Base de Conhecimento, Manutenção de Sessão e Conclusão

**Pipecat Flows (Tier 2) — Cenários estruturados:**
Framework dedicado para conversas estruturadas. Grafo de nós com task_messages, role_messages, functions e transitions. Cada nó tem pre_actions e post_actions. Contexto preservado entre transições via context_strategy (default: append). Editor visual disponível.
- Código: `pipecat-ai/pipecat-flows/src/pipecat_flows/`
- Exemplos: `food_ordering.py`, `patient_intake.py`, `insurance_quotes.py`
- Aplicação para Live Roleplay: Cenários multi-fase (Rapport > Discovery/SPIN > Presentation > Objection Handling > Closing) com critérios de avaliação por fase e transições baseadas em detecção de estágio.
- INSTRUÇÃO: NÃO migrar Live Roleplay para Pipecat. Extrair o CONCEITO de grafos de nós e implementar como gerenciador de estado (`agent/scenario_flow.py`) no agent Python existente.

**GPTInterviewer (Tier 3) — Knowledge Base/RAG:**
FAISS para busca semântica em documentos de referência. LangChain como orquestrador. LLM compara resposta do candidato com seção relevante do documento.
- Código: `jiatastic/GPTInterviewer/`
- Aplicação: Carregar playbook de vendas, objeções comuns, info de produto. Avatar referencia seções específicas durante roleplay.
- INSTRUÇÃO: Clonar, estudar integração FAISS + LangChain. Adaptar para playbook de vendas como documento de referência.

**LiveKit Agents (Tier 1) — Manutenção e conclusão de sessão:**
Shutdown hooks com `session.interrupt()` > `session.say()` > `session.drain()` > `session.aclose()`. Hook `user_state_changed` para detectar inatividade. `departure_timeout` e `shutdown_process_timeout` configuráveis.
- Código: `livekit/agents/examples/inactive_user.py`
- INSTRUÇÃO: Copiar pattern de `inactive_user.py`. Implementar ciclo shutdown graceful.

**Immersion (Tier 2) — ConversationCoach:**
ConversationCoach como FrameProcessor no pipeline. Monitora hesitação e silêncio. Injeta estímulos quando learner trava. Configurável: `stuck_timeout_seconds`, `hesitant_utterance_tokens`.
- Código: `justanothernoob4648/immersion/`. Classe ConversationCoach.
- INSTRUÇÃO: Clonar, extrair ConversationCoach. Adaptar nudges de idioma nativo para referências ao playbook de vendas.

**FoloUp (Tier 3) — Scoring e conclusão:**
Scoring incremental por resposta alimentando contexto cumulativo. Análise consolidada pós-sessão por OpenAI. Dashboard com tracking de todos os candidatos.
- Código: `FoloUp/FoloUp/`
- INSTRUÇÃO: Clonar, estudar schema de scoring e lógica de análise consolidada. Adaptar categoryScores para competências de venda.

---

### R6. Controle de Tempo da Sessão e Sincronização de Voz e Vídeo

**Controle de tempo:**

| Projeto | maxSessionLength | maxIdleTime | Avisos progressivos |
|---------|-----------------|-------------|---------------------|
| LiveKit Agents | Via shutdown_process_timeout + timer custom | Hook user_state_changed + inactive_user.py | Implementar via RPC ao frontend |
| Simli (SaaS) | Parâmetro nativo da API | Parâmetro nativo da API | Não tem |
| Vapi AI (SaaS) | maxDuration configurável | Backchanneling detecta silêncio | Fill injections |
| HeyGen via Pipecat | activity_idle_timeout, disable_idle_timeout | Nativo na configuração de sessão | Não tem |

INSTRUÇÃO para Live Roleplay:
- maxSessionLength: Criar timer assíncrono no agent Python. Enviar aviso via RPC ao frontend quando faltar 5 minutos ("Temos mais 5 minutos de sessão"). Quando expirar, disparar `end_session_gracefully()`.
- maxIdleTime: Copiar pattern de `livekit/agents/examples/inactive_user.py`. Quando silêncio > 60s, enviar prompt motivacional em PT-BR ("Está tudo bem? Quer continuar com o roleplay?"). Se continuar inativo > 120s, encerrar gracefully.
- Referência Simli: Se migrar para Simli no futuro, maxSessionLength e maxIdleTime são parâmetros nativos — zero código.

**Sincronização de voz e vídeo:**

| Projeto | Mecanismo de sincronia | Código de referência |
|---------|----------------------|---------------------|
| LiveKit Agents + plugin oficial | WebRTC nativo. Avatar como participante na room = sincronia automática no nível do protocolo. | Plugins oficiais de avatar |
| Pipecat | Pipeline de typed frames garante ordenação. TranscriptProcessor alinha estado conversacional com áudio. | `pipecat/processors/transcript.py` |
| Relay manual (anti-pattern) | Sem sincronia garantida. Áudio e vídeo chegam por canais separados com latências diferentes. | Evitar |

INSTRUÇÃO para Live Roleplay: Garantir que Hedra está como participante nativo na room via plugin oficial. Se sim, sincronia é automática via WebRTC — não requer código adicional. Se está usando relay manual, a migração para plugin oficial resolve sincronia E latência simultaneamente.

---

### R7. Sensibilidade Emocional do Avatar, da Voz e Temperatura da Sessão

**Emoção do Avatar:**

| Provider | Mecanismo | Controle | Código de referência |
|----------|-----------|----------|---------------------|
| Hedra (Character-3) | Implícita via áudio TTS. Avatar espelha entonação do áudio. | Indireto — depende do TTS ser emocional | `livekit/agents/examples/avatars/hedra/` |
| Simli | Explícita via `emotion_id`: "happy", "sad", "angry", "surprised" | Direto e determinístico | `livekit/agents/examples/avatars/simli/` |
| Tavus Raven | Percepção visual do USUÁRIO via câmera. Detecta emoção, atenção, reações. | Bidirecional — analisa e reage | API Tavus |
| talking-avatar-with-ai | LLM retorna tag `facialExpression: "smile"`. Frontend aplica animação 3D. | Explícita via output do LLM | `talking-avatar-with-ai/` |

**Emoção da Voz (TTS):**

| TTS | Controle emocional | Como usar |
|-----|-------------------|-----------|
| Cartesia Sonic-3 | Parâmetros de emoção via API (speed, emotion, energy) | Configurar no plugin `livekit-plugins-cartesia` |
| ElevenLabs | Emotion via prompt de voz ("speak with frustration") | Configurar no plugin `livekit-plugins-elevenlabs` |
| Gemini Live | Via contexto no prompt ("responda com tom frustrado") | Instrução no system prompt |
| Hume AI EVI | Emoção nativa voice-to-voice. Detecta emoção do input e ajusta output. | API Hume |

**Detecção de emoção do usuário/trainee:**

| Projeto | Mecanismo | Precisão | Código de referência |
|---------|-----------|----------|---------------------|
| Hume AI EVI | Expression Measurement API. Analisa prosódia (tom, ritmo, intensidade) por turno. 4 modalidades. | Alta | API Hume |
| Tavus Raven | Análise visual via câmera em tempo real. Detecta emoção facial. | Alta (visual) | API Tavus |
| emotion_analyzer.py (atual) | Análise AI + fallback keywords | Média | `agent/emotion_analyzer.py` |
| TalkMateAI | VAD + vision + emotion combinados | Média | `TalkMateAI/` |

**Temperatura da sessão (engajamento ao longo do tempo):**

| Projeto | Mecanismo | Sincronização com frontend |
|---------|-----------|---------------------------|
| LiveKit Agents (role-playing) | Participant attributes: engagement_score, emotion, stats atualizados por turno | Automática via LiveKit React SDK |
| FoloUp | Score cumulativo por resposta no backend. Dashboard consulta via API. | Via HTTP (polling) |
| Live Roleplay (atual) | emotion_analyzer.py existe mas usa HTTP para frontend | Lento, não real-time |

INSTRUÇÃO para Live Roleplay — Implementar em 3 camadas:

1. Camada 1 (curto prazo): Instruir Gemini Live a emitir tags de emoção na resposta ([frustrado], [interessado], [hesitante]). Agent extrai tag e injeta no contexto do Hedra. Se Hedra não aceita tag direta, a emoção no áudio do Gemini Live já influencia o avatar implicitamente.
   - INSTRUÇÃO: Adicionar instrução ao system prompt do persona: "Sempre inclua uma tag de emoção no início de cada resposta entre colchetes. Tags válidas: [neutro], [interessado], [frustrado], [hesitante], [entusiasmado], [desconfiado]."
   - O agent Python extrai a tag via regex, remove do texto antes do TTS, e usa para atualizar participant attributes (emoção do persona) e alimentar o emotion_analyzer.

2. Camada 2 (médio prazo): Avaliar Cartesia Sonic-3 como TTS intermediário entre Gemini e Hedra. Gemini gera texto + tag de emoção. Cartesia converte em áudio com entonação emocional controlada. Hedra renderiza vídeo espelhando o áudio emocional.
   - INSTRUÇÃO: Testar pipeline: Gemini Live (texto) > Cartesia Sonic-3 (áudio emocional) > Hedra (vídeo). Comparar com pipeline atual em latência e expressividade.

3. Camada 3 (longo prazo): Integrar Hume AI Expression Measurement API para detecção de emoção do trainee. Ou avaliar migração para Simli (emotion_id determinístico) se precisar de controle total da emoção do avatar.

---

## 5 Problemas para Implementar

Implemente todos os 5 problemas. Não peça confirmação — implemente direto e mostre o resultado. Se precisar tomar decisão de design, escolha a opção que mantém compatibilidade com o que já existe e minimiza reescrita.

---

### PROBLEMA 1: Latência no carregamento das respostas do avatar

**Sintoma:** O primeiro turno do avatar demora vários segundos. Turnos seguintes também acumulam latência.

**Causa raiz:** Pipeline sequencial STT > LLM > TTS > Avatar, possível relay manual do Hedra (ao invés do plugin oficial), e falta de pre-connect buffer no frontend.

**O que implementar:**

1. **Verificar integração Hedra no main.py.** Se relay manual, migrar para plugin oficial.
   - INSTRUÇÃO: Clonar `livekit/agents`, ir em `examples/avatars/hedra/`. Copiar pattern de integração via plugin oficial. Comparar com main.py e identificar diferenças.

2. **Ativar preemptive_generation no AgentSession.** Parâmetro `preemptive_generation=True`. ATENÇÃO: bug reportado (issue #4219) causa requisições LLM duplicadas. Adicionar log para monitorar.

3. **Ativar instant connect no frontend.** Adicionar `withPreconnectAudio: true` no `setMicrophoneEnabled()`.
   - INSTRUÇÃO: No repositório `livekit/agents`, buscar referências a `isPreConnectBufferEnabled`.

4. **Ativar semantic turn detection.** Modelo transformer para detectar fim de fala.
   - INSTRUÇÃO: No repositório `livekit/agents`, estudar `livekit-plugins-turn-detector/`. Adicionar como dependência.

5. **Implementar filler response.** Avatar diz "hmm..." enquanto Gemini processa.
   - INSTRUÇÃO: No repositório `livekit/agents`, copiar pattern de `examples/fast-preresponse.py`. Adaptar fillers para PT-BR ("hmm...", "deixa eu pensar...", "boa pergunta...").

**Referências:**
- `livekit/agents/examples/avatars/hedra/`
- `livekit/agents/examples/fast-preresponse.py`
- Blog LiveKit "Bringing AI Avatars to Voice Agents"

---

### PROBLEMA 2: Coach não fornece informações just-in-time

**Sintoma:** Coach envia dicas tarde demais ou não envia durante momentos críticos.

**Causa raiz:** Rate limit Gemini Flash, comunicação HTTP, coach acumula contexto antes de reagir.

**O que implementar:**

1. **Migrar comunicação coach > frontend de HTTP para RPC do LiveKit.**
   - INSTRUÇÃO: No `livekit/agents`, estudar `examples/rpc_agent.py`. Adaptar para envio de coaching hints como JSON via RPC.

2. **Mover análise de coaching para hook `on_user_turn_completed`.** Executa em paralelo com resposta do persona.

3. **Implementar layer system:** Layer 1: Keywords (coaching.py, custo zero). Layer 2: Regex para objeções e SPIN (custo zero). Layer 3: Gemini Flash para análise semântica (1 chamada a cada 2-3 turnos).

4. **Participant attributes para estado do coaching.**
   - INSTRUÇÃO: No `livekit/agents`, estudar `examples/role-playing/`. Copiar pattern de participant attributes para engagement_score, spin_stage, objection_status.

5. **Integrar ConversationCoach pattern do Immersion.**
   - INSTRUÇÃO: Clonar `justanothernoob4648/immersion`. Extrair classe ConversationCoach. Adaptar: nudges de idioma nativo viram referências ao playbook de vendas. Defaults: stuck_timeout_seconds=15, hesitant_utterance_tokens=3. Integrar como complemento ao ai_coach.py existente.

**Referências:**
- `livekit/agents/examples/role-playing/`
- `justanothernoob4648/immersion/` (ConversationCoach)
- Docs: `docs.livekit.io/home/client/data/rpc`

---

### PROBLEMA 3: Sessões encerram abruptamente

**Sintoma:** Sessão fecha sem despedida, sem salvar transcript completo, sem disparar feedback.

**Causa raiz:** Falta de shutdown hooks, timeout Hedra (2 min), crashes não tratados.

**O que implementar:**

1. **Implementar shutdown hooks no agent.** `@ctx.add_shutdown_callback` que salva transcript, dispara feedback e atualiza status.

2. **Implementar graceful session end.** Pattern: `session.interrupt()` > `session.say("despedida")` > `session.drain()` > `session.aclose()` > `ctx.disconnect()`.

3. **Configurar departure_timeout** para reconexão em instabilidade de rede.

4. **Implementar maxSessionLength e maxIdleTime.**
   - INSTRUÇÃO: Criar timer assíncrono no agent. Aviso via RPC quando faltar 5 min. Copiar pattern de `livekit/agents/examples/inactive_user.py` para detecção de inatividade. Prompt motivacional em PT-BR quando silêncio > 60s. Encerrar gracefully se inativo > 120s.

5. **Configurar `shutdown_process_timeout` > 60s no AgentServer.**

6. **Monitorar Hedra inactivity timeout.** Keepalive periódico ou aviso ao usuário.
   - INSTRUÇÃO: Copiar pattern de `inactive_user.py`. Adaptar prompts para PT-BR.

**Referências:**
- `livekit/agents/examples/inactive_user.py`
- Issue #3148: graceful session end com timer
- Issue #3588: session.drain() pattern

---

### PROBLEMA 4: Falta de emoção do avatar e do termômetro

**Sintoma:** Avatar inexpressivo. Termômetro não funciona em tempo real.

**Causa raiz:** emotion_analyzer.py desconectado do TTS. Hedra depende de áudio emocional. Termômetro usa HTTP.

**O que implementar:**

1. **Conectar emotion_analyzer.py ao fluxo de TTS.** Agente decide emoção, ajusta TTS, Hedra reflete.

2. **Marcação emocional no prompt do personagem.** Gemini inclui tags ([frustrado], [interessado], [hesitante]). Agent extrai tag e converte em parâmetros.
   - INSTRUÇÃO: Adicionar ao system prompt: "Sempre inclua uma tag de emoção no início da resposta entre colchetes." Agent extrai via regex, remove antes do TTS, atualiza participant attributes.

3. **Termômetro via participant attributes.**
   - INSTRUÇÃO: No `livekit/agents`, copiar `examples/role-playing/` para participant attributes. Frontend lê via useParticipantAttributes do LiveKit React SDK.

4. **Avaliar TTS com controle emocional.** Cartesia Sonic-3 (90ms, controle via API) ou ElevenLabs.

5. **Componente de termômetro no frontend.** Engajamento 0-100, estágio SPIN, emoção do prospect, status objeções. Todos via participant attributes.

**Referências:**
- `livekit/agents/examples/role-playing/`
- `livekit/agents/examples/avatars/simli/` (emotion_id nativo)

---

### PROBLEMA 5: Feedback nem sempre é gerado e fica desassociado

**Sintoma:** Se frontend não dispara, feedback não existe. Sem fallback server-side.

**Causa raiz:** Feedback disparado pelo frontend. Edge Function sem retry.

**O que implementar:**

1. **Trigger primário no shutdown hook** (Problema 3).

2. **Frontend como segunda tentativa (dual-trigger).** Edge Function idempotente.

3. **Scoring incremental por turno (FoloUp pattern).**
   - INSTRUÇÃO: Clonar `FoloUp/FoloUp`. Estudar scoring incremental. Adaptar para competências de venda. Salvar na tabela session_evidences a cada turno.

4. **Migrar schema para categoryScores 0-100.**
   - INSTRUÇÃO: Clonar `IliaLarchenko/Interviewer`. Estudar categoryScores (communication, technical, problem-solving com 0-100). Adaptar categorias: Rapport Building, SPIN Selling, Objection Handling, Closing Technique, Product Knowledge.

5. **Retry com backoff exponencial na Edge Function.** 3 tentativas. Se falha 3x, status `feedback_pending`.

6. **Webhook room_finished como safety net.** LiveKit emite webhook quando room fecha. Handler verifica se feedback existe.

**Referências:**
- `FoloUp/FoloUp/`: scoring incremental
- `IliaLarchenko/Interviewer/`: categoryScores schema
- `jiatastic/GPTInterviewer/`: avaliação com FAISS

---

## MUST-HAVE — Tasks Adicionais (Pós 5 Problemas)

Features essenciais que devem existir após os 5 problemas estarem resolvidos. Cada task indica o repositório para copiar/adaptar.

### MUST-HAVE 1: Filler Responses Avançadas

Se já implementado no Problema 1 como filler simples, evoluir para pool contextual que varia conforme estágio da conversa.

INSTRUÇÃO:
1. No `livekit/agents`, expandir pattern de `examples/fast-preresponse.py`
2. Criar pool de fillers PT-BR por contexto: descoberta ("interessante..."), objeção ("entendo seu ponto..."), fechamento ("deixa eu pensar no melhor cenário...")
3. Selecionar filler baseado no spin_stage atual (participant attribute)

### MUST-HAVE 2: Pre-Connect Audio Buffer

Se não implementado no Problema 1.

INSTRUÇÃO:
1. No frontend React, encontrar onde `setMicrophoneEnabled` é chamado
2. Adicionar flag `withPreconnectAudio: true`
3. No `livekit/agents`, buscar `isPreConnectBufferEnabled` para confirmar API

---

## NICE-TO-HAVE — Tasks Estratégicas (Diferenciação)

Features que posicionam o Live Roleplay como líder de mercado. Implementar após MUST-HAVE estáveis.

### NICE-TO-HAVE 1: ConversationCoach Proativo

Coach automático por IA que monitora hesitação e silêncio, injetando dicas proativamente.

INSTRUÇÃO:
1. Clonar `justanothernoob4648/immersion`
2. Extrair classe ConversationCoach
3. É um FrameProcessor no Pipecat. Para LiveKit Agents, adaptar como background task assíncrona que monitora transcript em tempo real
4. Substituir nudges de idioma nativo por referências ao playbook de vendas
5. Defaults: stuck_timeout_seconds=15, hesitant_utterance_tokens=3
6. Integrar como complemento ao ai_coach.py, não como substituto

### NICE-TO-HAVE 2: Detecção de Emoção do Trainee

Analisar prosódia do trainee para detectar frustração, confusão, confiança.

INSTRUÇÃO:
1. Avaliar Hume AI Expression Measurement API (melhor para prosódia)
2. Alternativa: Tavus Raven (emoção via câmera, requer Tavus como provider)
3. Implementar como middleware que analisa áudio do usuário antes de enviar ao LLM
4. Alimentar emotion_analyzer.py com scores da API
5. Injetar no prompt Gemini: "O trainee parece [frustrado/confuso/confiante]. Ajuste abordagem."

### NICE-TO-HAVE 3: Dashboard do Coach em Tempo Real

Métricas sincronizadas backend-frontend para coach humano.

INSTRUÇÃO:
1. No `livekit/agents`, estudar `examples/role-playing/` para participant attributes
2. Atributos: engagement_score, spin_stage, objection_status, emotion, turn_score, cumulative_score
3. Agent atualiza via `set_attributes()` a cada turno
4. Frontend: componente CoachDashboard usando useParticipantAttributes do LiveKit React SDK
5. Renderizar: termômetro, estágio SPIN, score acumulado, alertas

### NICE-TO-HAVE 4: Cenários Multi-Fase

Cenários de roleplay com fases estruturadas e transições definidas.

INSTRUÇÃO:
1. Clonar `pipecat-ai/pipecat-flows`
2. Estudar `examples/food_ordering.py` como template
3. NÃO migrar para Pipecat. Extrair CONCEITO de grafos de nós
4. Criar `agent/scenario_flow.py` com: ScenarioPhase, PhaseTransition, ScenarioGraph
5. Cada fase: role_prompt (como persona age), evaluation_criteria (o que avaliar), transition_triggers (quando avançar)
6. Fases padrão: Rapport > Discovery/SPIN > Presentation > Objection Handling > Closing
7. Gemini recebe role_prompt da fase atual. Transição automática quando trigger detectado

### NICE-TO-HAVE 5: Knowledge Base / RAG com Playbook

Avatar com acesso ao playbook de vendas durante roleplay.

INSTRUÇÃO:
1. Clonar `jiatastic/GPTInterviewer`
2. Estudar integração FAISS + LangChain
3. Criar índice FAISS a partir do playbook de vendas (PDF/markdown)
4. Adicionar function tool no agent que busca no FAISS quando trainee menciona tema do playbook
5. Alternativa simples: playbook como contexto no system prompt (limitado por context window)
6. Para Pipecat, verificar integração com LangChain e mem0

### NICE-TO-HAVE 6: Memória Cross-Session

Avatar "lembra" progresso do trainee entre sessões.

INSTRUÇÃO:
1. Usar tabela session_evidences como base
2. Antes de nova sessão, consultar últimas N sessões do trainee
3. Resumo via Gemini Flash: "Sessões anteriores: dificuldade com objeções de preço (45/100), bom em rapport (78/100)"
4. Injetar resumo no system prompt do Gemini Live
5. Alternativa: mem0 via Pipecat para memória persistente
6. Alternativa enterprise: Tavus Memories API

### NICE-TO-HAVE 7: Otimizações de Latência Avançadas

Otimizações incrementais que somam até -1s+.

INSTRUÇÃO:
1. No `livekit/agents`, ativar preemptive_generation=True (se não feito)
2. Adicionar turn-detector transformer como dependência
3. No `pipecat-ai/pipecat`, estudar UserTurnCompletionLLMServiceMixin. Avaliar adaptação para LiveKit
4. Estudar DeepgramFluxSTTService flush automático. Se usando Deepgram, verificar se flush está ativo
5. Avaliar streaming de chunks de áudio (Cartesia e ElevenLabs suportam)

---

## Mudanças Transversais

### Migrar comunicação HTTP > canais nativos LiveKit

- **RPC** para ações pontuais (coaching hint, disparar feedback)
- **Participant Attributes** para estado contínuo (termômetro, emoção, estágio SPIN)
- **Text Streams** para dados contínuos (transcript em tempo real)

INSTRUÇÃO: No `livekit/agents`, estudar `examples/rpc_agent.py` e `examples/role-playing/`.

### Extrair prompts para YAML

Mover prompts inline do main.py e ai_coach.py para arquivos YAML por persona/cenário.

### Criar tabela session_evidences no Supabase

```sql
CREATE TABLE session_evidences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES sessions(id),
    turn_number INTEGER NOT NULL,
    user_text TEXT,
    analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Ordem de Implementação

### Fase 1: Fundação (Transversais + Problemas 3 e 1)
1. Mudanças transversais (RPC, participant attributes, YAML prompts, session_evidences)
2. Problema 3 (shutdown hooks + graceful end + controle de tempo)
3. Problema 1 (latência: verificar Hedra, preemptive gen, pre-connect, filler, turn detection)

### Fase 2: Experiência (Problemas 2, 4 e 5)
4. Problema 2 (coach just-in-time + ConversationCoach pattern)
5. Problema 4 (emoção + termômetro via participant attributes)
6. Problema 5 (feedback robusto + scoring incremental + categoryScores)

### Fase 3: MUST-HAVE Restantes
7. Filler responses avançadas (pool contextual PT-BR)
8. Pre-connect audio buffer (se não implementado na Fase 1)

### Fase 4: NICE-TO-HAVE (Diferenciação)
9. ConversationCoach proativo
10. Detecção de emoção do trainee
11. Dashboard do coach em tempo real
12. Cenários multi-fase
13. Knowledge Base / RAG com playbook
14. Memória cross-session
15. Otimizações de latência avançadas

---

## Regras de Implementação

- Não peça confirmação antes de alterar arquivos. Implemente direto.
- REGRA PRINCIPAL: Antes de implementar qualquer feature, clone o repositório de referência e estude o código. Copie e adapte. Não reimplemente do zero.
- Se main.py ou ai_coach.py ficarem grandes demais, quebre em módulos menores.
- Mantenha compatibilidade com o que já funciona. Não reescreva do zero.
- Priorize mudanças de menor risco (configurações, flags) antes de refatorações grandes.
- Se encontrar bugs ou inconsistências, corrija e documente.
- Use tipos TypeScript estritos no frontend.
- Comentários apenas onde decisão de design não é óbvia.
- Commits atômicos: um commit por problema resolvido.
- Para cada feature implementada, documente qual repositório foi usado e qual arquivo/pattern foi adaptado.
