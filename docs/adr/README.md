# Architecture Decision Records — Live Roleplay

Registro de decisoes arquiteturais do projeto Live Roleplay, plataforma de treinamento de vendas com roleplay AI em tempo real.

## Indice de ADRs

| # | Titulo | Status | Data |
|---|--------|--------|------|
| [ADR-001](001-openai-realtime.md) | Migracao para OpenAI Realtime API | Aceito | 2026-02-13 |
| [ADR-002](002-stack-modular.md) | Pipeline modular (STT + LLM + TTS) | Proposto | 2026-02-17 |
| [ADR-003](003-avatar-talkinghead.md) | Avatar 3D com TalkingHead.js | Proposto | 2026-02-17 |
| [ADR-004](004-aws-sp-infra.md) | Infraestrutura AWS Sao Paulo | Proposto | 2026-02-17 |
| [ADR-005](005-pipecat-poc.md) | PoC com Pipecat Framework | Proposto | 2026-02-17 |
| [ADR-006](006-coach-orchestrator.md) | Coach Orchestrator (unified coaching) | Aceito | 2026-03-04 |

---

## Sobre

Utilizamos o formato [MADR (Markdown Any Decision Records)](https://adr.github.io/madr/) para documentar decisoes arquiteturais significativas do projeto.

Cada ADR descreve:
- **Contexto**: O problema ou necessidade que motivou a decisao
- **Decisao**: O que foi decidido e por que
- **Alternativas**: Opcoes avaliadas e motivos de rejeicao
- **Consequencias**: Impactos positivos, negativos e riscos

## Status possiveis

- **Proposto** — Decisao em avaliacao, ainda nao implementada
- **Aceito** — Decisao aprovada e em vigor
- **Depreciado** — Decisao substituida por outra ADR
- **Rejeitado** — Decisao avaliada e descartada

---

## Template MADR

```markdown
# ADR-NNN: Titulo da Decisao

## Status

[Proposto | Aceito | Depreciado | Rejeitado] — Data: YYYY-MM-DD

## Contexto

Descreva o problema, necessidade ou forca que motiva esta decisao.
Inclua restricoes tecnicas, de negocio ou organizacionais relevantes.

## Decisao

Descreva a decisao tomada e a justificativa principal.

## Alternativas Consideradas

### Opcao A — Nome

- Descricao breve
- Motivo de rejeicao ou aceitacao

### Opcao B — Nome

- Descricao breve
- Motivo de rejeicao ou aceitacao

## Consequencias

### Positivas

- Beneficio 1
- Beneficio 2

### Negativas

- Desvantagem 1
- Desvantagem 2

### Riscos

- Risco 1
- Risco 2

## Referencias

- [Link ou documento relevante](URL)
```
