# PRD 00: Visao Estrategica - Live Roleplay

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Aprovado |
| **Ultima Atualizacao** | 2026-01-22 |
| **Autor** | Product Team |
| **Stakeholders** | Founders, Engineering, Design |

---

## 1. Executive Summary

O **Live Roleplay** e uma plataforma de treinamento de vendas com roleplay AI em tempo real. Usuarios praticam negociacao com um avatar AI que mantem personagem, reage emocionalmente e fornece feedback estruturado.

### Proposta de Valor
> Treinar vendedores 10x mais rapido com pratica ilimitada contra um avatar AI que simula clientes reais, fornecendo feedback imediato e mensuravel.

### Diferenciais Competitivos
1. **Avatar emocional responsivo** - Reage em tempo real a qualidade da argumentacao
2. **Coaching contextual** - Dicas durante a conversa, nao so apos
3. **Mercado LATAM** - Primeiro player focado em portugues nativo
4. **Preco acessivel** - Tier de entrada para PMEs

---

## 2. Problema

### Dor do Usuario (Vendedor)
- Treinar negociacao requer praticar com pessoas reais
- Feedback de gestores e esporadico e subjetivo
- Medo de errar em situacoes reais reduz confianca
- Cursos teoricos nao desenvolvem habilidade pratica

### Dor do Gestor
- Dificil escalar treinamento para equipe grande
- Nao consegue medir evolucao objetivamente
- Onboarding de novos vendedores e lento e custoso
- Nao sabe onde cada vendedor precisa melhorar

### Dados de Mercado
- Tempo medio de ramp-up de vendedor: 3-6 meses
- 44% dos vendedores desistem no primeiro ano (HubSpot)
- Empresas gastam $15B/ano em treinamento de vendas (ATD)
- ROI medio de treinamento bem estruturado: 353% (SNHU)

---

## 3. Analise Competitiva

### Mapa de Mercado

```
                    PRECO ALTO
                        |
    Quantified -------- | -------- Mursion
    (Enterprise)        |          (VR)
                        |
ESPECIFICO -------------|---------------- GENERICO
(Vendas)                |                 (Soft skills)
                        |
    Second Nature ----- | -------- Rehearsal
    (SaaS vendas)       |          (Video async)
                        |
                    PRECO BAIXO

    *** Live Roleplay = Quadrante inferior-esquerdo ***
    (Foco vendas, preco acessivel, avatar AI real-time)
```

### Comparativo Detalhado

| Player | Avatar | Real-time | Emocoes | Portugues | Preco |
|--------|--------|-----------|---------|-----------|-------|
| Second Nature | Sim | Sim | Nao | Nao | $$$ |
| Quantified | Sim | Sim | Basico | Nao | $$$$$ |
| Hyperbound | Nao | Sim | N/A | Nao | $$ |
| Rehearsal | Nao | Nao | N/A | Nao | $$ |
| **Live Roleplay** | **Sim** | **Sim** | **Sim** | **Sim** | **$** |

### SWOT

| Forcas | Fraquezas |
|--------|-----------|
| Avatar emocional unico | MVP em validacao |
| Stack moderno (Gemini, Simli) | Time pequeno |
| Foco LATAM | Sem integracao CRM |
| Custo operacional baixo | Sem track record |

| Oportunidades | Ameacas |
|---------------|---------|
| Mercado LATAM inexplorado | Players globais entrando |
| AI cada vez mais acessivel | Dependencia de APIs |
| Demanda pos-pandemia | Commoditizacao rapida |
| Expansao para outros verticais | Mudancas nas APIs |

---

## 4. Capacidades Tecnicas Disponiveis

### Gemini Live API
| Capacidade | Status | Uso Potencial |
|------------|--------|---------------|
| Speech-to-Text real-time | Em uso | Transcricao |
| Text-to-Speech natural | Em uso | Voz do avatar |
| Affective Dialogue | **Nao usado** | Detectar emocao do user |
| Proactive Audio | **Nao usado** | Ignorar ruido de fundo |
| Multimodal (video) | **Nao usado** | Analisar expressao do user |
| Barge-in | Em uso | Interrupcoes naturais |

### Simli API
| Capacidade | Status | Uso Potencial |
|------------|--------|---------------|
| Lip-sync | Em uso | Sincronizar fala |
| 5 emocoes (happy, sad, angry, surprised, neutral) | **Nao usado** | Avatar responsivo |
| Trinity Faces (animacao completa) | **Nao usado** | Realismo |
| Avatar Cloning | **Nao usado** | Avatares customizados |
| Emotion transitions | **Nao usado** | Transicoes suaves |

