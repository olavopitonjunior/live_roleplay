# PRD 07: Advanced AI

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Visao Futura |
| **Fase** | 5 - Advanced AI |
| **Prioridade** | P3 (Futura) |
| **Dependencias** | Todas as fases anteriores |
| **Estimativa** | 12+ semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
O Live Roleplay atual e limitado a **apenas voz**. Nao analisa video/expressoes do usuario, nao permite treino via telefone, e nao aproveita dados de top performers para criar avatares mais eficazes.

### Oportunidade
A proxima geracao de sales training sera **multimodal** e **preditiva**. Quem dominar essas tecnologias primeiro tera vantagem competitiva significativa. As APIs ja suportam muito disso (Gemini multimodal, LiveKit telephony).

### Visao
> "Treinar vendedores com AI que ve, ouve, e aprende dos melhores - disponivel em qualquer lugar, a qualquer hora."

---

## 2. Objetivos (OKRs)

### Objetivo
Estabelecer lideranca tecnologica com features de AI avancada que nenhum concorrente oferece.

### Key Results (Longo Prazo)
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | 3 features "first-in-market" | 12 meses |
| KR2 | 30% dos usuarios usando multimodal | 18 meses |
| KR3 | ROI de telephony > 200% | 12 meses |
| KR4 | 10 avatares clonados ativos | 18 meses |

---

## 3. Features Planejadas

### 3.1 Video Analysis

Analisar expressao facial e linguagem corporal do usuario durante roleplay.

**Capacidades**:
- Detectar nervosismo (expressao tensa, olhar desviado)
- Detectar confianca (postura ereta, contato visual)
- Detectar confusao (sobrancelha franzida)
- Gerar metricas de "presenca" e "confianca"

**Tecnologia**:
- Gemini Vision API (multimodal)
- MediaPipe para landmarks faciais
- Modelo de classificacao de emocoes

**User Stories**:
- Como vendedor, quero feedback sobre minha linguagem corporal
- Como gestor, quero ver score de "presenca" dos vendedores

### 3.2 Screen Sharing Training

Treinar apresentacoes e demos de produto com compartilhamento de tela.

**Capacidades**:
- Usuario compartilha tela durante roleplay
- Avatar "ve" a apresentacao via Gemini Vision
- Avatar faz perguntas sobre o que esta sendo mostrado
- Feedback sobre clareza e ritmo da apresentacao

**Cenarios**:
- Demo de software
- Apresentacao de proposta
- Walkthrough de dashboard

**User Stories**:
- Como vendedor, quero praticar demos de produto com feedback
- Como vendedor, quero que o avatar pergunte sobre slides especificos

### 3.3 Telephony Integration

Treinar cold calls e conversas telefonicas.

**Capacidades**:
- Ligar para numero de treino
- Avatar atende como "cliente"
- Roleplay via telefone (sem video)
- Metricas de conversa coletadas

**Tecnologia**:
- LiveKit Telephony Stack
- Twilio/Telnyx para numeros
- Transcricao em tempo real

**User Stories**:
- Como vendedor, quero praticar cold calls via telefone
- Como vendedor, quero treinar sem precisar do computador
- Como gestor, quero que novos SDRs pratiquem antes de ligar para leads reais

### 3.4 Avatar Cloning

Criar avatares baseados em pessoas reais (top performers, clientes).

**Capacidades**:
- Clonar voz de vendedor top performer
- Clonar aparencia (com consentimento)
- Clonar estilo de comunicacao
- Treinar "contra" o melhor vendedor

**Tecnologia**:
- ElevenLabs Voice Cloning
- Simli Avatar Cloning
- Fine-tuning de LLM com transcripts

**Casos de Uso**:
- Clonar melhor vendedor para treino
- Clonar cliente dificil (de gravacoes)
- Clonar CEO para treino de pitch

**User Stories**:
- Como gestor, quero que novatos treinem com avatar do melhor vendedor
- Como vendedor, quero praticar com avatar similar ao cliente X

### 3.5 WhatsApp Simulation

Treinar conversas de venda por texto/WhatsApp.

**Capacidades**:
- Interface similar ao WhatsApp
- Avatar responde como cliente
- Treino de follow-up, qualificacao, agendamento
- Metricas de tempo de resposta, clareza

**Cenarios**:
- Follow-up pos-call
- Qualificacao inicial
- Agendamento de reuniao
- Tratamento de objecoes por texto

**User Stories**:
- Como SDR, quero praticar mensagens de WhatsApp
- Como vendedor, quero melhorar meus follow-ups escritos

