# PRD 08: Avaliacao Evidenciada e Calibrada (V2)

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Planejado |
| **Fase** | 4 - Avaliacao Evidenciada |
| **Prioridade** | P0/P1 |
| **Dependencias** | PRD-01 (metricas), PRD-04 (realtime coaching), PRD-05 (analytics) |
| **Estimativa** | 8-12 semanas |
| **Ultima Atualizacao** | 2026-01-29 |

---

## 1. Contexto

### Problema
O feedback atual e binario e pouco evidenciado. Vendedores contestam o score porque nao ha trechos de fala que comprovem as avaliacoes. O coach em tempo real ignora o playbook e o cenario, gerando dicas genericas e fora de timing. A confiabilidade do avatar e do audio impacta a validade da sessao.

### Oportunidade
Criar uma avaliacao robusta, com rubricas e evidencias clicaveis, permite usar o produto para certificacao e decisoes de performance. A calibracao por cenario e nivel aumenta aderencia ao playbook e reduz falsos positivos.

### Hipotese
> "Sessoes com avaliacao evidenciada e rubrica por criterio aumentam confianca no score e elevam a adocao para >70% em 4 semanas."

---

## 2. Objetivos (OKRs)

### Objetivo
Entregar uma avaliacao confiavel e calibrada por cenario, com evidencias, e garantir continuidade de treino mesmo com falhas do avatar.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | 80% das sessoes com evidencias clicaveis por criterio | Mes 2 |
| KR2 | Reduzir contestacoes de score para <10% | Mes 2 |
| KR3 | Adoçao >70% com 2 sessoes/semana | Mes 2 |
| KR4 | NPS do feedback > 40 | Mes 2 |
| KR5 | 95% das sessoes mantem audio + transcricao mesmo sem avatar | Mes 1 |

---

## 3. Escopo

### Inclui
- Rubrica por criterio (1-4) com pesos por cenario
- Evidencias clicaveis por criterio e momentos-chave
- Objecoes obrigatorias por cenario com status (tratada/parcial/nao tratada)
- Modo treino vs avaliacao
- Controle de intensidade do coach
- Regras de sessao valida e duracao configuravel
- Fallback para falha de avatar/TTS (audio + transcricao)

### Fora do escopo (V2)
- Gamificacao e ranking
- Personalizacao visual do avatar
- Multi-idiomas
- Modelos preditivos de resultado de vendas

---

## 4. Jornadas To-Be (resumo)

1) **Configurar cenario** com objecoes obrigatorias, rubricas e pesos  
2) **Executar sessao** com duracao configuravel e metas claras  
3) **Coach** ajustado por perfil (treino ou avaliacao)  
4) **Feedback** com transcricao completa e evidencias  
5) **Gestao** com evolucao por competencia e plano de acao

---

## 5. Epicos e User Stories (Backlog)

### Epic E1: Objecoes por Cenario e Playbook
**Objetivo**: Conectar objecoes do cenario ao coach e ao feedback.

**US-01: Registrar objecoes obrigatorias por cenario**  
Como admin  
Quero cadastrar objecoes obrigatorias por cenario  
Para que o coach e o feedback as reconhecam

**Criterios de Aceite**:
- [ ] Campo de objecoes aceita lista com id, descricao, gatilhos e resposta esperada
- [ ] Cada objecao pode ter nivel de severidade (baixa/media/alta)
- [ ] Objecoes ficam vinculadas ao cenario e a versao do playbook

**US-02: Detectar objecoes durante a sessao**  
Como sistema  
Quero detectar objecoes no dialogo  
Para ativar dicas e registrar evidencias

**Criterios de Aceite**:
- [ ] Detecta pelo menos 80% das objecoes seed em cenarios de teste
- [ ] Registra timestamp, falante e confianca da deteccao
- [ ] Permite marcar como falso positivo no feedback

**US-03: Exibir status da objecao no feedback**  
Como vendedor  
Quero ver se tratei cada objecao  
Para entender onde melhorar

**Criterios de Aceite**:
- [ ] Status por objecao: tratada / parcial / nao tratada
- [ ] Cada status linka para trechos da conversa
- [ ] Exibe recomendacao quando nao tratada

---

### Epic E2: Evidencias e Transcricao
**Objetivo**: Tornar o feedback verificavel e confiavel.

**US-04: Transcricao completa com timestamps**  
Como vendedor  
Quero ver a transcricao completa da sessao  
Para revisar o que foi dito

