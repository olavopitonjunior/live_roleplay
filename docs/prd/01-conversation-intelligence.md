# PRD 01: Conversation Intelligence

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Em Desenvolvimento |
| **Fase** | 1A - Foundation |
| **Prioridade** | P0 (Critica) |
| **Dependencias** | Nenhuma |
| **Estimativa** | 3-4 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
O feedback atual do Live Roleplay e apenas **qualitativo** - um resumo gerado pelo Claude sobre a performance geral. Usuarios nao tem dados acionaveis sobre **como** se comportaram durante a conversa.

### Oportunidade
Plataformas lideres como Gong e Clari cobram milhares de dolares por conversation intelligence. Podemos oferecer metricas similares integradas ao roleplay, diferenciando nosso produto e justificando upgrade para tiers pagos.

### Hipotese
> "Vendedores que recebem feedback quantitativo sobre talk ratio, hesitacoes e tratamento de objecoes melhoram 30% mais rapido que os que recebem apenas feedback qualitativo."

---

## 2. Objetivos (OKRs)

### Objetivo
Fornecer metricas quantitativas de conversa que permitam usuarios identificar pontos especificos de melhoria.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | 100% das sessoes com metricas coletadas | Semana 2 |
| KR2 | Feedback exibindo 5+ metricas | Semana 3 |
| KR3 | NPS do feedback > 40 | Semana 4 |
| KR4 | 70% dos usuarios clicam em "ver metricas" | Semana 4 |

---

## 3. User Stories

### US-01: Ver Talk Ratio
**Como** vendedor em treinamento
**Quero** ver quanto tempo falei vs quanto o avatar falou
**Para** melhorar minha escuta ativa

**Criterios de Aceite**:
- [ ] Exibe percentual de tempo do usuario
- [ ] Exibe percentual de tempo do avatar
- [ ] Mostra barra visual comparativa
- [ ] Indica se esta no range ideal (40-60%)
- [ ] Mostra dica de melhoria se fora do range

### US-02: Ver Tempo de Resposta
**Como** vendedor em treinamento
**Quero** ver quanto tempo levei para responder perguntas
**Para** parecer mais preparado e confiante

**Criterios de Aceite**:
- [ ] Exibe tempo medio de resposta em segundos
- [ ] Exibe tempo maximo de resposta
- [ ] Conta hesitacoes (pausas > 3s)
- [ ] Lista momentos de hesitacao com timestamp

### US-03: Ver Tracking de Objecoes
**Como** vendedor em treinamento
**Quero** saber quais objecoes foram levantadas e se as tratei
**Para** focar nos pontos que preciso melhorar

**Criterios de Aceite**:
- [ ] Lista objecoes levantadas pelo avatar
- [ ] Marca cada objecao como tratada/ignorada
- [ ] Mostra trecho do transcript onde foi tratada
- [ ] Calcula taxa de tratamento (%)

### US-04: Ver Filler Words
**Como** vendedor em treinamento
**Quero** saber quantas palavras de preenchimento usei
**Para** soar mais confiante e profissional

**Criterios de Aceite**:
- [ ] Conta palavras como "hmm", "entao", "tipo", "ne", "assim"
- [ ] Lista as mais frequentes
- [ ] Compara com media da base de usuarios

### US-05: Comparar com Benchmark
**Como** vendedor em treinamento
**Quero** ver como minhas metricas se comparam com outros usuarios
**Para** entender onde estou na curva de aprendizado

**Criterios de Aceite**:
- [ ] Mostra percentil do usuario em cada metrica
- [ ] Exibe "Voce esta melhor que X% dos usuarios"
- [ ] Destaca metricas acima/abaixo da media

### US-06: Ver Timeline de Sentimento
**Como** gestor
**Quero** ver como o sentimento evoluiu durante a conversa
**Para** identificar momentos criticos

**Criterios de Aceite**:
- [ ] Grafico de linha com eixo X = tempo
- [ ] Duas linhas: sentimento user e avatar
- [ ] Hover mostra trecho do transcript
- [ ] Destaca pontos de virada

---

## 4. Requisitos Funcionais

### RF-01: Captura de Metricas no Agent

O agent Python deve capturar as seguintes metricas durante a sessao:

