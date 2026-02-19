# Benchmark Suite — Comparação de Stacks

Suite de benchmarks para comparar a stack atual (OpenAI Realtime) com alternativas (ex: Pipecat modular).

---

## Objetivo

Avaliar de forma objetiva e reprodutível as seguintes dimensões entre stacks de agentes conversacionais:

1. **Latência end-to-end** — tempo entre fim da fala do usuário e primeiro byte de áudio do agente
2. **Tempo de inicialização** — tempo entre entrada na room e primeiro greeting
3. **Custo por sessão** — estimativa de custo por sessão de 3 minutos
4. **Precisão STT** — Word Error Rate comparando transcrição com frases de referência
5. **Estabilidade de papel** — resistência à inversão de papéis com inputs provocativos
6. **Cobertura de objeções** — verificação se todas as objeções do cenário foram apresentadas
7. **Qualidade subjetiva** — naturalidade de voz, expressividade do avatar, imersão geral

---

## Como Executar

### Testes Automatizados

```bash
# Stack atual (OpenAI Realtime)
pytest tests/benchmark/automated/ -v --agent-type=openai_realtime

# Stack alternativa (Pipecat modular)
pytest tests/benchmark/automated/ -v --agent-type=pipecat_modular
```

### Testes Semi-Automáticos

```bash
# Requerem agent rodando e room ativa
pytest tests/benchmark/semi_auto/ -v --agent-type=openai_realtime
```

### Avaliação Manual

Preencher o formulário em `manual/evaluation_form.md` após sessão de teste.

---

## Estrutura

```
tests/benchmark/
├── conftest.py                     # Fixtures e opções do pytest
├── automated/
│   ├── test_latency_e2e.py         # Latência end-to-end (5 repetições)
│   ├── test_startup_time.py        # Tempo de inicialização
│   ├── test_cost_session.py        # Custo estimado por sessão
│   └── test_stt_wer.py             # Word Error Rate do STT
├── semi_auto/
│   ├── test_role_stability.py      # Estabilidade de papel com inputs provocativos
│   └── test_objection_coverage.py  # Cobertura de objeções do cenário
├── manual/
│   └── evaluation_form.md          # Formulário de avaliação qualitativa
├── fixtures/
│   ├── reference_phrases.txt       # Frases PT-BR para teste de STT
│   ├── provocative_inputs.txt      # Inputs que causam inversão de papéis
│   └── scenario_retention.json     # Cenário de retenção para benchmarks
└── results/
    └── .gitkeep                    # Resultados JSON gerados automaticamente
```

---

## Tabela de Resultados

| Métrica | OpenAI Realtime | Pipecat Modular | Meta |
|---------|----------------|-----------------|------|
| Latência E2E (mean) | — | — | < 1500ms |
| Latência E2E (p95) | — | — | < 2500ms |
| Tempo de startup | — | — | < 10000ms |
| Custo / sessão 3min | — | — | < $0.15 |
| STT WER | — | — | < 15% |
| Estabilidade de papel | — | — | 100% (0 inversões) |
| Cobertura de objeções | — | — | > 80% |
| TTS Naturalidade (1-10) | — | — | > 7 |
| Avatar Expressividade (1-10) | — | — | > 7 |
| Impressão Geral (1-10) | — | — | > 7 |

> Preencher após execução dos benchmarks. Resultados detalhados em `results/`.

---

## Critérios de Avaliação

### Automatizados (objetivos)
- **Latência:** Medida em milissegundos, 5 repetições, reporta mean e p95
- **Startup:** Medida do join até primeiro áudio, 3 repetições
- **Custo:** Calculado com constantes de pricing atualizadas (Feb 2026)
- **WER:** Comparação word-by-word com frases de referência em PT-BR

### Semi-Automáticos (reprodutíveis)
- **Estabilidade:** N sessões com inputs provocativos, verifica inversão via GPT-4o-mini
- **Objeções:** Verifica se todas as objeções do cenário foram apresentadas pelo avatar

### Manuais (subjetivos)
- **Voz:** Naturalidade, entonação, velocidade, clareza
- **Avatar:** Sincronia labial, expressões, movimentos, naturalidade
- **Geral:** Imersão, latência percebida, recomendação
