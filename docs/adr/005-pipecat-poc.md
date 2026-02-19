# ADR-005: PoC com Pipecat Framework

## Status

**Proposto** — Data: 2026-02-17

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

## Referencias

- [Pipecat — GitHub](https://github.com/pipecat-ai/pipecat)
- [Pipecat Flows — Documentacao](https://github.com/pipecat-ai/pipecat-flows)
- [LiveKit Transport para Pipecat](https://github.com/pipecat-ai/pipecat/tree/main/src/pipecat/transports/services/livekit)
- [ADR-002 — Stack Modular](002-stack-modular.md)
- [ADR-003 — Avatar TalkingHead.js](003-avatar-talkinghead.md)
- [ADR-004 — AWS Sao Paulo](004-aws-sp-infra.md)
