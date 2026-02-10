# AGENTS.md - Live Roleplay

## Projeto

Live Roleplay é um sistema de voice AI para treinamento de vendas B2B via roleplay imersivo. O vendedor pratica com um avatar conversacional que simula um comprador (persona), enquanto um coach AI observa e envia dicas em tempo real. Ao final, um feedback estruturado é gerado automaticamente.

## Arquitetura Atual

### Stack

- Frontend: React 19 + TypeScript + Vite (PWA)
- Backend Agent: Python (LiveKit Agents SDK 1.x) - rodando no Railway
- LLM: Google Gemini Live (multimodal, voice)
- Avatar: Hedra (Character-3 model)
- Coaching: ai_coach.py com Gemini Flash
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

## 5 Problemas para Implementar

Implemente todos os 5 problemas. Não peça confirmação — implemente direto e mostre o resultado. Se precisar tomar decisão de design, escolha a opção que mantém compatibilidade com o que já existe e minimiza reescrita.

---

### PROBLEMA 1: Latência no carregamento das respostas do avatar

**Sintoma:** O primeiro turno do avatar demora vários segundos. Turnos seguintes também acumulam latência.

**Causa raiz:** Pipeline sequencial STT > LLM > TTS > Avatar, possível relay manual do Hedra (ao invés do plugin oficial), e falta de pre-connect buffer no frontend.

**O que implementar:**

1. **Verificar integração Hedra no main.py.** Se está fazendo relay manual (captura áudio do agente > envia para Hedra via websocket > recebe vídeo > republica na room), migrar para o padrão oficial onde o Hedra entra na room como participante direto. Referência: plugin `livekit-plugins-hedra` em `livekit/agents/examples/avatars/hedra`.