### LiveKit Agents SDK
| Capacidade | Status | Uso Potencial |
|------------|--------|---------------|
| Rooms WebRTC | Em uso | Conexao real-time |
| Data channels | Em uso | Mensagens para frontend |
| Semantic Turn Detection | **Nao usado** | Detectar fim de fala |
| Multi-agent handoff | **Nao usado** | Cenarios complexos |
| Telephony Stack | **Nao usado** | Treino via telefone |
| MCP Integration | **Nao usado** | Ferramentas externas |

---

## 5. Roadmap de Produto

### Visao de 18 Meses

```
Q1 2026          Q2 2026          Q3 2026          Q4 2026          Q1 2027
    |                |                |                |                |
    v                v                v                v                v
+--------+      +--------+      +--------+      +--------+      +--------+
| FASE 1 |----->| FASE 2 |----->| FASE 3 |----->| FASE 4 |----->| FASE 5 |
+--------+      +--------+      +--------+      +--------+      +--------+
Foundation      Engagement      Real-time       Enterprise      Advanced
                                Coaching                        AI
    |                |                |                |                |
    v                v                v                v                v
- Conv Intel    - Gamificacao   - Coaching      - Dashboard     - Multimodal
- Avatar Emoc   - Streaks       - Overlay       - Scenario      - Telephony
- Feedback+     - Badges        - Metodologias    Builder       - AI Clone
                - Leaderboard   - Pause/Reflect - CRM Sync
```

### Fases Detalhadas

#### Fase 1: Foundation (2 meses)
**Objetivo**: Validar PMF com dados quantitativos

| Feature | PRD | Esforco | Impacto |
|---------|-----|---------|---------|
| Conversation Intelligence | 01 | M | Alto |
| Avatar Emocional | 02 | B | Alto |
| Feedback Enriquecido | 01 | B | Medio |
| Admin CRUD | - | B | Medio |

**Entregaveis**:
- Metricas de conversa (talk ratio, hesitacoes, objecoes)
- Avatar que reage ao contexto (5 estados)
- Feedback com dados quantitativos

#### Fase 2: Engagement (2 meses)
**Objetivo**: Criar habito de uso

| Feature | PRD | Esforco | Impacto |
|---------|-----|---------|---------|
| Sistema de XP | 03 | M | Alto |
| Badges | 03 | B | Medio |
| Streaks | 03 | B | Alto |
| Leaderboard | 03 | M | Alto |

**Entregaveis**:
- Progressao com niveis
- 11 badges conquistaveis
- Ranking semanal por equipe

#### Fase 3: Real-time Coaching (3 meses)
**Objetivo**: Maximizar aprendizado durante sessao

| Feature | PRD | Esforco | Impacto |
|---------|-----|---------|---------|
| Coaching Overlay | 04 | A | Alto |
| Alertas de Comportamento | 04 | M | Alto |
| Pause & Reflect | 04 | M | Medio |
| Metodologias (SPIN) | 04 | M | Medio |

**Entregaveis**:
- Dicas contextuais durante conversa
- Alertas quando falar demais
- Integracao com metodologias de venda

#### Fase 4: Enterprise (4 meses)
**Objetivo**: Escalar para equipes e provar ROI

| Feature | PRD | Esforco | Impacto |
|---------|-----|---------|---------|
| Analytics Dashboard | 05 | M | Alto |
| Scenario Builder | 06 | A | Alto |
| Multi-tenancy | 06 | A | Alto |
| CRM Sync | 06 | A | Medio |

**Entregaveis**:
- Dashboard de gestao de equipe
- Criacao de cenarios customizados
- Integracao Salesforce/HubSpot

#### Fase 5: Advanced AI (ongoing)
**Objetivo**: Lideranca tecnologica

| Feature | PRD | Esforco | Impacto |
|---------|-----|---------|---------|
| Video Analysis | 07 | A | Medio |
| Telephony | 07 | A | Alto |
| Avatar Cloning | 07 | A | Alto |
| Predictive Coaching | 07 | A | Alto |

---

## 6. Metricas North Star

### Metricas Primarias

| Metrica | Definicao | Target MVP | Target Scale |
|---------|-----------|------------|--------------|
| **Sessions/Week/User** | Frequencia de treino | 2 | 5 |
| **Score Improvement** | Delta 1a vs 5a sessao | +15% | +30% |
| **Sales Lift** | Conversao pos-treino | Mensuravel | >20% |

### Metricas de Produto

| Metrica | Target Fase 1 | Target Fase 2 | Target Fase 4 |
|---------|---------------|---------------|---------------|
| Completion Rate | >70% | >80% | >85% |
| NPS | >30 | >50 | >60 |
| D7 Retention | >30% | >40% | >50% |
| DAU/MAU | >20% | >30% | >40% |