**Criterios de Aceite**:
- [ ] Transcricao mostra falante, timestamp e texto
- [ ] Cobertura minima de 80% do audio
- [ ] Erros criticos de transcricao invalidam a sessao

**US-05: Evidencias por criterio**  
Como vendedor  
Quero ver trechos que justificam cada criterio  
Para confiar no score

**Criterios de Aceite**:
- [ ] Cada criterio possui ao menos 1 evidencia quando marcado como "atendido" ou "parcial"
- [ ] Evidencia e clicavel e leva ao trecho exato
- [ ] Se nao houver evidencia, o criterio fica como "nao avaliado"

**US-06: Momentos-chave**  
Como gestor  
Quero ver momentos-chave da sessao  
Para orientar coaching rapido

**Criterios de Aceite**:
- [ ] Lista de 3-5 momentos-chave gerados automaticamente
- [ ] Cada momento possui etiqueta (objecao, empatia, fechamento, risco)
- [ ] Cada momento tem atalho para transcricao

---

### Epic E3: Rubrica e Score Calibrado
**Objetivo**: Substituir o binario por uma avaliacao granular e justa.

**US-07: Rubrica por criterio (1-4)**  
Como gestor  
Quero definir niveis por criterio  
Para avaliar desempenho de forma justa

**Criterios de Aceite**:
- [ ] Niveis: 1-fraco, 2-parcial, 3-bom, 4-excelente
- [ ] Descritores por nivel ficam visiveis no feedback
- [ ] Rubrica e configuravel por cenario

**US-08: Pesos por criterio e por cenario**  
Como gestor  
Quero ajustar pesos por criterio  
Para refletir prioridades do playbook

**Criterios de Aceite**:
- [ ] Pesos somam 100% por cenario
- [ ] Default geral: diagnostico 25%, objecoes 25%, valor 20%, empatia 15%, fechamento 15%
- [ ] Retencao: empatia 30%, fechamento 10%

**US-09: Score final com confianca**  
Como vendedor  
Quero ver score com explicacao e confianca  
Para entender limitacoes da avaliacao

**Criterios de Aceite**:
- [ ] Score geral + score por criterio
- [ ] Exibe "confianca baixa" quando transcricao <80% ou deteccao fraca
- [ ] Nao mostra score final se sessao invalida

---

### Epic E4: Modo Treino vs Avaliacao
**Objetivo**: Separar sessao assistida de avaliacao formal.

**US-10: Alternar modo de sessao**  
Como gestor  
Quero definir se a sessao e treino ou avaliacao  
Para controlar interferencia do coach

**Criterios de Aceite**:
- [ ] Modo definido no inicio da sessao e registrado no log
- [ ] Em modo avaliacao, coach fica silencioso
- [ ] Em modo treino, coach segue limites de intensidade

**US-11: Controle de intensidade do coach**  
Como gestor  
Quero ajustar intensidade das dicas  
Para evitar distracao

**Criterios de Aceite**:
- [ ] Slider com niveis baixo/medio/alto
- [ ] Frequencia padrao: 1.5-2 dicas/min (max 3/min para iniciantes)
- [ ] Sugestao IA forte: no maximo 1 a cada 30-45s

**US-12: Triggers de intervencao**  
Como sistema  
Quero ativar dicas apenas em momentos criticos  
Para aumentar relevancia

**Criterios de Aceite**:
- [ ] Intervencao se silencio >10s
- [ ] Intervencao se talk ratio fora da faixa
- [ ] Intervencao se objecao critica nao tratada >30s

---

### Epic E5: Sessao Valida e Duracao Configuravel
**Objetivo**: Garantir condicoes minimas para avaliacao.

**US-13: Validar sessao**  
Como sistema  
Quero validar requisitos minimos de sessao  
Para garantir score confiavel

**Criterios de Aceite**:
- [ ] 4-6 min minimo; 6-8 turnos por lado
- [ ] Pelo menos 3 objecoes explicitas detectadas
- [ ] Transcricao >= 80% do audio
- [ ] Sem falhas criticas de conexao

**US-14: Duracao configuravel por cenario**  
Como gestor  
Quero definir faixa de duracao por cenario  
Para adequar complexidade

**Criterios de Aceite**:
- [ ] Seguro de vida: 6-8 min
- [ ] Retencao: 8-10 min
- [ ] B2B: 10-12 min
- [ ] Sessao termina ao atingir limite maximo

