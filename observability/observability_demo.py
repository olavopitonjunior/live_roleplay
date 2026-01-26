"""
Observability Demo - Aprenda metricas com LiteLLM + Prometheus + Ollama

Este script demonstra conceitos de observabilidade:
- Counters: metricas que so aumentam (total de requests)
- Gauges: valores que sobem e descem (uso de memoria)
- Histograms: distribuicao de valores (latencia)

Requisitos:
- Ollama rodando localmente (ollama serve)
- Um modelo instalado (ollama pull llama2 ou ollama pull mistral)
"""

import litellm
from prometheus_client import start_http_server, Counter, Histogram, Gauge, REGISTRY
import time
import random
from datetime import datetime

# ==============================================================================
# METRICAS CUSTOMIZADAS (para aprendizado)
# ==============================================================================

# COUNTER - so aumenta, nunca diminui
# Uso: contar eventos (requests, erros, mensagens)
requests_total = Counter(
    'app_requests_total',
    'Total de requests feitos',
    ['model', 'status']  # labels para filtrar
)

# HISTOGRAM - mede distribuicao de valores
# Uso: latencia, tamanho de resposta
latency_histogram = Histogram(
    'app_request_latency_seconds',
    'Latencia das requisicoes em segundos',
    ['model'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]  # intervalos de medicao
)

# GAUGE - valor que sobe e desce
# Uso: uso de memoria, conexoes ativas, fila
tokens_used_gauge = Gauge(
    'app_tokens_in_last_request',
    'Tokens usados na ultima requisicao',
    ['model']
)

requests_in_progress = Gauge(
    'app_requests_in_progress',
    'Requisicoes sendo processadas agora'
)

# ==============================================================================
# CONFIGURACAO DO LITELLM
# ==============================================================================

# Callback customizado para coletar metricas do LiteLLM
def metricas_callback(kwargs, response_obj, start_time, end_time):
    """Callback que coleta metricas apos cada chamada LLM"""
    model = kwargs.get("model", "unknown")

    # Calcular latencia
    latencia = (end_time - start_time).total_seconds() if hasattr(end_time, 'total_seconds') else end_time - start_time

    # Atualizar metricas
    requests_total.labels(model=model, status="success").inc()
    latency_histogram.labels(model=model).observe(latencia)

    # Tokens (se disponivel)
    if hasattr(response_obj, 'usage') and response_obj.usage:
        total_tokens = response_obj.usage.total_tokens
        tokens_used_gauge.labels(model=model).set(total_tokens)
        print(f"  Tokens: {total_tokens}")

    print(f"  Latencia: {latencia:.2f}s")

def erro_callback(kwargs, exception, start_time, end_time):
    """Callback para erros"""
    model = kwargs.get("model", "unknown")
    requests_total.labels(model=model, status="error").inc()
    print(f"  ERRO: {exception}")

# Registrar callbacks
litellm.success_callback = [metricas_callback]
litellm.failure_callback = [erro_callback]

# ==============================================================================
# FUNCAO PRINCIPAL
# ==============================================================================

def fazer_chamada_llm(modelo: str, prompt: str):
    """Faz uma chamada ao LLM e coleta metricas"""
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Chamando {modelo}...")

    requests_in_progress.inc()  # Incrementa gauge

    try:
        response = litellm.completion(
            model=modelo,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.7
        )

        # Mostrar resposta resumida
        texto = response.choices[0].message.content[:100]
        print(f"  Resposta: {texto}...")

        return response

    except Exception as e:
        print(f"  Erro: {e}")
        raise
    finally:
        requests_in_progress.dec()  # Decrementa gauge

def demo_metricas():
    """Executa demonstracao de metricas"""

    # Modelos Ollama para testar
    # Certifique-se de ter pelo menos um instalado: ollama pull llama2
    modelos = [
        "ollama/llama2",      # ou "ollama/mistral", "ollama/codellama"
    ]

    prompts = [
        "Explique o que e observabilidade em uma frase.",
        "O que sao metricas em sistemas de software?",
        "Qual a diferenca entre logs e metricas?",
        "O que e Prometheus?",
        "Para que serve o Grafana?",
    ]

    print("\n" + "="*60)
    print("DEMO DE OBSERVABILIDADE - LiteLLM + Prometheus + Ollama")
    print("="*60)
    print(f"\nModelos configurados: {modelos}")
    print(f"Total de prompts: {len(prompts)}")
    print("\nVeja as metricas em: http://localhost:8000/metrics")
    print("="*60)

    for i, prompt in enumerate(prompts, 1):
        print(f"\n--- Request {i}/{len(prompts)} ---")
        print(f"Prompt: {prompt[:50]}...")

        for modelo in modelos:
            try:
                fazer_chamada_llm(modelo, prompt)
            except Exception:
                pass  # Erro ja tratado no callback

        # Espera entre requests (simula uso real)
        if i < len(prompts):
            espera = random.uniform(1, 3)
            print(f"\nAguardando {espera:.1f}s...")
            time.sleep(espera)

    print("\n" + "="*60)
    print("DEMO CONCLUIDA!")
    print("="*60)
    print("\nProximos passos:")
    print("1. Acesse http://localhost:8000/metrics para ver metricas raw")
    print("2. Acesse http://localhost:9090 para queries no Prometheus")
    print("3. Acesse http://localhost:3000 para dashboards no Grafana")
    print("\nQueries PromQL para testar:")
    print("  - app_requests_total")
    print("  - rate(app_requests_total[1m])")
    print("  - histogram_quantile(0.95, app_request_latency_seconds_bucket)")
    print("  - app_tokens_in_last_request")

def main():
    # Iniciar servidor de metricas Prometheus
    porta_metricas = 8000
    start_http_server(porta_metricas)
    print(f"\nServidor de metricas iniciado na porta {porta_metricas}")
    print(f"Acesse: http://localhost:{porta_metricas}/metrics")

    # Verificar se Ollama esta rodando
    print("\nVerificando conexao com Ollama...")
    try:
        import requests
        resp = requests.get("http://localhost:11434/api/tags", timeout=5)
        if resp.status_code == 200:
            modelos = resp.json().get("models", [])
            print(f"Ollama conectado! Modelos disponiveis: {[m['name'] for m in modelos]}")
        else:
            print("Ollama respondeu mas pode haver problemas")
    except Exception as e:
        print(f"AVISO: Nao foi possivel conectar ao Ollama: {e}")
        print("Certifique-se de que o Ollama esta rodando: ollama serve")
        print("E que voce tem um modelo instalado: ollama pull llama2")

    # Executar demo
    demo_metricas()

    # Manter servidor rodando para Prometheus coletar metricas
    print("\nServidor de metricas continua rodando...")
    print("Pressione Ctrl+C para encerrar\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nEncerrando...")

if __name__ == "__main__":
    main()