```python
session_metrics = {
    "talk_ratio": {
        "user_time_ms": int,      # Tempo total de fala do usuario
        "avatar_time_ms": int,    # Tempo total de fala do avatar
        "ratio": float            # user_time / total_time
    },
    "response_latency": {
        "measurements": [         # Lista de cada resposta
            {"after_avatar_ms": int, "user_started_ms": int}
        ],
        "avg_ms": float,
        "max_ms": int,
        "hesitation_count": int   # Respostas > 3000ms
    },
    "objections": {
        "raised": [               # Objecoes levantadas
            {
                "id": str,
                "text": str,
                "timestamp_ms": int
            }
        ],
        "addressed": [str],       # IDs das tratadas
        "ignored": [str]          # IDs das ignoradas
    },
    "filler_words": {
        "total_count": int,
        "by_word": {
            "hmm": int,
            "entao": int,
            "tipo": int,
            "ne": int,
            "assim": int
        }
    },
    "interruptions": {
        "user_interrupted_avatar": int,
        "avatar_interrupted_user": int
    },
    "sentiment_timeline": [
        {
            "timestamp_ms": int,
            "user_sentiment": str,    # confident, hesitant, defensive, engaged
            "avatar_sentiment": str,  # receptive, neutral, hesitant, frustrated
            "trigger": str            # Evento que causou mudanca
        }
    ]
}
```

### RF-02: Persistencia de Metricas

- Adicionar campo `metrics` (JSONB) na tabela `sessions`
- Agent salva metricas junto com transcript ao final
- Metricas disponiveis para query agregada

### RF-03: Calculo de Benchmarks

- Edge function que calcula percentis por metrica
- Atualiza cache diariamente
- Retorna percentil do usuario para cada metrica

### RF-04: Visualizacao no Feedback

Novos componentes na pagina de feedback:

1. **MetricsOverview**: Cards resumindo principais metricas
2. **TalkRatioChart**: Barra horizontal comparativa
3. **ObjectionsTracker**: Lista de objecoes com status
4. **SentimentTimeline**: Grafico de linha temporal
5. **BenchmarkComparison**: Comparativo com base de usuarios

### RF-05: Deteccao de Objecoes

- Cenarios definem keywords de objecao no campo `objections`
- Agent monitora fala do avatar por keywords
- Marca objecao como levantada quando detectada
- Verifica resposta do user nos proximos 60s
- Se user aborda tema, marca como tratada
- Se user muda de assunto, marca como ignorada

### RF-06: Deteccao de Filler Words

Lista de palavras a detectar (PT-BR):
```
hmm, hm, eh, ah, entao, tipo, ne, assim, basicamente,
na verdade, digamos, vamos dizer, meio que, sei la
```

Detectar via regex no transcript do usuario.

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Performance
- Captura de metricas nao deve adicionar >50ms de latencia
- Calculo de benchmarks em <500ms
- Renderizacao de graficos em <200ms

### RNF-02: Precisao
- Talk ratio com precisao de +/- 5%
- Deteccao de objecoes com recall > 80%
- Deteccao de filler words com precision > 90%

### RNF-03: Privacidade
- Metricas agregadas para benchmark sao anonimizadas
- Dados individuais visiveis apenas para o proprio usuario
- Gestores veem apenas metricas de sua equipe

---

## 6. Especificacao Tecnica

### 6.1 Modificacoes no Agent (main.py)

