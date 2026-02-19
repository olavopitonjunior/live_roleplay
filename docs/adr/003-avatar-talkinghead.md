# ADR-003: Avatar 3D com TalkingHead.js

## Status

**Proposto** — Data: 2026-02-17

## Contexto

O sistema atual utiliza **Hedra Character-3** para gerar avatar com lip-sync em tempo real. Embora funcional, a solucao apresenta limitacoes significativas:

- **Expressividade baixa**: Hedra faz apenas lip-sync (sincronizacao labial). Nao ha expressoes faciais emocionais (surpresa, frustacao, empatia), o que reduz a imersao do treinamento
- **Problemas de carregamento**: Hedra tem timeout de ~6s quando ociosa, causando delays perceptiveis na inicializacao do avatar
- **Simli como alternativa**: Simli Trinity-1 oferece melhor visual, mas tambem e limitado em expressividade emocional e adiciona dependencia de infra externa

Para uma plataforma de treinamento de vendas, a **expressividade facial do avatar e critica**: o usuario precisa perceber visualmente as emocoes do cliente (frustacao, interesse, duvida) para treinar leitura de linguagem corporal.

## Decisao

Adotar **TalkingHead.js** como solucao de avatar para medio prazo, com **NVIDIA Audio2Face (A2F)** como upgrade de longo prazo.

**TalkingHead.js** e uma biblioteca JavaScript open-source que renderiza avatares 3D estilizados no navegador usando Three.js/WebGL, com suporte a:

- 52 blendshapes (ARKit compatible) para expressoes faciais completas
- Lip-sync via audio (HeadAudio) diretamente no browser
- Animacoes de idle, gestos e emocoes pre-definidas
- Avatares ReadyPlayerMe ou custom GLTF/GLB

### Tabela Comparativa de Opcoes

| Opcao | Visual | Expressividade | Custo/min | Latencia |
|-------|--------|---------------|-----------|----------|
| **Hedra** (atual) | Medio (video gerado) | Baixa (lip-sync only) | $0.05 | <100ms |
| **Simli Trinity-1** | Alto (video gerado) | Media (lip-sync + basico) | $0.01 | <300ms |
| **TalkingHead.js** (proposto) | Medio (3D estilizado) | Alta (52 blendshapes) | $0.00 | ~0ms |
| **A2F + Three.js** (longo prazo) | Medio-Alto (3D realista) | Muito Alta (AI-driven) | $0.01-0.02 | +30-100ms |
| **MetaHuman Pixel Stream** | Fotorrealista | Muito Alta | $0.50-1.00 | +100-200ms |

## Alternativas Consideradas

### Opcao A — Manter Hedra (status quo)

- Pipeline ja integrado e funcionando
- **Adiado**: Expressividade insuficiente para treinamento de vendas. Timeout de ~6s prejudica UX. Custo de $0.05/min acumula (~$0.15/sessao)

### Opcao B — Simli Trinity-1

- Video gerado com qualidade superior ao Hedra
- Custo mais baixo ($0.01/min)
- **Rejeitado para medio prazo**: Ainda depende de infra externa (API Simli). Expressividade limitada comparada a solucoes com blendshapes. Latencia adicional de rede

### Opcao C — TalkingHead.js (escolhida para medio prazo)

- Renderizacao 100% no browser (zero infra)
- 52 blendshapes para expressoes faciais completas
- Open-source, utilizado por MIT e Harvard em projetos de pesquisa
- Integracao com emotion analyzer existente para mapear emocoes detectadas em expressoes faciais

### Opcao D — NVIDIA Audio2Face (A2F) + Three.js (longo prazo)

- IA para gerar animacoes faciais a partir de audio
- Expressividade superior ao lip-sync baseado em regras
- **Reservado para longo prazo**: Requer GPU para inferencia A2F, aumentando complexidade e custo de infra

### Opcao E — MetaHuman Pixel Streaming

- Qualidade fotorrealista maxima (Unreal Engine)
- **Rejeitado**: Custo proibitivo ($0.50-1.00/min). Requer GPU dedicada para rendering server-side. Latencia de +100-200ms pela transmissao de video. Complexidade de deploy muito alta

## Consequencias

### Positivas

- **Custo zero de infra**: Toda a renderizacao acontece no browser do usuario. Nao ha servicos externos, APIs ou GPUs necessarias
- **Alta expressividade**: 52 blendshapes permitem representar emocoes complexas (frustacao, interesse, duvida, surpresa, empatia) essenciais para treinamento de vendas
- **Latencia zero de rede**: Renderizacao local elimina qualquer latencia de rede para o avatar. Audio e processado diretamente no browser
- **Integracao com emotion analyzer**: O `emotion_analyzer.py` ja detecta emocoes via GPT-4o-mini. Essas emocoes podem ser mapeadas diretamente para blendshapes do TalkingHead.js
- **Validado academicamente**: Utilizado por MIT Media Lab e Harvard em projetos de pesquisa sobre agentes conversacionais
- **Open-source**: Codigo aberto, sem vendor lock-in, possibilidade de customizacao completa

### Negativas

- **Visual estilizado (nao fotorrealista)**: Avatares 3D no estilo ReadyPlayerMe tem aparencia de "jogo", nao de pessoa real. Pode reduzir imersao para alguns usuarios
- **Performance em mobile variavel**: Renderizacao WebGL em dispositivos moveis antigos pode ter baixo FPS ou consumo elevado de bateria
- **Curva de aprendizado**: Integracao com Three.js e configuracao de blendshapes requer conhecimento de 3D no browser

### Riscos

- **Lip-sync por HeadAudio menos preciso**: O lip-sync baseado em analise de audio no browser (HeadAudio) e menos preciso que solucoes AI-driven como NVIDIA A2F. Pode haver dessincronizacao perceptivel em falas rapidas
- **Compatibilidade WebGL**: Navegadores mais antigos ou dispositivos com GPU integrada fraca podem nao suportar WebGL adequadamente
- **Uncanny valley invertido**: Visual muito estilizado pode gerar desconexao se o audio for muito realista (voz humana + avatar cartoon)

## Referencias

- [TalkingHead.js — GitHub](https://github.com/nickvdw/talkinghead)
- [NVIDIA Audio2Face 3D (A2F-3D) — GitHub](https://github.com/NVIDIA/audio2face-3d)
- [ReadyPlayerMe — Avatares 3D](https://readyplayer.me/)
- [ARKit Blendshapes Reference](https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation)
- [ADR-002 — Stack Modular](002-stack-modular.md)
