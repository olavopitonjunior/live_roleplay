# Formulário de Avaliação Manual — Benchmark de Stack

**Data:** _______________
**Avaliador:** _______________
**Stack testada:** [ ] OpenAI Realtime  [ ] Pipecat Modular
**Cenário:** _______________
**Duração da sessão:** _______________

---

## 1. TTS — Naturalidade da Voz

Avalie a qualidade da voz sintetizada do avatar (agente) durante a sessão.

| # | Critério | Descrição | Nota (1-10) |
|---|----------|-----------|-------------|
| 1.1 | **Naturalidade** | A voz soa como uma pessoa real? Há artefatos robóticos perceptíveis? | _____ |
| 1.2 | **Entonação** | A entonação varia naturalmente? Há monotonia ou variações estranhas? | _____ |
| 1.3 | **Velocidade** | A velocidade da fala é adequada? Muito rápido ou lento para conversação? | _____ |
| 1.4 | **Clareza** | As palavras são pronunciadas claramente? Há distorções ou sobreposições? | _____ |

**Média TTS:** _____ / 10

**Observações sobre a voz:**

> _Escreva aqui comentários livres sobre a qualidade da voz, problemas específicos, pronúncia de palavras em PT-BR, etc._

---

## 2. Avatar — Expressividade

Avalie a qualidade visual do avatar durante a sessão (se habilitado).

| # | Critério | Descrição | Nota (1-10) |
|---|----------|-----------|-------------|
| 2.1 | **Sincronia labial** | Os movimentos da boca estão sincronizados com o áudio? | _____ |
| 2.2 | **Expressões faciais** | O avatar demonstra emoções coerentes com o contexto? | _____ |
| 2.3 | **Movimentos naturais** | Os movimentos da cabeça e corpo são naturais? Há movimentos estranhos? | _____ |
| 2.4 | **Naturalidade geral** | O avatar parece uma pessoa real em videochamada? | _____ |

**Média Avatar:** _____ / 10

**Observações sobre o avatar:**

> _Escreva aqui comentários livres sobre a qualidade do avatar, problemas visuais, momentos de uncanny valley, etc._

> **Nota:** Se o avatar estava desabilitado (DISABLE_AVATAR=true), preencha com N/A.

---

## 3. Impressão Geral

Avalie a experiência completa da sessão de roleplay.

| # | Critério | Descrição | Resposta |
|---|----------|-----------|----------|
| 3.1 | **Imersão** | Você conseguiu se envolver na conversa como se fosse real? (1-10) | _____ |
| 3.2 | **Latência percebida** | A demora nas respostas incomodou? (1 = muito, 10 = imperceptível) | _____ |
| 3.3 | **Recomendaria?** | Recomendaria essa stack para produção? (Sim / Não / Com ressalvas) | _____ |

**Observações gerais:**

> _Escreva aqui comentários livres sobre a experiência geral, pontos fortes, pontos fracos, e se a conversa foi útil para treinamento._

---

## 4. Problemas Observados

Liste quaisquer problemas técnicos, bugs ou comportamentos inesperados observados durante a sessão.

| # | Problema | Gravidade (Baixa/Média/Alta) | Descrição |
|---|----------|------------------------------|-----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## 5. Comparação com Outra Stack (se aplicável)

Se você testou ambas as stacks, compare diretamente:

| Dimensão | OpenAI Realtime | Pipecat Modular | Vencedor |
|----------|----------------|-----------------|----------|
| Naturalidade da voz | _____ / 10 | _____ / 10 | _________ |
| Latência | _____ / 10 | _____ / 10 | _________ |
| Manutenção de papel | _____ / 10 | _____ / 10 | _________ |
| Qualidade das respostas | _____ / 10 | _____ / 10 | _________ |
| Impressão geral | _____ / 10 | _____ / 10 | _________ |

**Stack preferida:** _______________

**Justificativa:**

> _Explique brevemente por que você prefere essa stack._

---

## Resumo de Notas

| Categoria | Nota |
|-----------|------|
| TTS Naturalidade (média) | _____ / 10 |
| Avatar Expressividade (média) | _____ / 10 |
| Imersão | _____ / 10 |
| Latência percebida | _____ / 10 |
| **Nota Geral** | _____ / 10 |

> Salvar este formulário preenchido em `tests/benchmark/results/` com o nome:
> `YYYY-MM-DD_{stack}_manual_evaluation.md`