```python
# Novo: classe para coleta de metricas
class MetricsCollector:
    def __init__(self, scenario: dict):
        self.scenario = scenario
        self.metrics = {
            "talk_ratio": {"user_time_ms": 0, "avatar_time_ms": 0},
            "response_latency": {"measurements": []},
            "objections": {"raised": [], "addressed": [], "ignored": []},
            "filler_words": {"total_count": 0, "by_word": {}},
            "interruptions": {"user_interrupted_avatar": 0, "avatar_interrupted_user": 0},
            "sentiment_timeline": []
        }
        self.last_speaker_end_ms = 0
        self.pending_objection = None

    def on_user_speech(self, text: str, duration_ms: int, timestamp_ms: int):
        """Chamado quando usuario termina de falar"""
        self.metrics["talk_ratio"]["user_time_ms"] += duration_ms

        # Calcular latencia de resposta
        if self.last_speaker_end_ms > 0:
            latency = timestamp_ms - self.last_speaker_end_ms
            self.metrics["response_latency"]["measurements"].append({
                "latency_ms": latency
            })

        # Detectar filler words
        self._detect_filler_words(text)

        # Verificar se tratou objecao pendente
        if self.pending_objection:
            if self._addressed_objection(text, self.pending_objection):
                self.metrics["objections"]["addressed"].append(self.pending_objection["id"])
                self.pending_objection = None

        self.last_speaker_end_ms = timestamp_ms + duration_ms

    def on_avatar_speech(self, text: str, duration_ms: int, timestamp_ms: int):
        """Chamado quando avatar termina de falar"""
        self.metrics["talk_ratio"]["avatar_time_ms"] += duration_ms

        # Detectar objecao levantada
        objection = self._detect_objection(text)
        if objection:
            self.metrics["objections"]["raised"].append({
                "id": objection["id"],
                "text": text,
                "timestamp_ms": timestamp_ms
            })
            self.pending_objection = objection

        self.last_speaker_end_ms = timestamp_ms + duration_ms

    def _detect_filler_words(self, text: str):
        """Conta filler words no texto"""
        filler_patterns = [
            r'\bhmm+\b', r'\behh?\b', r'\bah+\b',
            r'\bentao\b', r'\btipo\b', r'\bne\b', r'\bassim\b',
            r'\bbasicamente\b', r'\bna verdade\b', r'\bdigamos\b',
            r'\bmeio que\b', r'\bsei la\b'
        ]
        text_lower = text.lower()
        for pattern in filler_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                word = matches[0].strip()
                self.metrics["filler_words"]["by_word"][word] = \
                    self.metrics["filler_words"]["by_word"].get(word, 0) + len(matches)
                self.metrics["filler_words"]["total_count"] += len(matches)

    def _detect_objection(self, text: str) -> dict | None:
        """Verifica se avatar levantou objecao do cenario"""
        text_lower = text.lower()
        for objection in self.scenario.get("objections", []):
            keywords = objection.get("keywords", [])
            if any(kw.lower() in text_lower for kw in keywords):
                return objection
        return None

    def _addressed_objection(self, user_text: str, objection: dict) -> bool:
        """Verifica se user tratou a objecao"""
        # Heuristica: se user menciona keywords relacionadas
        response_keywords = objection.get("response_keywords", [])
        text_lower = user_text.lower()
        return any(kw.lower() in text_lower for kw in response_keywords)

    def finalize(self) -> dict:
        """Calcula metricas finais"""
        total_time = (self.metrics["talk_ratio"]["user_time_ms"] +
                     self.metrics["talk_ratio"]["avatar_time_ms"])
        if total_time > 0:
            self.metrics["talk_ratio"]["ratio"] = \
                self.metrics["talk_ratio"]["user_time_ms"] / total_time

        measurements = self.metrics["response_latency"]["measurements"]
        if measurements:
            latencies = [m["latency_ms"] for m in measurements]
            self.metrics["response_latency"]["avg_ms"] = sum(latencies) / len(latencies)
            self.metrics["response_latency"]["max_ms"] = max(latencies)
            self.metrics["response_latency"]["hesitation_count"] = \
                sum(1 for l in latencies if l > 3000)

        # Marcar objecoes nao tratadas como ignoradas
        raised_ids = {o["id"] for o in self.metrics["objections"]["raised"]}
        addressed_ids = set(self.metrics["objections"]["addressed"])
        self.metrics["objections"]["ignored"] = list(raised_ids - addressed_ids)

        return self.metrics
```

### 6.2 Schema do Banco de Dados

```sql
-- Adicionar campo metrics na tabela sessions
ALTER TABLE sessions
ADD COLUMN metrics JSONB;

-- Indice para queries de benchmark
CREATE INDEX idx_sessions_metrics ON sessions USING gin(metrics);

-- Tabela de benchmarks (cache)
CREATE TABLE metric_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_path VARCHAR(100) NOT NULL,  -- ex: "talk_ratio.ratio"
    percentiles JSONB NOT NULL,         -- {p10: x, p25: x, p50: x, p75: x, p90: x}
    sample_size INTEGER NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_path)
);
```

### 6.3 Componentes Frontend

#### MetricsCard.tsx
```typescript
interface MetricsCardProps {
  title: string;
  value: string | number;
  benchmark?: {
    percentile: number;
    isGood: boolean;
  };
  icon: React.ReactNode;
  hint?: string;
}

// Exibe uma metrica individual com comparativo
```

#### TalkRatioChart.tsx
```typescript
interface TalkRatioChartProps {
  userRatio: number;  // 0-1
  idealRange: [number, number];  // [0.4, 0.6]
}

// Barra horizontal com marcacao de zona ideal
```

#### ObjectionsTracker.tsx
```typescript
interface ObjectionsTrackerProps {
  objections: Array<{
    id: string;
    text: string;
    status: 'addressed' | 'ignored';
    timestamp: number;
  }>;
}

// Lista de objecoes com status visual
```

#### SentimentTimeline.tsx
```typescript
interface SentimentTimelineProps {
  timeline: Array<{
    timestamp: number;
    userSentiment: string;
    avatarSentiment: string;
  }>;
  duration: number;
}

// Grafico de linha com duas series
```

---

## 7. UI/UX

### Wireframe: Feedback com Metricas

