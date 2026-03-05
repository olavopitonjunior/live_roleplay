# ADR-006: Coach Orchestrator — Unified Coaching Pipeline

## Status

Aceito — Data: 2026-03-04

## Contexto

O sistema de coaching em tempo real estava fragmentado em 3 arquivos independentes:

- `conversation_coach.py` — Deteccao de silencio e hesitacao, hints keyword-based
- `ai_coach.py` — Sugestoes GPT-4o-mini baseadas em contexto conversacional
- Keyword coaching inline em `main.py` — Deteccao de palavras-chave em utterances

Cada modulo mantinha seu proprio estado, timers e logica de envio, resultando em:
1. Mensagens duplicadas ou conflitantes enviadas ao frontend
2. Sem priorizacao — hints de baixa importancia podiam sobrescrever sugestoes criticas
3. Dificuldade de manter estado consistente (SPIN stage, objections, talk ratio)
4. Sem gate para estado do agente — sugestoes chegavam enquanto avatar falava

## Decisao

Unificar toda a logica de coaching em um unico modulo `coach_orchestrator.py` com:

- Classe `CoachOrchestrator` gerenciando estado, analise e envio
- `InjectionQueue` com priorizacao (HIGH > MEDIUM > LOW) e cooldown entre mensagens
- Tracking de `AgentState` para gating — mensagens enfileiradas durante SPEAKING
- Analise paralela: keyword matching sincrono + GPT-4o-mini assincrono
- Estado centralizado: SPIN progress, objections tracking, talk ratio

## Alternativas Consideradas

### Opcao A — Refatorar modulos existentes

- Manter 3 arquivos mas adicionar comunicacao entre eles via events
- Rejeitado: complexidade de sincronizacao, estado duplicado persistiria

### Opcao B — Microservico separado

- Coaching como servico independente consumindo eventos via Redis/NATS
- Rejeitado: over-engineering para o estagio atual, latencia adicional

## Consequencias

### Positivas

- Estado unico e consistente para toda logica de coaching
- Priorizacao inteligente de mensagens via InjectionQueue
- Gate de timing resolvido — coach so envia quando agente nao esta falando
- Menor surface area de codigo (~1 arquivo vs 3)
- Facilidade de adicionar novos tipos de coaching

### Negativas

- Arquivo unico maior (~400 linhas)
- Requer regressao manual (sem testes unitarios para coaching)

### Riscos

- Falha no orchestrator silencia todo o coaching (ponto unico de falha)

## Referencias

- [main.py](../../agent/main.py) — Integracao com o orchestrator
- [coach_orchestrator.py](../../agent/coach_orchestrator.py) — Implementacao
