# PRD 02: Avatar Emocional

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Em Desenvolvimento |
| **Fase** | 1B - Foundation |
| **Prioridade** | P0 (Critica) |
| **Dependencias** | PRD-01 (parcial - sentiment tracking) |
| **Estimativa** | 2 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
O avatar do Live Roleplay atualmente tem **expressao estatica** - apenas faz lip-sync com o audio. Isso reduz o realismo do treino, pois clientes reais demonstram emocoes atraves de expressoes faciais.

### Oportunidade
A API do Simli ja oferece **5 estados emocionais** que nao estamos utilizando. Ativar esse recurso diferencia nosso produto de todos os concorrentes que usam avatares estaticos ou sem avatar.

### Hipotese
> "Vendedores que treinam com avatar emocional responsivo reportam experiencia 40% mais realista e demonstram melhor rapport em calls reais."

---

## 2. Objetivos (OKRs)

### Objetivo
Criar avatar que reage emocionalmente ao contexto da conversa, aumentando realismo e valor de aprendizado.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | Avatar com 5 estados emocionais funcionando | Semana 1 |
| KR2 | Transicoes baseadas em contexto implementadas | Semana 2 |
| KR3 | NPS de "realismo" > 4.0/5.0 em survey | Semana 2 |
| KR4 | 80% dos usuarios notam mudancas de expressao | Semana 2 |

---

## 3. User Stories

### US-01: Ver Avatar Reagir Positivamente
**Como** vendedor em treinamento
**Quero** ver o avatar sorrir quando argumento bem
**Para** saber que estou no caminho certo

**Criterios de Aceite**:
- [ ] Avatar muda para expressao "happy" ao tratar objecao
- [ ] Transicao e suave (nao abrupta)
- [ ] Expressao dura pelo menos 5 segundos
- [ ] EmotionMeter no frontend reflete mudanca

### US-02: Ver Avatar Demonstrar Duvida
**Como** vendedor em treinamento
**Quero** ver o avatar hesitar quando nao respondo bem
**Para** entender que preciso melhorar minha abordagem

**Criterios de Aceite**:
- [ ] Avatar muda para "hesitant" quando objecao nao tratada
- [ ] Transicao ocorre apos 30s sem tratamento
- [ ] Expressao e sutil (nao exagerada)

### US-03: Ver Avatar Frustrado
**Como** vendedor em treinamento
**Quero** ver o avatar demonstrar frustracao em cenarios ruins
**Para** aprender a evitar situacoes que irritam clientes

**Criterios de Aceite**:
- [ ] Avatar muda para "frustrated" apos 2+ objecoes ignoradas
- [ ] Transicao e gradual (hesitant -> frustrated)
- [ ] Feedback explica motivo da frustracao

### US-04: Entender Razao da Emocao
**Como** vendedor em treinamento
**Quero** entender por que o avatar mudou de expressao
**Para** conectar minha acao com a reacao

**Criterios de Aceite**:
- [ ] Tooltip/hint aparece ao mudar de estado
- [ ] Hint e contextual ("Avatar gostou da sua resposta sobre X")
- [ ] Timeline no feedback mostra motivos de cada mudanca

### US-05: Ver Timeline Emocional
**Como** gestor
**Quero** ver a evolucao emocional do avatar durante a sessao
**Para** avaliar o rapport do vendedor

**Criterios de Aceite**:
- [ ] Grafico de linha no feedback
- [ ] Eixo X = tempo, Eixo Y = estado emocional
- [ ] Hover mostra trecho do transcript
- [ ] Marca momentos de transicao

---

## 4. Requisitos Funcionais

### RF-01: Estados Emocionais

Mapeamento de estados do produto para Simli API:

| Estado Produto | Simli Emotion ID | Trigger | Descricao Visual |
|----------------|------------------|---------|------------------|
| `happy` | `happy_0` | Objecao tratada, boa pergunta | Sorriso sutil, olhos engajados |
| `receptive` | `happy_0` (leve) | User confiante, bom argumento | Expressao aberta, acenos |
| `neutral` | `neutral_0` | Inicio, transicoes | Atencao neutra |
| `surprised` | `surprised_0` | Dado inesperado, pergunta boa | Sobrancelhas levantadas |
| `hesitant` | `sad_0` (leve) | Objecao pendente > 30s | Leve franzir, olhar para baixo |
| `frustrated` | `angry_0` (leve) | 2+ objecoes ignoradas | Suspiro, tensao facial |