### 3.6 Predictive Coaching

AI que prevê necessidades de treino e sugere proativamente.

**Capacidades**:
- Analisar pipeline do CRM
- Identificar deals em risco
- Sugerir cenarios relevantes
- Alertar gestor sobre vendedores precisando de treino

**Tecnologia**:
- Integracao com CRM (Fase 4)
- ML para predicao de necessidade
- Notificacoes proativas

**User Stories**:
- Como vendedor, quero sugestoes de treino baseadas no meu pipeline
- Como gestor, quero ser alertado quando vendedor precisa de coaching

### 3.7 Live Assistance

Co-pilot durante calls reais (nao roleplay).

**Capacidades**:
- Assistente durante call real (com cliente)
- Sugestoes discretas em tempo real
- Deteccao de objecoes e sugestao de resposta
- Transcricao e resumo automatico

**Restricoes**:
- Requer consentimento de todas as partes
- Hints devem ser muito discretos
- Modo "escuta" sem hints como opcao

**User Stories**:
- Como vendedor, quero ajuda durante calls dificeis
- Como vendedor, quero que objecoes sejam detectadas automaticamente

---

## 4. Especificacoes Tecnicas

### 4.1 Video Analysis Architecture

```
+------------------+     +------------------+     +------------------+
|   User Browser   |     |   LiveKit SFU    |     |   Analysis       |
|                  |     |                  |     |   Service        |
| - Camera feed    |---->| - Video routing  |---->| - Gemini Vision  |
| - Audio feed     |     | - Recording      |     | - MediaPipe      |
+------------------+     +------------------+     | - Emotion Model  |
                                                  +------------------+
                                                           |
                                                           v
                                                  +------------------+
                                                  |   Metrics DB     |
                                                  | - Confidence     |
                                                  | - Nervousness    |
                                                  | - Eye contact    |
                                                  +------------------+
```

### 4.2 Telephony Architecture

```
+------------------+     +------------------+     +------------------+
|   User Phone     |     |   Twilio/Telnyx  |     |   LiveKit        |
|                  |     |                  |     |   Agent          |
| - Dial number    |---->| - SIP trunk      |---->| - Same agent     |
| - Voice only     |     | - Audio bridge   |     | - No video       |
+------------------+     +------------------+     +------------------+
```

### 4.3 Avatar Cloning Pipeline

```
1. COLLECT DATA
   - Gravar 5+ minutos de audio da pessoa
   - Coletar 10+ fotos do rosto (Simli)
   - Coletar transcripts de conversas (opcional)

2. PROCESS VOICE
   - Enviar audio para ElevenLabs
   - Criar voice clone
   - Testar qualidade

3. PROCESS AVATAR
   - Enviar fotos para Simli
   - Gerar face model
   - Testar expressoes

4. FINE-TUNE STYLE (opcional)
   - Analisar transcripts
   - Identificar padroes de fala
   - Ajustar prompt do LLM

5. DEPLOY
   - Associar voice + avatar + style
   - Disponibilizar para cenarios
   - Monitorar qualidade
```

### 4.4 Predictive Coaching Model

