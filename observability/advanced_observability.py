"""
Advanced LLM Observability - Metricas Completas

Este script demonstra metricas avancadas para LLMs:
- TTFT (Time To First Token)
- TPOT (Time Per Output Token)
- TPS (Tokens Per Second)
- Custos
- Evals basicos (qualidade)

Conceitos aplicaveis a QUALQUER projeto com LLMs.
"""

import litellm
from prometheus_client import (
    start_http_server,
    Counter,
    Histogram,
    Gauge,
    Summary,
    Info
)
import time
import json
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional
import re

# ==============================================================================
# METRICAS PROMETHEUS - Completas para LLMs
# ==============================================================================

# --- LATENCIA ---
ttft_histogram = Histogram(
    'llm_time_to_first_token_seconds',
    'Time To First Token - tempo ate o primeiro token chegar',
    ['model', 'provider'],
    buckets=[0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0]
)

tpot_histogram = Histogram(
    'llm_time_per_output_token_seconds',
    'Time Per Output Token - tempo medio por token',
    ['model', 'provider'],
    buckets=[0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5]
)

e2e_latency_histogram = Histogram(
    'llm_e2e_latency_seconds',
    'End-to-end latency - tempo total da requisicao',
    ['model', 'provider'],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

# --- TOKENS ---
input_tokens_counter = Counter(
    'llm_input_tokens_total',
    'Total de tokens de entrada (prompt)',
    ['model', 'provider']
)

output_tokens_counter = Counter(
    'llm_output_tokens_total',
    'Total de tokens de saida (completion)',
    ['model', 'provider']
)

tokens_per_second_gauge = Gauge(
    'llm_tokens_per_second',
    'Tokens gerados por segundo (ultima requisicao)',
    ['model', 'provider']
)

# --- CUSTOS ---
cost_counter = Counter(
    'llm_cost_dollars_total',
    'Custo total em dolares',
    ['model', 'provider']
)

cost_per_request_histogram = Histogram(
    'llm_cost_per_request_dollars',
    'Custo por requisicao em dolares',
    ['model', 'provider'],
    buckets=[0.0001, 0.001, 0.01, 0.05, 0.1, 0.5, 1.0]
)

# --- REQUESTS ---
requests_total = Counter(
    'llm_requests_total',
    'Total de requisicoes',
    ['model', 'provider', 'status', 'error_type']
)

requests_in_flight = Gauge(
    'llm_requests_in_flight',
    'Requisicoes em andamento',
    ['model']
)

# --- CACHE ---
cache_hits = Counter(
    'llm_cache_hits_total',
    'Cache hits',
    ['model']
)

cache_misses = Counter(
    'llm_cache_misses_total',
    'Cache misses',
    ['model']
)

# --- QUALIDADE (Evals) ---
response_relevance_histogram = Histogram(
    'llm_response_relevance_score',
    'Score de relevancia da resposta (0-1)',
    ['model'],
    buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

response_length_histogram = Histogram(
    'llm_response_length_chars',
    'Tamanho da resposta em caracteres',
    ['model'],
    buckets=[50, 100, 250, 500, 1000, 2000, 5000]
)

# --- RATE LIMITS ---
rate_limit_errors = Counter(
    'llm_rate_limit_errors_total',
    'Erros de rate limit',
    ['model', 'provider']
)

retry_count = Counter(
    'llm_retries_total',
    'Total de retries',
    ['model', 'provider']
)

# ==============================================================================
# ESTRUTURA DE DADOS PARA OBSERVABILIDADE
# ==============================================================================

@dataclass
class LLMMetrics:
    """Estrutura para armazenar metricas de uma chamada LLM"""
    model: str
    provider: str

    # Latencia
    ttft_seconds: Optional[float] = None  # Time to First Token
    tpot_seconds: Optional[float] = None  # Time per Output Token
    e2e_latency_seconds: Optional[float] = None  # End-to-end

    # Tokens
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    tokens_per_second: float = 0.0

    # Custo
    cost_dollars: float = 0.0

    # Status
    success: bool = True
    error_type: Optional[str] = None

    # Qualidade
    relevance_score: Optional[float] = None

    # Metadata
    timestamp: str = ""
    request_id: str = ""

    def to_dict(self):
        return asdict(self)

# ==============================================================================
# FUNCOES DE AVALIACAO (EVALS)
# ==============================================================================

def simple_relevance_eval(prompt: str, response: str) -> float:
    """
    Avaliacao simples de relevancia.
    Em producao, use ferramentas como:
    - OpenAI Evals
    - Langfuse
    - Ragas
    - DeepEval
    """
    if not response:
        return 0.0

    # Extrai palavras-chave do prompt
    prompt_words = set(prompt.lower().split())
    response_words = set(response.lower().split())

    # Calcula overlap
    common_words = prompt_words & response_words

    # Remove palavras comuns (stopwords simplificado)
    stopwords = {'o', 'a', 'e', 'de', 'da', 'do', 'que', 'em', 'um', 'uma', 'para', 'com', 'the', 'is', 'a', 'an', 'and', 'or', 'of', 'to', 'in'}
    common_words = common_words - stopwords
    prompt_words = prompt_words - stopwords

    if not prompt_words:
        return 0.5

    relevance = len(common_words) / len(prompt_words)
    return min(relevance * 2, 1.0)  # Normaliza para 0-1

def check_response_quality(response: str) -> dict:
    """
    Verifica qualidade basica da resposta.
    Retorna dict com varias metricas de qualidade.
    """
    return {
        'length': len(response),
        'word_count': len(response.split()),
        'has_content': len(response.strip()) > 0,
        'sentence_count': len(re.split(r'[.!?]+', response)),
        'avg_word_length': sum(len(w) for w in response.split()) / max(len(response.split()), 1)
    }

# ==============================================================================
# CLASSE PRINCIPAL DE OBSERVABILIDADE
# ==============================================================================

class LLMObserver:
    """
    Classe reutilizavel para observabilidade de LLMs.
    Use em qualquer projeto!
    """

    def __init__(self, default_provider: str = "ollama"):
        self.default_provider = default_provider
        self.metrics_log = []  # Historico de metricas

    def _extract_provider(self, model: str) -> str:
        """Extrai provider do nome do modelo"""
        if "/" in model:
            return model.split("/")[0]
        return self.default_provider

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """
        Calcula custo estimado.
        Em producao, use litellm.completion_cost() para valores reais.
        """
        # Precos aproximados por 1K tokens (exemplo)
        pricing = {
            "gpt-4": {"input": 0.03, "output": 0.06},
            "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
            "claude-3-opus": {"input": 0.015, "output": 0.075},
            "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            "llama2": {"input": 0.0, "output": 0.0},  # Local = gratis
            "mistral": {"input": 0.0, "output": 0.0},
        }

        model_base = model.split("/")[-1].split(":")[0]
        prices = pricing.get(model_base, {"input": 0.0, "output": 0.0})

        cost = (input_tokens / 1000 * prices["input"]) + (output_tokens / 1000 * prices["output"])
        return cost

    def completion_with_metrics(
        self,
        model: str,
        messages: list,
        stream: bool = True,
        **kwargs
    ) -> tuple:
        """
        Faz chamada LLM com coleta completa de metricas.

        Returns:
            tuple: (response_text, metrics)
        """
        provider = self._extract_provider(model)
        metrics = LLMMetrics(
            model=model,
            provider=provider,
            timestamp=datetime.now().isoformat(),
            request_id=f"req_{int(time.time()*1000)}"
        )

        requests_in_flight.labels(model=model).inc()
        start_time = time.time()
        first_token_time = None
        response_text = ""
        token_times = []

        try:
            if stream:
                # Streaming - permite medir TTFT
                response = litellm.completion(
                    model=model,
                    messages=messages,
                    stream=True,
                    **kwargs
                )

                for chunk in response:
                    current_time = time.time()

                    # Captura TTFT
                    if first_token_time is None:
                        first_token_time = current_time
                        metrics.ttft_seconds = first_token_time - start_time

                    # Acumula texto
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        response_text += content
                        token_times.append(current_time)

                # Calcula TPOT
                if len(token_times) > 1:
                    total_token_time = token_times[-1] - token_times[0]
                    metrics.tpot_seconds = total_token_time / len(token_times)

            else:
                # Non-streaming
                response = litellm.completion(
                    model=model,
                    messages=messages,
                    stream=False,
                    **kwargs
                )
                response_text = response.choices[0].message.content

                # Estima tokens da resposta
                if hasattr(response, 'usage') and response.usage:
                    metrics.input_tokens = response.usage.prompt_tokens
                    metrics.output_tokens = response.usage.completion_tokens
                    metrics.total_tokens = response.usage.total_tokens

            # Calcula metricas finais
            end_time = time.time()
            metrics.e2e_latency_seconds = end_time - start_time

            # Estima tokens se nao veio do response
            if metrics.output_tokens == 0:
                metrics.output_tokens = len(response_text.split()) * 1.3  # Aproximacao
                metrics.input_tokens = sum(len(m.get('content', '').split()) for m in messages) * 1.3
                metrics.total_tokens = metrics.input_tokens + metrics.output_tokens

            # Tokens por segundo
            if metrics.e2e_latency_seconds > 0:
                metrics.tokens_per_second = metrics.output_tokens / metrics.e2e_latency_seconds

            # Custo
            metrics.cost_dollars = self._calculate_cost(
                model,
                int(metrics.input_tokens),
                int(metrics.output_tokens)
            )

            # Avaliacao de qualidade
            prompt_text = messages[-1].get('content', '') if messages else ''
            metrics.relevance_score = simple_relevance_eval(prompt_text, response_text)

            metrics.success = True

        except Exception as e:
            metrics.success = False
            metrics.error_type = type(e).__name__

            # Detecta rate limit
            if "rate" in str(e).lower() or "429" in str(e):
                rate_limit_errors.labels(model=model, provider=provider).inc()
                metrics.error_type = "RateLimitError"

            raise

        finally:
            requests_in_flight.labels(model=model).dec()
            self._record_metrics(metrics)
            self.metrics_log.append(metrics.to_dict())

        return response_text, metrics

    def _record_metrics(self, metrics: LLMMetrics):
        """Registra metricas no Prometheus"""
        labels = {"model": metrics.model, "provider": metrics.provider}

        # Latencia
        if metrics.ttft_seconds is not None:
            ttft_histogram.labels(**labels).observe(metrics.ttft_seconds)

        if metrics.tpot_seconds is not None:
            tpot_histogram.labels(**labels).observe(metrics.tpot_seconds)

        if metrics.e2e_latency_seconds is not None:
            e2e_latency_histogram.labels(**labels).observe(metrics.e2e_latency_seconds)

        # Tokens
        input_tokens_counter.labels(**labels).inc(metrics.input_tokens)
        output_tokens_counter.labels(**labels).inc(metrics.output_tokens)
        tokens_per_second_gauge.labels(**labels).set(metrics.tokens_per_second)

        # Custo
        cost_counter.labels(**labels).inc(metrics.cost_dollars)
        cost_per_request_histogram.labels(**labels).observe(metrics.cost_dollars)

        # Status
        error_type = metrics.error_type or "none"
        status = "success" if metrics.success else "error"
        requests_total.labels(
            model=metrics.model,
            provider=metrics.provider,
            status=status,
            error_type=error_type
        ).inc()

        # Qualidade
        if metrics.relevance_score is not None:
            response_relevance_histogram.labels(model=metrics.model).observe(metrics.relevance_score)

    def get_summary(self) -> dict:
        """Retorna resumo das metricas coletadas"""
        if not self.metrics_log:
            return {}

        total_requests = len(self.metrics_log)
        successful = sum(1 for m in self.metrics_log if m['success'])
        total_tokens = sum(m['total_tokens'] for m in self.metrics_log)
        total_cost = sum(m['cost_dollars'] for m in self.metrics_log)

        latencies = [m['e2e_latency_seconds'] for m in self.metrics_log if m['e2e_latency_seconds']]
        avg_latency = sum(latencies) / len(latencies) if latencies else 0

        ttfts = [m['ttft_seconds'] for m in self.metrics_log if m['ttft_seconds']]
        avg_ttft = sum(ttfts) / len(ttfts) if ttfts else 0

        return {
            "total_requests": total_requests,
            "successful_requests": successful,
            "success_rate": successful / total_requests if total_requests else 0,
            "total_tokens": total_tokens,
            "total_cost_dollars": total_cost,
            "avg_latency_seconds": avg_latency,
            "avg_ttft_seconds": avg_ttft,
        }

# ==============================================================================
# DEMONSTRACAO
# ==============================================================================

def run_demo():
    """Executa demonstracao de metricas avancadas"""

    print("\n" + "="*70)
    print("ADVANCED LLM OBSERVABILITY DEMO")
    print("="*70)
    print("\nMetricas disponiveis em: http://localhost:8001/metrics")
    print("="*70)

    # Cria observer
    observer = LLMObserver(default_provider="ollama")

    # Prompts de teste
    test_cases = [
        {
            "name": "Pergunta simples",
            "messages": [{"role": "user", "content": "O que e observabilidade?"}]
        },
        {
            "name": "Pergunta tecnica",
            "messages": [{"role": "user", "content": "Explique TTFT e TPOT em sistemas de LLM."}]
        },
        {
            "name": "Codigo",
            "messages": [{"role": "user", "content": "Escreva uma funcao Python que calcula fibonacci."}]
        },
        {
            "name": "Criativo",
            "messages": [{"role": "user", "content": "Crie um haiku sobre programacao."}]
        },
    ]

    model = "ollama/llama2"

    for i, test in enumerate(test_cases, 1):
        print(f"\n--- Teste {i}/{len(test_cases)}: {test['name']} ---")
        print(f"Prompt: {test['messages'][0]['content'][:50]}...")

        try:
            response, metrics = observer.completion_with_metrics(
                model=model,
                messages=test['messages'],
                stream=True,
                max_tokens=150
            )

            print(f"\nResposta: {response[:100]}...")
            print(f"\n[METRICAS]")
            print(f"  TTFT: {metrics.ttft_seconds:.3f}s" if metrics.ttft_seconds else "  TTFT: N/A")
            print(f"  TPOT: {metrics.tpot_seconds:.4f}s" if metrics.tpot_seconds else "  TPOT: N/A")
            print(f"  E2E Latency: {metrics.e2e_latency_seconds:.2f}s")
            print(f"  Tokens: {int(metrics.input_tokens)} in / {int(metrics.output_tokens)} out")
            print(f"  TPS: {metrics.tokens_per_second:.1f} tokens/s")
            print(f"  Custo: ${metrics.cost_dollars:.6f}")
            print(f"  Relevancia: {metrics.relevance_score:.2f}" if metrics.relevance_score else "")

        except Exception as e:
            print(f"  ERRO: {e}")

        time.sleep(1)

    # Resumo final
    print("\n" + "="*70)
    print("RESUMO FINAL")
    print("="*70)

    summary = observer.get_summary()
    print(f"""
Total de Requests: {summary.get('total_requests', 0)}
Taxa de Sucesso: {summary.get('success_rate', 0)*100:.1f}%
Total de Tokens: {summary.get('total_tokens', 0):.0f}
Custo Total: ${summary.get('total_cost_dollars', 0):.6f}
Latencia Media: {summary.get('avg_latency_seconds', 0):.2f}s
TTFT Medio: {summary.get('avg_ttft_seconds', 0):.3f}s
""")

    print("="*70)
    print("\nMETRICAS PROMETHEUS DISPONIVEIS:")
    print("="*70)
    print("""
LATENCIA:
  - llm_time_to_first_token_seconds    (TTFT)
  - llm_time_per_output_token_seconds  (TPOT)
  - llm_e2e_latency_seconds            (End-to-end)

TOKENS:
  - llm_input_tokens_total
  - llm_output_tokens_total
  - llm_tokens_per_second

CUSTO:
  - llm_cost_dollars_total
  - llm_cost_per_request_dollars

QUALIDADE:
  - llm_response_relevance_score
  - llm_response_length_chars

STATUS:
  - llm_requests_total
  - llm_requests_in_flight
  - llm_rate_limit_errors_total
""")

    print("\nServidor de metricas continua rodando...")
    print("Pressione Ctrl+C para encerrar\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nEncerrando...")

# ==============================================================================
# COMO USAR EM OUTROS PROJETOS
# ==============================================================================

"""
COMO USAR EM QUALQUER PROJETO:

1. INSTALACAO:
   pip install litellm prometheus-client

2. CODIGO MINIMO:

   from advanced_observability import LLMObserver
   from prometheus_client import start_http_server

   # Inicia servidor de metricas
   start_http_server(8001)

   # Cria observer
   observer = LLMObserver()

   # Usa em qualquer chamada LLM
   response, metrics = observer.completion_with_metrics(
       model="gpt-4",  # ou "ollama/llama2", "claude-3-sonnet", etc.
       messages=[{"role": "user", "content": "Sua pergunta"}],
       stream=True
   )

   # Acesse metricas em http://localhost:8001/metrics

3. INTEGRACAO COM GRAFANA:
   - Configure Prometheus para coletar de localhost:8001
   - Importe dashboard ou crie queries como:
     - rate(llm_requests_total[5m])
     - histogram_quantile(0.95, llm_time_to_first_token_seconds_bucket)
     - sum(llm_cost_dollars_total) by (model)

4. ALERTAS SUGERIDOS:
   - TTFT > 2s (experiencia ruim)
   - Taxa de erro > 5%
   - Rate limit errors > 0
   - Custo diario > limite
"""

if __name__ == "__main__":
    # Inicia servidor de metricas na porta 8001 (diferente do demo basico)
    start_http_server(8001)
    run_demo()