### RF-02: Logica de Transicao

```python
class EmotionEngine:
    """Motor de emocoes do avatar baseado em contexto"""

    def __init__(self):
        self.current_emotion = "neutral"
        self.emotion_history = []
        self.context = {
            "ignored_objections": 0,
            "addressed_objections": 0,
            "pending_objection": None,
            "pending_objection_time": 0,
            "user_sentiment": "neutral",
            "last_user_action": None
        }

    def update_context(self, event: str, data: dict):
        """Atualiza contexto com evento"""
        if event == "objection_raised":
            self.context["pending_objection"] = data
            self.context["pending_objection_time"] = time.time()

        elif event == "objection_addressed":
            self.context["pending_objection"] = None
            self.context["addressed_objections"] += 1
            self.context["last_user_action"] = "addressed_objection"

        elif event == "objection_ignored":
            self.context["pending_objection"] = None
            self.context["ignored_objections"] += 1

        elif event == "good_question":
            self.context["last_user_action"] = "good_question"

        elif event == "user_sentiment_change":
            self.context["user_sentiment"] = data["sentiment"]

    def calculate_emotion(self) -> tuple[str, str]:
        """Calcula emocao atual e motivo"""

        # Prioridade 1: Reacao a acao positiva recente
        if self.context["last_user_action"] == "addressed_objection":
            self.context["last_user_action"] = None
            return ("happy", "Voce tratou bem a objecao!")

        if self.context["last_user_action"] == "good_question":
            self.context["last_user_action"] = None
            return ("surprised", "Boa pergunta!")

        # Prioridade 2: Frustracao por objecoes ignoradas
        if self.context["ignored_objections"] >= 2:
            return ("frustrated", "Cliente frustrado - objecoes ignoradas")

        # Prioridade 3: Hesitacao por objecao pendente
        if self.context["pending_objection"]:
            elapsed = time.time() - self.context["pending_objection_time"]
            if elapsed > 30:
                return ("hesitant", "Cliente esperando resposta sobre: " +
                       self.context["pending_objection"]["description"][:50])

        # Prioridade 4: Reagir ao sentimento do usuario
        user_sent = self.context["user_sentiment"]
        if user_sent == "confident":
            return ("receptive", "Cliente engajado com sua confianca")
        if user_sent == "defensive":
            return ("neutral", "Mantendo neutralidade")

        # Default
        return ("neutral", None)

    def get_simli_emotion_id(self, emotion: str) -> str:
        """Converte estado para ID do Simli"""
        mapping = {
            "happy": "happy_0",
            "receptive": "happy_0",  # Variacao mais leve
            "neutral": "neutral_0",
            "surprised": "surprised_0",
            "hesitant": "sad_0",
            "frustrated": "angry_0"
        }
        return mapping.get(emotion, "neutral_0")
```

### RF-03: Integracao com Simli

```python
# No main.py, apos cada fala do usuario
async def process_user_input(self, text: str, duration_ms: int):
    # ... logica existente ...

    # Atualizar contexto de emocao
    self.emotion_engine.update_context("user_speech", {
        "text": text,
        "duration_ms": duration_ms
    })

    # Calcular nova emocao
    new_emotion, reason = self.emotion_engine.calculate_emotion()

    # Aplicar se mudou
    if new_emotion != self.current_avatar_emotion:
        simli_id = self.emotion_engine.get_simli_emotion_id(new_emotion)
        await self.simli_session.set_emotion(simli_id)

        # Notificar frontend
        await self.send_data_channel({
            "type": "emotion",
            "value": new_emotion,
            "reason": reason
        })

        # Registrar para timeline
        self.emotion_engine.emotion_history.append({
            "timestamp_ms": self.session_time_ms,
            "emotion": new_emotion,
            "reason": reason
        })

        self.current_avatar_emotion = new_emotion
```