```python
# Features para predicao
features = {
    # Do CRM
    "deal_value": float,
    "days_in_stage": int,
    "competitor_mentioned": bool,
    "decision_maker_engaged": bool,
    "next_step_scheduled": bool,

    # Do Live Roleplay
    "sessions_last_30d": int,
    "avg_score": float,
    "objection_handling_rate": float,
    "last_session_date": date,

    # Calculados
    "score_trend": float,  # Subindo ou descendo
    "sessions_per_week": float
}

# Output
predictions = {
    "needs_training": bool,
    "suggested_scenarios": list[str],
    "risk_level": "low" | "medium" | "high",
    "recommended_action": str
}
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Latencia
- Video analysis: <500ms para feedback
- Telephony: Latencia similar a call normal (<200ms)
- Live assistance: Hints em <2s

### RNF-02: Privacidade
- Video analysis opt-in explicito
- Dados biometricos com retencao limitada
- Voice cloning requer consentimento escrito

### RNF-03: Custo
- Video analysis aumenta custo de API ~3x
- Telephony: custo por minuto
- Voice cloning: custo fixo por clone

---

## 6. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Custo proibitivo | Alta | Alto | Tier premium, limites de uso |
| Qualidade de clones | Media | Alto | Validacao rigorosa, feedback loop |
| Privacidade/LGPD | Alta | Alto | Consentimento explicito, DPO |
| Complexidade tecnica | Alta | Medio | Phased rollout, MVP primeiro |
| Adocao baixa | Media | Medio | Freemium para experimentar |

---

## 7. Roadmap de Implementacao

### Wave 1: Telephony (Q2 2026)
- Integracao LiveKit Telephony
- Numero de treino por empresa
- Cenarios de cold call
- **ROI esperado**: Alto (novo canal, baixa complexidade)

### Wave 2: Video Analysis (Q3 2026)
- Integracao Gemini Vision
- Metricas de presenca
- Feedback de linguagem corporal
- **ROI esperado**: Medio (diferenciacao, complexidade media)

### Wave 3: Avatar Cloning (Q4 2026)
- Integracao ElevenLabs + Simli
- Pipeline de clonagem
- Self-service para empresas
- **ROI esperado**: Alto (premium feature, complexidade alta)

### Wave 4: Predictive Coaching (Q1 2027)
- ML pipeline
- Integracao profunda com CRM
- Notificacoes proativas
- **ROI esperado**: Muito alto (enterprise feature)

### Wave 5: Live Assistance (Q2 2027)
- Co-pilot para calls reais
- Browser extension
- Modo escuta
- **ROI esperado**: Muito alto (game-changer)

---

## 8. Metricas de Sucesso (Por Feature)

### Telephony
| Metrica | Target |
|---------|--------|
| % usuarios usando | 20% |
| Sessoes telefonicas/mes | 500 |
| NPS | >50 |

### Video Analysis
| Metrica | Target |
|---------|--------|
| % usuarios com video | 30% |
| Melhoria score presenca | +20% |
| Precisao deteccao | >80% |

### Avatar Cloning
| Metrica | Target |
|---------|--------|
| Clones criados | 10 |
| Sessoes com clones | 200/mes |
| Satisfacao (NPS) | >60 |

### Predictive Coaching
| Metrica | Target |
|---------|--------|
| Predicoes aceitas | 60% |
| Deals salvos | 10/mes |
| ROI atribuido | >300% |

---

## 9. Consideracoes Eticas

### Consentimento
- Clonagem requer consentimento **escrito** da pessoa
- Video analysis requer opt-in **explicito**
- Gravacoes de calls reais requerem aviso a todas as partes

### Bias
- Monitorar modelo de emocoes para vieses
- Nao usar video analysis para decisoes de contratacao
- Auditar predicoes de coaching para fairness

### Transparencia
- Usuarios sabem quando estao sendo analisados
- Clientes sabem quando avatar e clone
- Metricas de AI explicaveis

### Uso Responsavel
- Nao usar clones para impersonation malicioso
- Limitar uso de live assistance a contextos eticos
- Revisar periodicamente politicas de uso

---

## 10. Apendice

### A. APIs e Custos Estimados

| API | Feature | Custo Estimado |
|-----|---------|----------------|
| Gemini Vision | Video Analysis | $0.01/frame |
| ElevenLabs | Voice Clone | $330/clone + $0.30/1k chars |
| Simli | Avatar Clone | $100/avatar |
| Twilio | Telephony | $0.02/min |
| LiveKit | Telephony | $0.01/min |

### B. Competidores com Features Avancadas

| Feature | Quem Tem | Status |
|---------|----------|--------|
| Video Analysis | Quantified | Disponivel |
| Telephony | Hyperbound | Em beta |
| Avatar Cloning | Nenhum | Oportunidade |
| Predictive | Gong | Enterprise only |
| Live Assist | Outreach Kaia | Disponivel |

### C. Referencias Tecnicas

- [Gemini Vision API](https://ai.google.dev/gemini-api/docs/vision)
- [LiveKit Telephony](https://docs.livekit.io/agents/telephony/)
- [ElevenLabs Voice Cloning](https://elevenlabs.io/voice-cloning)
- [Simli Avatar API](https://docs.simli.com/avatar-cloning)
- [MediaPipe Face Mesh](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)

### D. Pesquisa de Mercado

**Demanda por Features (Survey com 100 gestores)**:
1. Telephony training: 78% interessados
2. Video feedback: 65% interessados
3. Avatar de top performer: 58% interessados
4. Predictive coaching: 52% interessados
5. Live assistance: 45% interessados

**Willingness to Pay**:
- Telephony: +30% no preco
- Video analysis: +20% no preco
- Avatar cloning: +50% no preco
- Predictive: +40% no preco
- Full suite: +100% no preco
