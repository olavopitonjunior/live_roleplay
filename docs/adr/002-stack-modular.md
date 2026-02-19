# ADR-002: Pipeline Modular (STT + LLM + TTS) para Reducao de Custo

## Status

**Proposto** — Data: 2026-02-17

## Contexto

A [ADR-001](001-openai-realtime.md) estabeleceu a OpenAI Realtime API como pipeline de voz unificado. Embora estavel, o custo operacional e significativo:

- **Custo por sessao (3 min)**: ~$1.04
- **Composicao**: $0.06/min (input audio) + $0.24/min (output audio) = $0.30/min
- **Projecao**: Com 100 sessoes/dia, o custo mensal de audio seria ~$3.120

Um pipeline modular (STT separado + LLM texto + TTS separado) permite otimizar cada componente individualmente, escolhendo provedores com melhor relacao custo-qualidade para cada etapa. Alem disso, permite usar STT otimizado para PT-BR e vozes TTS mais expressivas.

## Decisao

Construir um **PoC (Proof of Concept)** com pipeline modular usando:

- **STT**: Deepgram Nova-3 (otimizado para PT-BR)
- **LLM**: Gemini 2.5 Flash (modo texto apenas, evitando instabilidade da API Live)
- **TTS**: ElevenLabs Flash v2.5 (baixa latencia, vozes expressivas)

O PoC sera implementado com **Pipecat** como framework de orquestracao (ver [ADR-005](005-pipecat-poc.md)) para comparacao lado a lado com o pipeline atual.

### Tabela Comparativa de Componentes

| Componente | Atual (OpenAI Realtime) | Proposto | Delta de custo |
|------------|------------------------|----------|----------------|
| **STT** | Built-in ($0.06/min) | Deepgram Nova-3 ($0.0043/min) | ~10x mais barato |
| **LLM** | Built-in (incluso no audio) | Gemini 2.5 Flash (texto, ~$0.01-0.02/sessao) | ~8-16x mais barato |
| **TTS** | Built-in ($0.24/min) | ElevenLabs Flash v2.5 ($0.11-0.18/min) / Cartesia Sonic-3 ($0.042/min) | Variavel |

### Estimativa de Custo por Sessao (3 min)

| Pipeline | Custo/sessao | Reducao |
|----------|-------------|---------|
| OpenAI Realtime (atual) | ~$1.04 | — |
| Deepgram + Gemini Flash + ElevenLabs | ~$0.45-0.61 | 41-57% |
| Deepgram + Gemini Flash + Cartesia | ~$0.18-0.22 | 78-82% |

## Alternativas Consideradas

### Opcao A — Manter OpenAI Realtime (status quo)

- Pipeline estavel e simples
- **Adiado**: Custo insustentavel para escala. Nenhuma flexibilidade para otimizar componentes individuais

### Opcao B — OpenAI Whisper + GPT-4o + OpenAI TTS

- Manter ecossistema OpenAI mas com componentes separados
- **Rejeitado**: STT Whisper nao e real-time nativo (batch). Custo do GPT-4o texto ainda elevado comparado ao Gemini Flash. Sem ganho significativo de custo

### Opcao C — Deepgram + Gemini 2.5 Flash + ElevenLabs/Cartesia (escolhida)

- Melhor STT para PT-BR (Deepgram Nova-3)
- LLM texto mais barato e rapido (Gemini Flash)
- TTS com mais opcoes de voz e expressividade
- Reducao de custo de 41-82% dependendo do provedor TTS

## Consequencias

### Positivas

- **Reducao de custo de 41-82%**: De ~$1.04/sessao para $0.18-0.61/sessao dependendo do provedor TTS escolhido
- **STT otimizado para PT-BR**: Deepgram Nova-3 tem modelo dedicado para portugues brasileiro, melhorando transcricao de termos de vendas e girias regionais
- **Mais opcoes de voz**: ElevenLabs oferece centenas de vozes, incluindo vozes em PT-BR. Cartesia oferece clonagem de voz
- **Flexibilidade de componentes**: Possibilidade de trocar qualquer componente (STT, LLM ou TTS) independentemente dos outros
- **Otimizacao por cenario**: Cenarios simples podem usar modelos menores/mais baratos; cenarios complexos podem usar modelos mais capazes

### Negativas

- **Latencia adicional de +200-300ms**: Pipeline modular adiciona 3 hops de rede (STT -> LLM -> TTS) vs 1 hop do OpenAI Realtime, aumentando tempo de resposta de ~300-500ms para ~500-800ms
- **Orquestracao mais complexa**: Necessidade de gerenciar 3 servicos independentes, com tratamento de erros, reconexao e buffering entre componentes
- **Mais pontos de falha**: Falha em qualquer componente interrompe o pipeline inteiro

### Riscos

- **Gemini Live API instavel**: Utilizar Gemini **apenas em modo texto** para evitar os problemas de estabilidade documentados na ADR-001. Nao usar Gemini Live/audio
- **Complexidade de integracao**: Pipeline com 3 servicos requer orquestracao cuidadosa de buffers de audio, cancelamento de fala (barge-in) e sincronizacao de estados
- **Qualidade de TTS variavel**: Vozes em PT-BR de provedores TTS podem ter sotaque ou entonacao nao naturais — necessario teste extensivo

## Referencias

- [Deepgram Nova-3 Pricing](https://deepgram.com/pricing)
- [Google Gemini 2.5 Flash Pricing](https://ai.google.dev/pricing)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [Cartesia Sonic Pricing](https://cartesia.ai/pricing)
- [ADR-001 — OpenAI Realtime](001-openai-realtime.md)
- [ADR-005 — PoC Pipecat](005-pipecat-poc.md)