### RF-04: Feedback Visual no Frontend

```typescript
// EmotionMeter.tsx - Componente existente, aprimorado
interface EmotionMeterProps {
  currentEmotion: AvatarEmotion;
  reason?: string;
  showHint?: boolean;
}

type AvatarEmotion = 'happy' | 'receptive' | 'neutral' | 'surprised' | 'hesitant' | 'frustrated';

const emotionConfig = {
  happy: { icon: '😊', color: 'green', label: 'Satisfeito' },
  receptive: { icon: '👂', color: 'blue', label: 'Receptivo' },
  neutral: { icon: '😐', color: 'gray', label: 'Neutro' },
  surprised: { icon: '😮', color: 'yellow', label: 'Interessado' },
  hesitant: { icon: '🤔', color: 'orange', label: 'Com duvidas' },
  frustrated: { icon: '😤', color: 'red', label: 'Frustrado' }
};
```

### RF-05: Timeline de Emocoes no Feedback

```typescript
// EmotionTimeline.tsx - Novo componente
interface EmotionTimelineProps {
  history: Array<{
    timestamp_ms: number;
    emotion: AvatarEmotion;
    reason: string;
  }>;
  totalDuration: number;
}

// Renderiza grafico de linha mostrando evolucao
// Hover em ponto mostra reason
// Click navega para trecho no transcript
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Latencia
- Mudanca de emocao aplicada em <500ms apos trigger
- Nao deve causar "flicker" no avatar

### RNF-02: Naturalidade
- Transicoes devem ser graduais, nao abruptas
- Emocao deve durar minimo 5s antes de mudar novamente
- Evitar mudancas rapidas demais (debounce)

### RNF-03: Sutileza
- Expressoes nao devem ser exageradas/cartunescas
- Manter profissionalismo mesmo em "frustrated"

---

## 6. Especificacao Tecnica

### 6.1 Verificar API Simli

Antes de implementar, verificar com Simli:

```python
# Testar se set_emotion funciona em runtime
await simli_session.set_emotion("happy_0")

# Verificar emocoes disponiveis
available_emotions = await simli_api.list_emotions(face_id=SIMLI_FACE_ID)

# Verificar se Trinity faces suportam todas emocoes
# Nota: Alguns faces podem ter subset de emocoes
```

### 6.2 Fallback se Simli Nao Suportar

Se a API nao suportar mudanca de emocao em runtime:

1. Enviar estado emocional via data channel
2. Frontend exibe indicador visual separado do avatar
3. Log para analytics mesmo sem visual

```python
# Fallback: apenas notificar frontend
if not self.simli_supports_runtime_emotion:
    await self.send_data_channel({
        "type": "emotion",
        "value": new_emotion,
        "reason": reason,
        "visual_only": True  # Indica que avatar nao mudou
    })
```

### 6.3 Schema de Dados

```sql
-- Adicionar campo emotion_timeline no metrics da sessao
-- Ja contemplado no PRD-01, estrutura:

{
  "sentiment_timeline": [
    {
      "timestamp_ms": 45000,
      "avatar_emotion": "happy",
      "user_sentiment": "confident",
      "reason": "Tratou objecao de preco"
    }
  ]
}
```

### 6.4 Componentes Frontend

#### EmotionIndicator.tsx
```typescript
// Indicador visual do estado atual
// Posicao: canto inferior do avatar
// Animacao suave de transicao
```

#### EmotionHint.tsx
```typescript
// Toast/tooltip que aparece ao mudar de estado
// Auto-dismiss apos 3s
// Posicao: abaixo do avatar
```

#### EmotionTimelineChart.tsx
```typescript
// Grafico para pagina de feedback
// Biblioteca: Recharts ou similar
// Interativo com hover/click
```

---

## 7. UI/UX

### Wireframe: Avatar com Indicador de Emocao

```
+------------------------------------------+
|                                          |
|                                          |
|           [AVATAR VIDEO]                 |
|                                          |
|                                          |
|    +----------------------------------+  |
|    |  😊 Satisfeito                   |  |
|    |  "Boa resposta sobre o preco!"   |  |
|    +----------------------------------+  |
|                                          |
+------------------------------------------+
|  [Mic] [Encerrar]            02:45      |
+------------------------------------------+
```

### Wireframe: Timeline no Feedback

```
+----------------------------------------------------------+
|  EVOLUCAO EMOCIONAL DO CLIENTE                           |
+----------------------------------------------------------+
|                                                          |
|  😊 |          ****                    ****              |
|  😐 | ****         ****           ****     ****          |
|  🤔 |     ****          ****                    ****     |
|  😤 |                        ***                         |
|     +----------------------------------------------------+
|       0:00    0:30    1:00    1:30    2:00    2:30       |
|                                                          |
|  [Ponto em destaque]                                     |
|  01:15 - Cliente ficou hesitante                         |
|  Motivo: Objecao de prazo nao foi respondida             |
|  "Preciso disso para semana que vem..."                  |
+----------------------------------------------------------+
```

### Cores e Semantica

| Emocao | Cor | Significado para Usuario |
|--------|-----|-------------------------|
| happy | Verde | Voce esta indo bem! |
| receptive | Azul | Cliente aberto a ouvir |
| neutral | Cinza | Momento neutro |
| surprised | Amarelo | Voce surpreendeu positivamente |
| hesitant | Laranja | Atencao - cliente com duvidas |
| frustrated | Vermelho | Alerta - cliente irritado |

---

## 8. Metricas de Sucesso

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Usuarios que notam mudanca | 0% | 80% | Survey pos-sessao |
| Score de "realismo" | 3.2/5 | 4.0/5 | Survey pos-sessao |
| Tempo medio de avatar "happy" | N/A | >30% | Analytics |
| Sessoes com avatar frustrado | N/A | <20% | Analytics |
| NPS geral | 35 | 45 | Survey mensal |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Simli nao suporta runtime emotion | Media | Alto | Fallback visual no frontend |
| Expressoes parecem exageradas | Media | Medio | Usar variantes "leves" |
| Usuarios nao percebem mudancas | Media | Medio | Hint explicito + tutorial |
| Logica de transicao imprecisa | Alta | Medio | Iterar com feedback users |
| Latencia na mudanca | Baixa | Medio | Pre-carregar estados |

---

## 10. Criterios de Aceite (DoD)

- [ ] EmotionEngine implementado e testado
- [ ] Integracao com Simli funcional (ou fallback)
- [ ] Frontend exibe indicador de emocao
- [ ] Hints aparecem ao mudar de estado
- [ ] Timeline de emocoes no feedback
- [ ] Debounce de 5s entre mudancas
- [ ] Testes E2E para fluxo de emocao
- [ ] Documentacao atualizada

---

## 11. Plano de Rollout

### Semana 1
- Testar API Simli para emocoes
- Implementar EmotionEngine
- Integrar com agent
- Componente EmotionIndicator

### Semana 2
- Componente EmotionHint
- Timeline no feedback
- Testes E2E
- Beta com 20% usuarios
- Ajustes finais
- Rollout 100%

---

## 12. Apendice

### A. Simli Emotions Reference

Documentacao oficial: https://docs.simli.com/emotions

Emocoes disponiveis (verificar por face):
- `happy_0`, `happy_1`, `happy_2`
- `sad_0`, `sad_1`
- `angry_0`, `angry_1`
- `surprised_0`
- `neutral_0`

### B. Pesquisa: Emocoes em Vendas

Estudos mostram que vendedores de alta performance:
- Mantem cliente em estado "receptivo" 60%+ do tempo
- Detectam frustracao em <30s e ajustam abordagem
- Usam rapport para criar conexao emocional

Fonte: Gong.io, HubSpot Research

### C. Alternativas Consideradas

1. **Apenas indicador visual**: Mais simples, mas menos impactante
2. **Emocao via audio apenas**: Simli pode variar tom, mas menos perceptivel
3. **Avatar completo animado**: Muito caro/complexo para MVP

Decisao: Avatar com emocao facial + indicador visual (melhor custo-beneficio)
