# ADR-004: Infraestrutura AWS Sao Paulo para o Agent

## Status

**Proposto** — Data: 2026-02-17

## Contexto

O agent Python (LiveKit Agents + OpenAI Realtime + Hedra) roda atualmente no **Railway** (regiao US East). Usuarios brasileiros experimentam:

- **Latencia de rede de ~150-200ms RTT** entre o browser e o servidor do agent
- **Latencia total perceptivel**: ~450-700ms (rede + processamento STT/LLM/TTS + rede de volta)
- **Observabilidade limitada**: Railway oferece logs basicos, sem metricas detalhadas de CPU, memoria, latencia de rede ou alertas customizados

Para uma plataforma de roleplay em tempo real, cada 100ms de latencia adicional prejudica a naturalidade da conversa. Alem disso, a falta de observabilidade dificulta diagnostico de problemas em producao.

A infraestrutura AWS na regiao **sa-east-1 (Sao Paulo)** oferece proximidade geografica aos usuarios brasileiros e acesso ao ecossistema completo de monitoramento (CloudWatch, X-Ray).

## Decisao

Migrar o agent para **AWS sa-east-1** em uma instancia **EC2 t3.medium** (~$50-55/mes) com:

- **Docker + systemd**: Container do agent gerenciado como servico systemd para auto-restart e logging
- **Acesso SSH**: Acesso direto para debugging e manutencao
- **CloudWatch**: Metricas de infra (CPU, memoria, rede) + metricas customizadas do agent (latencia por componente, sessoes ativas, erros)
- **Elastic IP**: IP fixo para configuracao do LiveKit e DNS

### Tabela Comparativa de Opcoes

| Opcao | Custo/mes | Latencia BR | Complexidade | Observabilidade |
|-------|-----------|-------------|-------------|-----------------|
| **Railway** (atual) | ~$5-20 | ~150-200ms | Zero | Basica (logs) |
| **EC2 t3.medium** (proposto) | ~$50-55 | ~20-50ms | Media | Alta (CloudWatch) |
| **ECS Fargate** | ~$90-145 | ~20-50ms | Alta | Alta (CloudWatch) |
| **g4dn.xlarge Spot** | ~$140-215 | ~20-50ms | Media (GPU) | Alta (CloudWatch) |

### Detalhamento de Custos EC2 t3.medium

| Item | Custo/mes |
|------|-----------|
| EC2 t3.medium (2 vCPU, 4GB RAM) | ~$38-42 |
| EBS 30GB gp3 | ~$2.50 |
| Elastic IP | ~$3.65 |
| Data transfer (~50GB) | ~$5-8 |
| **Total estimado** | **~$50-55** |

## Alternativas Consideradas

### Opcao A — Manter Railway (status quo)

- Deploy simples via `git push` ou `railway up`
- Custo baixo (~$5-20/mes dependendo do uso)
- **Adiado**: Latencia de ~150-200ms inaceitavel para roleplay em tempo real. Sem observabilidade adequada para producao

### Opcao B — EC2 t3.medium sa-east-1 (escolhida)

- Latencia de rede de ~20-50ms para usuarios brasileiros
- CloudWatch para metricas completas e alertas
- Custo previsivel e razoavel (~$50-55/mes)
- SSH para debugging direto em producao

### Opcao C — ECS Fargate sa-east-1

- Container serverless gerenciado pela AWS
- Auto-scaling nativo
- **Rejeitado para momento atual**: Custo significativamente maior (~$90-145/mes para configuracao equivalente). Complexidade de configuracao de task definitions, networking (VPC, subnets, security groups). Over-engineering para volume atual de usuarios. Pode ser reconsiderado quando houver necessidade de auto-scaling

### Opcao D — EC2 g4dn.xlarge Spot sa-east-1

- GPU NVIDIA T4 para futuro uso de NVIDIA A2F (ver [ADR-003](003-avatar-talkinghead.md))
- Spot instances reduzem custo em ~60-70%
- **Reservado para futuro**: Nao ha necessidade de GPU no momento (avatar atual e Hedra API ou TalkingHead.js no browser). Custo elevado mesmo com Spot (~$140-215/mes). Spot instances podem ser interrompidas, causando queda de sessoes ativas

## Consequencias

### Positivas

- **Reducao de latencia de ~50-100ms**: RTT de rede cai de ~150-200ms (US East) para ~20-50ms (sa-east-1), melhoria diretamente perceptivel na naturalidade da conversa
- **Observabilidade completa**: CloudWatch Metrics, Logs e Alarms permitem monitorar CPU, memoria, latencia do agent, sessoes ativas e configurar alertas automaticos
- **Acesso SSH direto**: Possibilidade de debugging em producao, analise de dumps de memoria, inspecao de processos em tempo real
- **Caminho para GPU**: sa-east-1 tem instancias g4dn disponiveis, permitindo upgrade futuro para NVIDIA A2F sem migrar regiao
- **IP fixo**: Elastic IP facilita configuracao de DNS e permite whitelisting em servicos externos

### Negativas

- **Aumento de custo de +$30-45/mes**: De ~$5-20 (Railway) para ~$50-55 (EC2), representando aumento de 175-1000% no custo de infra
- **Manutencao de servidor**: Responsabilidade por patches de seguranca do OS, atualizacoes de Docker, gerenciamento de disco, backup de configuracoes
- **Deploy manual**: Perda do deploy automatico do Railway. Necessidade de configurar CI/CD (GitHub Actions) ou deploy manual via SSH
- **Single point of failure**: Uma unica instancia EC2 sem auto-scaling ou failover. Queda da instancia = queda do servico

### Riscos

- **sa-east-1 e a regiao AWS mais cara**: Premium de ~35-50% sobre us-east-1 em todos os servicos. Custos podem ser maiores que o estimado dependendo do uso de data transfer e servicos adicionais
- **APIs externas continuam nos EUA**: OpenAI, Hedra, Deepgram e outros servicos rodam em servidores americanos. A latencia de rede entre sa-east-1 e essas APIs (~100-150ms) nao e eliminada, apenas a latencia browser-agent e reduzida
- **Sobrecarga operacional**: Gerenciar infra AWS requer conhecimento de VPC, security groups, IAM e monitoramento. Pode desviar foco do desenvolvimento do produto

## Referencias

- [AWS sa-east-1 Region Info](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/)
- [EC2 Pricing — sa-east-1](https://aws.amazon.com/ec2/pricing/on-demand/)
- [CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [ADR-003 — Avatar TalkingHead.js](003-avatar-talkinghead.md) (contexto sobre futuro uso de GPU para A2F)