```
+------------------------------------------------------------------+
|  FEEDBACK DA SESSAO                                    [X] Fechar |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   SCORE GERAL    |  |   TALK RATIO     |  | TEMPO RESPOSTA   | |
|  |      78%         |  |    [====|==]     |  |     1.2s         | |
|  |   +12 pts        |  |     65% voce     |  |   Otimo!         | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  +------------------+  +------------------+  +------------------+ |
|  |   HESITACOES     |  |  FILLER WORDS    |  |    OBJECOES      | |
|  |       3          |  |      12          |  |   2/3 tratadas   | |
|  |   Melhorar       |  |  -5 vs media     |  |     67%          | |
|  +------------------+  +------------------+  +------------------+ |
|                                                                   |
|  TIMELINE DE SENTIMENTO                                           |
|  +--------------------------------------------------------------+ |
|  |     User: ----____----^^^^----                               | |
|  |   Avatar: ____----____----^^^^                               | |
|  |          0:00      1:00      2:00      3:00                  | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  OBJECOES DETALHADAS                                              |
|  +--------------------------------------------------------------+ |
|  | [v] Preco muito alto                                  00:45  | |
|  |     "Voce mencionou o valor agregado, boa abordagem"         | |
|  | [v] Preciso pensar                                    01:30  | |
|  |     "Reconheceu a preocupacao e ofereceu material"           | |
|  | [x] Ja tenho fornecedor                               02:15  | |
|  |     "Nao abordou diretamente, mudou de assunto"              | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  RESUMO QUALITATIVO                                               |
|  +--------------------------------------------------------------+ |
|  | Voce demonstrou bom conhecimento do produto e tratou bem     | |
|  | as objecoes de preco. Ponto de melhoria: quando o cliente    | |
|  | mencionar fornecedor atual, explore mais antes de...         | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  [Novo Treino]                              [Ver Historico]       |
+------------------------------------------------------------------+
```

### Estados de UI

1. **Loading**: Skeleton enquanto carrega metricas
2. **Parcial**: Se algumas metricas falharem, mostrar as disponiveis
3. **Comparativo**: Highlight verde/vermelho para acima/abaixo da media
4. **Detalhado**: Click expande metrica com mais detalhes

---

## 8. Metricas de Sucesso

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| % sessoes com metricas | 0% | 100% | Query sessions.metrics IS NOT NULL |
| Cliques em "ver metricas" | N/A | 70% | Analytics frontend |
| NPS do feedback | 30 | 45 | Survey pos-feedback |
| Tempo na pagina feedback | 45s | 90s | Analytics frontend |
| Melhoria de score D30 | +10% | +20% | Cohort analysis |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Deteccao de objecoes imprecisa | Media | Medio | Fallback para analise Claude |
| Latencia adicional | Baixa | Alto | Processamento assincrono |
| Dados insuficientes para benchmark | Alta | Baixo | Usar benchmarks de mercado |
| Usuarios ignoram metricas | Media | Medio | Gamificar com badges |

---

## 10. Criterios de Aceite (DoD)

- [ ] Agent coleta todas as metricas definidas
- [ ] Metricas persistidas no banco de dados
- [ ] Frontend exibe 6 metricas com visualizacao
- [ ] Benchmarks calculados e exibidos
- [ ] Testes unitarios para MetricsCollector
- [ ] Testes E2E para fluxo completo
- [ ] Performance dentro dos limites definidos
- [ ] Documentacao da API atualizada

---

## 11. Plano de Rollout

### Semana 1
- Implementar MetricsCollector no agent
- Adicionar campo metrics no schema
- Testes unitarios

### Semana 2
- Integrar coleta no fluxo de sessao
- Implementar Edge Function de benchmarks
- Componentes frontend (sem estilo)

### Semana 3
- Estilizacao dos componentes
- Integracao com pagina de feedback
- Testes E2E

### Semana 4
- Beta com 10% dos usuarios
- Coletar feedback
- Ajustes finais
- Rollout 100%

---

## 12. Apendice

### A. Benchmarks de Referencia (Industria)

| Metrica | Ruim | Ok | Bom | Excelente |
|---------|------|-----|-----|-----------|
| Talk Ratio | >70% | 60-70% | 50-60% | 40-50% |
| Tempo Resposta | >5s | 3-5s | 1-3s | <1s |
| Objecoes Tratadas | <30% | 30-60% | 60-80% | >80% |
| Filler Words/min | >10 | 5-10 | 2-5 | <2 |

Fonte: Gong.io, Clari, analises internas

### B. Palavras de Preenchimento por Idioma

**Portugues (BR)**:
hmm, eh, ah, entao, tipo, ne, assim, basicamente, na verdade, digamos, vamos dizer, meio que, sei la, olha, pois e, ta, bom, certo

**Ingles** (futuro):
um, uh, like, you know, basically, actually, literally, so, well, I mean

### C. Referencias Tecnicas

- [Gong Conversation Intelligence](https://www.gong.io/conversation-intelligence)
- [Clari Copilot Metrics](https://www.clari.com/conversation-intelligence)
- [LiveKit Speech Duration](https://docs.livekit.io/agents/)
