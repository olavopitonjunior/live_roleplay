# Observability Demo - Aprenda Metricas na Pratica

Este projeto demonstra conceitos de observabilidade usando:
- **LiteLLM** - Interface unificada para LLMs
- **Ollama** - LLMs locais (gratuito)
- **Prometheus** - Coleta e armazenamento de metricas
- **Grafana** - Visualizacao e dashboards

## Conceitos que Voce Vai Aprender

| Conceito | Tipo | Exemplo |
|----------|------|---------|
| **Counter** | So aumenta | Total de requests, erros |
| **Gauge** | Sobe e desce | Memoria em uso, fila |
| **Histogram** | Distribuicao | Latencia (p50, p95, p99) |
| **Labels** | Dimensoes | Filtrar por modelo, status |

## Pre-requisitos

1. **Python 3.9+**
2. **Docker e Docker Compose**
3. **Ollama** instalado e rodando

## Setup Rapido

### 1. Instalar Ollama

```bash
# Windows: baixe de https://ollama.ai
# Ou via winget:
winget install Ollama.Ollama

# Iniciar Ollama
ollama serve

# Baixar um modelo (em outro terminal)
ollama pull llama2
# ou modelo menor:
ollama pull tinyllama
```

### 2. Instalar Dependencias Python

```bash
cd observability
pip install litellm prometheus-client requests
```

### 3. Subir Prometheus + Grafana

```bash
docker-compose up -d
```

### 4. Rodar o Script de Demo

```bash
python observability_demo.py
```

## Acessando as Ferramentas

| Ferramenta | URL | Credenciais |
|------------|-----|-------------|
| Metricas Raw | http://localhost:8000/metrics | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin / admin |

## Queries PromQL para Praticar

Acesse http://localhost:9090 e teste:

```promql
# Total de requests
app_requests_total

# Taxa de requests por segundo (ultimos 5 min)
rate(app_requests_total[5m])

# Requests por status (sucesso vs erro)
sum by (status) (app_requests_total)

# Latencia media
rate(app_request_latency_seconds_sum[5m]) / rate(app_request_latency_seconds_count[5m])

# Latencia percentil 95
histogram_quantile(0.95, rate(app_request_latency_seconds_bucket[5m]))

# Latencia percentil 99
histogram_quantile(0.99, rate(app_request_latency_seconds_bucket[5m]))

# Tokens usados (ultimo valor)
app_tokens_in_last_request

# Requests em andamento
app_requests_in_progress
```

## Criando um Dashboard no Grafana

1. Acesse http://localhost:3000 (admin/admin)
2. Va em **Dashboards** > **New** > **New Dashboard**
3. Clique em **Add visualization**
4. Selecione **Prometheus** como datasource
5. Adicione as queries acima

### Paineis Sugeridos

**Painel 1: Taxa de Requests**
- Tipo: Time series
- Query: `rate(app_requests_total[1m])`

**Painel 2: Latencia P95**
- Tipo: Stat ou Gauge
- Query: `histogram_quantile(0.95, rate(app_request_latency_seconds_bucket[5m]))`

**Painel 3: Requests por Status**
- Tipo: Pie chart
- Query: `sum by (status) (app_requests_total)`

**Painel 4: Tokens Usados**
- Tipo: Time series
- Query: `app_tokens_in_last_request`

## Estrutura do Projeto

```
observability/
├── observability_demo.py    # Script principal com metricas
├── prometheus.yml           # Config do Prometheus
├── docker-compose.yml       # Stack Prometheus + Grafana
├── grafana/
│   └── provisioning/
│       └── datasources/
│           └── datasource.yml  # Auto-config do datasource
└── README.md                # Este arquivo
```

## Troubleshooting

### Ollama nao conecta
```bash
# Verificar se esta rodando
curl http://localhost:11434/api/tags

# Se nao estiver, iniciar:
ollama serve
```

### Prometheus nao coleta metricas
```bash
# Verificar se a app Python esta rodando
curl http://localhost:8000/metrics

# Verificar targets no Prometheus
# Acesse http://localhost:9090/targets
```

### Grafana sem dados
1. Verifique se Prometheus esta coletando (Status > Targets)
2. Verifique se o datasource esta configurado (Settings > Data sources)
3. Ajuste o time range no dashboard (ultimo 15min ou 1h)

## Proximos Passos

1. **Alertas**: Configure alertas no Prometheus/Grafana
2. **Mais metricas**: Adicione metricas de negocio
3. **Tracing**: Integre com Jaeger ou Zipkin
4. **Logs**: Adicione Loki para logs centralizados

## Recursos

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [LiteLLM Docs](https://docs.litellm.ai/)
- [Ollama](https://ollama.ai/)