2. **Ativar preemptive_generation no AgentSession:**
```python
session = AgentSession(
    preemptive_generation=True,
    # ... demais parâmetros
)
```
ATENÇÃO: existe bug reportado (issue #4219 no livekit/agents) que causa requisições LLM duplicadas. Adicionar log para monitorar se chamadas estão dobrando.

3. **Ativar instant connect no frontend.** Procurar onde o microfone é habilitado e adicionar:
```typescript
await room.localParticipant.setMicrophoneEnabled(true, undefined, {
    withPreconnectAudio: true
})
```
Isso captura áudio enquanto o agente conecta, eliminando silêncio inicial.

4. **Ativar semantic turn detection** no AgentSession (se ainda não estiver). Usa modelo transformer ao invés de timeout de silêncio para detectar fim da fala.

5. **Implementar filler response.** Enquanto o Gemini processa, o avatar deve dizer algo curto como "hmm..." ou "certo..." para eliminar o silêncio percebido. Usar o hook `on_user_turn_completed` para disparar um filler antes da resposta completa.

**Referências de pattern:**
- `agent-starter-react`: flag `isPreConnectBufferEnabled: true`
- `livekit/agents/examples/avatars/hedra`: integração oficial Hedra
- `python-agents-examples/docs/examples/fast-preresponse.py`: filler response pattern
- Blog LiveKit "Bringing AI Avatars to Voice Agents": arquitetura avatar como participante

---

### PROBLEMA 2: Coach não fornece informações just-in-time

**Sintoma:** O coach envia dicas tarde demais ou não envia durante momentos críticos (objeção não tratada, SPIN não utilizado).

**Causa raiz:** Rate limit do Gemini Flash (15-20 req/min), comunicação via HTTP ao invés de RPC, e coach tenta acumular contexto antes de reagir.

**O que implementar:**

1. **Migrar comunicação coach > frontend de HTTP para RPC do LiveKit.** O RPC entrega payload direto ao frontend sem intermediário. Payload máximo: 15KB string (suficiente para JSON de coaching).

   Formato do payload de coaching:
   ```json
   {
     "type": "coaching_hint",
     "hint": "O cliente mencionou orçamento. Use uma pergunta de Implicação SPIN.",
     "urgency": "high",
     "suggested_questions": [
       "E se vocês não resolverem essa questão de orçamento este trimestre, qual seria o impacto?"
     ]
   }
   ```

   No frontend, registrar handler RPC para receber e exibir no CoachingPanel.

2. **Mover análise de coaching para o hook `on_user_turn_completed`.** Isso executa em paralelo com a geração de resposta do personagem. O coach analisa a fala do usuário enquanto o Gemini gera a próxima resposta do avatar.

   ```python
   @session.on("user_turn_completed")
   async def on_user_turn(ev):
       # Executa em paralelo com LLM response
       hint = await analyze_turn_for_coaching(ev.text)
       if hint:
           await send_coaching_hint_via_rpc(hint)
   ```

3. **Implementar layer system de análise para economizar chamadas LLM:**
   - Layer 1: Keywords (já existe no coaching.py) — custo zero, executa sempre
   - Layer 2: Regex/patterns para detectar objeções e estágios SPIN — custo zero, executa sempre
   - Layer 3: Gemini Flash para análise semântica — 1 chamada a cada 2-3 turnos, NÃO a cada turno
   
   Se Layer 1 ou 2 detectarem algo relevante, enviar hint imediatamente sem esperar Layer 3.

4. **Usar participant attributes para estado do coaching em tempo real:**
   ```python
   await ctx.room.local_participant.set_attributes({
       "engagement_score": "72",
       "spin_stage": "implication",
       "objection_status": "price_mentioned"
   })
   ```
   O frontend lê via hook do LiveKit React SDK e atualiza o termômetro instantaneamente.

5. **Reestruturar ai_coach.py como background observer.** O coach NÃO deve interferir no fluxo do agente principal. Padrão do Doheny Surf Desk: o observer monitora sem bloquear, e só envia hints via side-channel (RPC). Separar responsabilidades: observação (ai_coach) vs ação (envio de hint via RPC).

**Referências de pattern:**
- `python-agents-examples/complex-agents/doheny-surf-desk`: background observer
- `python-agents-examples/docs/examples/rpc_agent`: RPC para estado
- `python-agents-examples/complex-agents/role-playing`: participant attributes para state
- Docs: `docs.livekit.io/home/client/data/rpc`
- Docs: `docs.livekit.io/agents/logic/nodes` (hooks)

---

### PROBLEMA 3: Sessões encerram abruptamente

**Sintoma:** A sessão fecha sem despedida, sem salvar transcript completo, sem disparar feedback.

**Causa raiz:** Falta de shutdown hooks, dependência de `on("disconnected")` que não dispara de forma confiável (bug livekit/agents#1581), timeout do Hedra por inatividade (2 min), e crashes não tratados no Railway.

**O que implementar:**

1. **Implementar shutdown hooks no agent:**
   ```python
   @ctx.add_shutdown_callback
   async def on_shutdown():
       # 1. Salvar transcript final completo
       final_transcript = session.chat_context.to_dict()
       await save_transcript(session_id, final_transcript)
       
       # 2. Disparar geração de feedback (async)
       await trigger_feedback_generation(session_id)
       
       # 3. Atualizar status da sessão no Supabase
       await update_session_status(session_id, "completed")
   ```

2. **Implementar graceful session end com despedida:**
   ```python
   async def end_session_gracefully():
       session.interrupt()  # Para o que o agente está falando
       speech_handle = session.say(
           "Estamos finalizando a sessão. Seu feedback será gerado em instantes."
       )
       await speech_handle  # Espera a despedida ser ouvida
       await session.drain()  # Espera speech pendente terminar
       await session.aclose()
       ctx.disconnect()
   ```

3. **Configurar departure_timeout na room** para dar tempo ao agente de reconectar em caso de instabilidade de rede, ao invés de encerrar imediatamente.

4. **Adicionar error event handling:**
   ```python
   @session.on("error")
   def on_error(ev):
       if ev.error.recoverable:
           pass  # SDK faz retry automaticamente
       else:
           session.say("Estou tendo um problema técnico. Vou salvar seu progresso.")
           # Disparar salvamento de emergência
   ```

5. **Configurar `shutdown_process_timeout` > 60s no AgentServer** para garantir tempo suficiente para os shutdown hooks executarem.

6. **Adicionar FallbackAdapter para Gemini.** Se o Gemini falha, cair para outro provider ao invés de crashar a sessão.

7. **Monitorar Hedra inactivity timeout (2 min).** Enviar keepalive periódico ou avisar o usuário quando se aproximar do timeout. Usar `inactive_user` pattern: detectar silêncio prolongado e enviar prompt motivacional.

**Referências de pattern:**
- Docs: `docs.livekit.io/agents/server/job` (shutdown hooks)
- Issue #3148: graceful session end com timer
- Issue #3588: session.drain() pattern
- Issue #1581: on("disconnected") unreliable
- `python-agents-examples/docs/examples/inactive_user.py`
- `python-agents-examples/docs/examples/resume_interrupted_agent.py`
- Docs: `docs.livekit.io/agents/build/events` (FallbackAdapter)

---

### PROBLEMA 4: Falta de emoção do avatar e do termômetro

**Sintoma:** O avatar é inexpressivo. O termômetro de engajamento não funciona em tempo real. O frontend não reflete o estado emocional da sessão.

**Causa raiz:** emotion_analyzer.py existe mas pode não estar conectado ao avatar/TTS. Hedra deriva emoção do áudio (Character-3 model), então sem TTS emocional = avatar sem emoção. Termômetro usa HTTP ao invés de participant attributes.

**O que implementar:**

1. **Conectar emotion_analyzer.py ao fluxo de TTS.** O agente deve decidir a emoção do personagem e ajustar parâmetros de TTS antes de gerar áudio. O Hedra então renderiza expressão facial correspondente ao áudio emocional.

   Fluxo:
   ```
   LLM output: "[frustrado] Já disse que o orçamento não permite..."
   Agent: extrai tag [frustrado], ajusta parâmetros TTS
   TTS: gera áudio com entonação frustrada
   Hedra: renderiza vídeo com expressão correspondente
   ```

2. **Adicionar marcação emocional ao prompt do personagem.** O prompt do Gemini deve instruir o modelo a incluir tags de emoção na resposta (ex: [frustrado], [interessado], [hesitante]). O agent Python extrai a tag e a converte em parâmetros de TTS.

3. **Implementar termômetro via participant attributes do LiveKit:**
   ```python
   # No agent Python, a cada turno atualizar:
   await ctx.room.local_participant.set_attributes({
       "engagement_score": "72",
       "emotion": "resistant",
       "spin_stage": "implication",
       "objection_status": "price_mentioned"
   })
   ```

   No frontend, usar hook do LiveKit React SDK para ler esses atributos e atualizar o componente de termômetro em tempo real. Zero HTTP, zero latência.

4. **Avaliar TTS com controle emocional.** Se o TTS atual não suporta controle de emoção, considerar Cartesia Sonic 3 ou ElevenLabs que oferecem parâmetros emocionais. O Hedra Character-3 reflete emoção do áudio, então TTS emocional = avatar emocional.

5. **Implementar componente de termômetro no frontend** (se não existir ou estiver parcial). Deve mostrar: score de engajamento (0-100), estágio SPIN atual, emoção detectada do prospect, e status de objeções. Todos alimentados por participant attributes.

**Referências de pattern:**
- `python-agents-examples/complex-agents/role-playing`: participant attributes para state
- `python-agents-examples/complex-agents/nova-sonic`: structured data em tempo real
- Docs: `docs.livekit.io/agents/models/avatar/plugins/hedra`
- Docs: `docs.livekit.io/agents/models/avatar/plugins/simli` (alternativa com emotion_id nativo)

---

### PROBLEMA 5: Feedback nem sempre é gerado e fica desassociado

**Sintoma:** Se o usuário fecha o browser antes do feedback, ele nunca é gerado. Se a sessão encerrou abruptamente (Problema 3), o transcript pode estar incompleto. Não há retry se a chamada Claude API falha.

**Causa raiz:** Feedback é disparado pelo frontend após a sessão. Se o frontend não dispara, não existe fallback. A Edge Function não é idempotente nem tem retry.

**O que implementar:**

1. **Mover trigger primário de feedback para shutdown hook do agent** (implementado no Problema 3). O agente dispara geração de feedback antes de fechar, independente do frontend.

2. **Manter trigger do frontend como segunda tentativa (dual-trigger).** Frontend dispara quando recebe session_end. Edge Function deve ser idempotente: se já existe feedback para aquele session_id, retorna o existente.

3. **Tornar Edge Function generate-feedback idempotente:**
   ```sql
   -- No início da Edge Function:
   -- Verificar se feedback já existe para este session_id
   -- Se sim, retornar o existente
   -- Se não, gerar novo
   ```

4. **Implementar scoring incremental por turno (FoloUp pattern).** A cada turno do usuário, o agent salva uma análise parcial (evidência):
   ```python
   # Tabela session_evidences ou similar
   {
       "session_id": "xxx",
       "turn_number": 5,
       "keywords_detected": ["orçamento", "concorrente"],
       "spin_stage": "implication",
       "coaching_quality": 0.7,
       "objection_handled": false
   }
   ```
   No final, a Edge Function compõe o feedback usando evidências parciais + transcript completo. Se o transcript está incompleto, as evidências parciais são suficientes para feedback básico.

5. **Migrar schema de feedback para categoryScores (ai_mock_interviews pattern):**
   ```json
   {
     "categoryScores": [
       { "name": "Rapport Building", "score": 72, "comment": "..." },
       { "name": "SPIN Selling", "score": 45, "comment": "..." },
       { "name": "Objection Handling", "score": 60, "comment": "..." },
       { "name": "Closing Technique", "score": 30, "comment": "..." }
     ],
     "strengths": ["..."],
     "areasForImprovement": ["..."],
     "overallScore": 52
   }
   ```
   Score 0-100 por categoria é mais granular e acionável que rubrica de 4 níveis.

6. **Adicionar retry com backoff exponencial na Edge Function.** Se Claude API falha, tentar novamente (3 tentativas com backoff). Se falha 3x, salvar status `feedback_pending` para retry manual ou via cron.

7. **Implementar webhook de room_finished como safety net definitiva.** Mesmo que o agent crashe, o LiveKit Server emite webhook quando a room fecha. Configurar handler que verifica se feedback existe e, se não, dispara geração.

**Referências de pattern:**
- FoloUp: scoring incremental por resposta
- ai_mock_interviews: categoryScores schema com 0-100
- Docs: `docs.livekit.io/agents/logic/sessions` (on_session_end callback)
- `python-agents-examples/docs/examples/timed_agent_transcript.py`: transcript com timestamps
- `python-agents-examples/docs/examples/structured_output.py`: JSON output para scoring

---

## Mudanças Transversais (aplicam a todos os 5 problemas)

### Migrar comunicação HTTP > canais nativos LiveKit

Substituir todas as chamadas HTTP (aiohttp > Supabase) que comunicam agent <-> frontend por:
- **RPC** para ações pontuais (enviar coaching hint, disparar feedback)
- **Participant Attributes** para estado contínuo (termômetro, emoção, estágio SPIN)
- **Text Streams** para dados contínuos (transcript em tempo real)

### Extrair prompts para YAML

Mover todos os prompts inline do main.py e ai_coach.py para arquivos YAML separados por persona/cenário. Pattern do medical_office_triage. Benefícios: mais fácil de iterar, testar, e versionar prompts sem mexer em código.

### Criar tabela session_evidences no Supabase

Nova tabela para armazenar análises parciais por turno. Schema mínimo:
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

Essa tabela alimenta tanto o coaching em tempo real (Problema 2) quanto o feedback robusto (Problema 5).

---

## Ordem de Implementação Sugerida

A ordem abaixo otimiza para dependências — cada etapa desbloqueia as seguintes:

1. **Mudanças transversais** (RPC, participant attributes, YAML prompts, tabela session_evidences)
2. **Problema 3** (shutdown hooks + graceful end) — base para feedback confiável
3. **Problema 1** (latência) — preemptive generation, instant connect, verificar Hedra
4. **Problema 2** (coach just-in-time) — depende de RPC e participant attributes
5. **Problema 4** (emoção + termômetro) — depende de participant attributes
6. **Problema 5** (feedback) — depende de shutdown hooks, session_evidences, e novo schema

---

## Regras de Implementação

- Não peça confirmação antes de alterar arquivos. Implemente direto.
- Se main.py ou ai_coach.py ficarem grandes demais, quebre em módulos menores.
- Mantenha compatibilidade com o que já funciona. Não reescreva do zero.
- Priorize mudanças de menor risco (configurações, flags) antes de refatorações grandes.
- Se encontrar bugs ou inconsistências no código existente, corrija e documente.
- Use tipos TypeScript estritos no frontend.
- Adicione comentários apenas onde a decisão de design não é óbvia.
- Commits atômicos: um commit por problema resolvido.