### Metricas de Negocio

| Metrica | Target |
|---------|--------|
| CAC Payback | <6 meses |
| Net Revenue Retention | >110% |
| Gross Margin | >70% |
| Churn Rate | <5% |

---

## 7. Hipoteses a Validar

### H1: Frequencia = Performance
> "Vendedores que praticam 3+ vezes/semana tem win rate 20% maior"

**Teste**: A/B com grupo controle, medir win rate apos 30 dias
**Fase**: 2

### H2: Feedback Imediato = Aprendizado Acelerado
> "Coaching real-time acelera curva de aprendizado em 2x"

**Teste**: Cohort com overlay vs sem, medir tempo ate proficiencia
**Fase**: 3

### H3: Gamificacao = Engajamento
> "Badges e leaderboard aumentam sessoes/semana em 50%"

**Teste**: Feature flag, comparar frequencia entre cohorts
**Fase**: 2

### H4: Avatar Emocional = Realismo
> "Avatar responsivo prepara melhor para calls reais"

**Teste**: Survey pos-sessao, NPS comparativo
**Fase**: 1

### H5: Dados = Adocao Enterprise
> "Dashboard de metricas e principal driver de compra B2B"

**Teste**: Win/loss analysis em deals enterprise
**Fase**: 4

---

## 8. Riscos e Mitigacoes

| Risco | Prob. | Impacto | Mitigacao |
|-------|-------|---------|-----------|
| Latencia do avatar | Media | Alto | Cache, fallback audio-only |
| Custo de API escala | Alta | Alto | Limites por user, tiers |
| Qualidade do feedback | Media | Alto | Validacao humana em amostra |
| Dependencia Gemini | Baixa | Alto | Abstração para trocar provider |
| Adocao corporate lenta | Media | Medio | Pilots gratuitos, case studies |
| Concorrentes entrando LATAM | Media | Alto | Speed to market, parcerias |

---

## 9. Modelo de Negocio

### Pricing Tiers (Proposta)

| Tier | Preco | Sessoes/mes | Features |
|------|-------|-------------|----------|
| **Starter** | R$49/user | 10 | Basico, 3 cenarios |
| **Pro** | R$149/user | Ilimitado | Gamificacao, historico |
| **Team** | R$99/user (min 5) | Ilimitado | + Dashboard, custom scenarios |
| **Enterprise** | Custom | Ilimitado | + SSO, API, integrações |

### Unit Economics Target

| Metrica | Target |
|---------|--------|
| ARPU | R$120 |
| CAC | R$300 |
| LTV | R$1.800 (15 meses) |
| LTV/CAC | 6x |
| Payback | 2.5 meses |

---

## 10. Go-to-Market

### Fase 1-2: Product-Led Growth
- Freemium para validacao
- Foco em early adopters (SDRs, inside sales)
- Conteudo educativo (LinkedIn, YouTube)
- Parcerias com influencers de vendas

### Fase 3-4: Sales-Led Growth
- Outbound para mid-market
- Pilots gratuitos de 30 dias
- Case studies com metricas
- Parcerias com consultorias de vendas

### Fase 5: Enterprise
- Field sales dedicado
- Custom implementations
- Channel partners (Salesforce, HubSpot)
- Eventos e conferencias

---

## 11. Referencias

### Competidores
- [Second Nature AI](https://www.secondnature.ai)
- [Quantified AI](https://www.quantified.ai)
- [Outdoo AI](https://www.outdoo.ai)
- [Hyperbound](https://www.hyperbound.ai)
- [Rehearsal by ELB](https://elblearning.com/products/rehearsal/)

### APIs e Tecnologia
- [LiveKit Agents SDK](https://docs.livekit.io/agents/)
- [Google Gemini Live API](https://ai.google.dev/gemini-api/docs/live)
- [Simli Emotions API](https://docs.simli.com/emotions)

### Pesquisas e Benchmarks
- [Gamification in Sales Training - Spinify](https://spinify.com/blog/gamification-sales-training/)
- [Sales Enablement Metrics - Highspot](https://www.highspot.com/blog/sales-enablement-metrics/)
- [Conversation Intelligence - Gong](https://www.gong.io/conversation-intelligence)
- [Sales Training ROI - SNHU Study](https://www.snhu.edu)

### Casos de Sucesso
- SAP Roadwarrior: +12% sales performance
- Deloitte Leadership Academy: +47% engagement
- Cisco Social Media Training: +24% completion
- Autodesk Gamified Training: +15% conversions
