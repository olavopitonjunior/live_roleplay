# ADR-001: Migracao para OpenAI Realtime API

## Status

**Aceito** — Data: 2026-02-13

## Contexto

O projeto inicialmente utilizava o Gemini Live como pipeline de voz em tempo real para as sessoes de roleplay de treinamento de vendas em PT-BR. Durante o desenvolvimento e testes iniciais, o Gemini Live apresentou problemas criticos de estabilidade:

- **Bug de proatividade**: O modelo iniciava falas espontaneamente, quebrando o fluxo natural de roleplay onde o avatar deve reagir ao usuario
- **Depreciacao de modelo**: O `gemini-2.0-flash-live-001` foi depreciado pela Google, gerando incerteza sobre continuidade
- **Instabilidade geral**: Desconexoes frequentes e comportamento inconsistente em producao

A plataforma necessitava de um pipeline de voz estavel e confiavel para sessoes de treinamento de vendas em portugues brasileiro, onde interrupcoes ou comportamentos inesperados comprometem diretamente a experiencia de aprendizado.

## Decisao

Migrar para a **OpenAI Realtime API** (`gpt-4o-realtime-preview`) como modelo unificado de STT + LLM + TTS.

A OpenAI Realtime API oferece um pipeline de voz integrado onde um unico modelo processa audio de entrada (STT), gera resposta (LLM) e sintetiza audio de saida (TTS), tudo em uma unica chamada WebSocket. Isso simplifica drasticamente a arquitetura em comparacao a pipelines modulares com multiplos servicos.

A integracao foi feita via **LiveKit Agents SDK** com o plugin `openai` para Realtime API e o plugin `hedra` para lip-sync do avatar.

## Alternativas Consideradas

### Opcao A — Manter Gemini Live

- Pipeline existente ja implementado
- **Rejeitado**: Instabilidade critica em producao (bug de proatividade, depreciacao de modelo). Impossivel garantir experiencia confiavel para usuarios

### Opcao B — Gemini Half-Cascade + ElevenLabs TTS

- Usar Gemini apenas para STT + LLM (text output) e ElevenLabs para TTS
- Manteria acesso ao ecossistema Google com TTS de alta qualidade
- **Rejeitado**: Ainda dependente do Gemini para STT/LLM (mesmos riscos de instabilidade). Adiciona complexidade de orquestracao com servico TTS separado. Latencia adicional por hop extra

### Opcao C — OpenAI Realtime API (escolhida)

- Pipeline unificado STT + LLM + TTS em modelo unico
- Suporte nativo no LiveKit Agents SDK
- Modelo estavel em producao (gpt-4o-realtime-preview)

## Consequencias

### Positivas

- **Estabilidade em producao**: Pipeline funcionando de forma confiavel desde 2026-02-13, sem os bugs de proatividade do Gemini
- **Menor latencia**: Resposta em ~300-500ms (modelo unificado, sem hops entre servicos)
- **Arquitetura simplificada**: Um unico servico para todo o pipeline de voz, reduzindo pontos de falha
- **Integracao nativa com LiveKit**: Plugin `openai` do LiveKit Agents SDK com suporte direto a Realtime API

### Negativas

- **Custo elevado**: ~$0.30/min de audio ($0.06 input + $0.24 output), resultando em ~$1.04/sessao de 3 minutos
- **Sem STT otimizado para PT-BR**: O modelo unificado nao permite escolher um STT especializado em portugues brasileiro
- **Opcoes de voz limitadas**: Apenas 5 vozes disponiveis (alloy, echo, fable, onyx, shimmer), sem possibilidade de vozes customizadas
- **Vendor lock-in**: Dependencia total da OpenAI para todo o pipeline de voz

### Riscos

- **Custo escala linearmente**: Com crescimento de usuarios, o custo de audio pode se tornar insustentavel sem otimizacao (ver [ADR-002](002-stack-modular.md))
- **Sem otimizacao por componente**: Impossivel trocar apenas o STT ou TTS individualmente — qualquer mudanca requer migrar todo o pipeline
- **Dependencia de disponibilidade**: Indisponibilidade da OpenAI Realtime API derruba 100% das sessoes

## Referencias

- CHANGELOG.md — Entrada de 2026-02-13 (migracao OpenAI Realtime)
- BUGS.md — Historico de bugs relacionados ao Gemini Live
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [LiveKit Agents SDK — OpenAI Plugin](https://docs.livekit.io/agents)