---

### Epic E6: Fallback e Confiabilidade
**Objetivo**: Manter continuidade quando avatar/TTS falhar.

**US-15: Fallback automatico**  
Como vendedor  
Quero continuar a sessao mesmo sem video  
Para nao perder o treino

**Criterios de Aceite**:
- [ ] Detecta falha do avatar/TTS em ate 5s
- [ ] Troca para modo audio + transcricao sem reiniciar sessao
- [ ] Exibe aviso claro e nao bloqueante

**US-16: Persistencia segura da sessao**  
Como sistema  
Quero salvar audio e transcricao mesmo com falhas  
Para garantir feedback

**Criterios de Aceite**:
- [ ] Sessao salva com status "com fallback"
- [ ] Feedback pode ser gerado normalmente
- [ ] Logs de erro ficam acessiveis para diagnostico

---

## 6. Requisitos Nao-Funcionais

- Latencia de feedback pos-sessao < 30s
- Disponibilidade do fluxo de sessao > 99%
- Audio e transcricao priorizados sobre video do avatar
- Conformidade LGPD (retencao e exclusao sob demanda)
- Dados sensiveis mascarados na transcricao quando necessario

---

## 7. Modelo de Dados (alto nivel)

- **Scenario**: id, nome, contexto, perfil_avatar, duracao_min/max, nivel, versao_playbook  
- **Objection**: id, scenario_id, descricao, gatilhos, severidade, resposta_esperada  
- **Criterion**: id, scenario_id, nome, descricao, peso  
- **Rubric**: criterion_id, nivel, descricao  
- **Session**: id, user_id, scenario_id, modo, status, start_at, end_at  
- **Transcript**: session_id, speaker, timestamp, text, confidence  
- **Evidence**: criterion_id, session_id, transcript_ref, label  
- **Score**: session_id, criterio, nivel, peso, confianca

---

## 8. Instrumentacao e Eventos

- `session_start`, `session_end`, `session_invalid`
- `objection_detected`, `objection_resolved`
- `coach_hint_shown`, `coach_intensity_changed`
- `evidence_linked`, `score_generated`
- `avatar_fallback_triggered`

---

## 9. UX/UI (diretrizes)

- Feedback deve mostrar transcricao completa com highlights e filtros por criterio
- Cada criterio deve ter evidencia clicavel
- Status de objecao com cor e etiqueta textual
- Modo avaliacao claramente identificado (coach silencioso)
- Alertas de fallback discretos e sem bloquear a sessao

---

## 10. Criterios de Sucesso do Piloto

- Adoçao >70% (2 sessoes/semana)
- +10 a +15 pontos no score medio em 4 semanas
- NPS do feedback >40
- Gestores reportam reducao de tempo em coaching
- Sem incidentes criticos de audio/transcricao

---

## 11. Riscos e Mitigacoes

- **Risco**: falso positivo de objecao  
  **Mitigacao**: confianca minima + ajuste manual no feedback
- **Risco**: transcricao baixa em ambientes ruidosos  
  **Mitigacao**: aviso de qualidade e invalidacao automatica
- **Risco**: dicas genericas em modo treino  
  **Mitigacao**: regras por cenario e limite de frequencia

---

## 12. Decisoes Assumidas

- **Playbook primario**: Playbook Comercial Oficial vigente + matriz de objecoes por cenario; na ausencia, usar base SPIN/MEDDIC como fallback.
- **Limiar de confianca do score**: liberar score final apenas se confianca >= 0.70 e sessao valida; entre 0.50-0.69 mostrar feedback sem score final; abaixo de 0.50 invalidar.
- **Prioridade de integracoes**: CRM (Salesforce/HubSpot) > LMS (Docebo/Moodle) > BI (Power BI/Looker).

---

## Anexo A: Objecoes Obrigatorias (seed)

**Seguro de Vida**  
- preco alto  
- preciso falar com minha esposa  
- ja invisto  
- desconfiança de seguradora/contrato  
- nao vejo urgencia agora

**B2B Contrato**  
- concorrente 20% mais barato  
- prazo de implementacao longo  
- aprovacao do board  
- risco de mudanca/integracao  
- duvidas sobre ROI comprovado/cases

**Retencao**  
- SLA de 5 dias  
- concorrente com SLA 4h  
- nao me sinto valorizado  
- quebra de confianca  
- exigencia de compensacao concreta
