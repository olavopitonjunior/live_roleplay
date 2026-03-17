"""
LangSmith Tracing Module

Provides LangSmith observability for all LLM calls in the agent.
Gated on LANGCHAIN_TRACING_V2=true — zero overhead when disabled.

Usage:
    from tracing import get_traced_openai_client, traceable

    # In __init__ of any component:
    self._client = get_traced_openai_client(api_key=api_key)

    # Optional: decorate methods for component-level grouping:
    @traceable(name="emotion_analysis", tags=["emotion_analyzer"])
    async def _analyze_with_openai(self, ...):
        ...
"""

import os
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_tracing_enabled = os.getenv("LANGCHAIN_TRACING_V2", "").lower() == "true"

# Conditional imports — only load langsmith when tracing is enabled
if _tracing_enabled:
    try:
        from langsmith.wrappers import wrap_openai
        from langsmith import traceable as _ls_traceable
        logger.info("LangSmith tracing ENABLED (LANGCHAIN_TRACING_V2=true)")
    except ImportError:
        logger.warning("langsmith package not installed — tracing disabled")
        _tracing_enabled = False


def get_traced_openai_client(api_key: str | None = None) -> AsyncOpenAI:
    """
    Return an AsyncOpenAI client, wrapped with LangSmith tracing if enabled.

    Drop-in replacement for AsyncOpenAI() — all chat.completions.create()
    calls are automatically traced (input, output, tokens, latency).
    """
    client = AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
    if _tracing_enabled:
        client = wrap_openai(client)
        logger.debug("OpenAI client wrapped with LangSmith tracing")
    return client


if _tracing_enabled:
    # Re-export the real traceable decorator
    traceable = _ls_traceable

    def enrich_current_trace(metadata: dict) -> None:
        """Add metadata (e.g. session_id) to the current active trace run."""
        try:
            from langsmith import get_current_run_tree
            rt = get_current_run_tree()
            if rt:
                rt.extra = rt.extra or {}
                rt.extra.setdefault("metadata", {}).update(metadata)
        except Exception as e:
            logger.debug(f"Could not enrich trace metadata: {e}")
else:
    # No-op decorator when tracing is disabled
    def traceable(name: str = "", **kwargs):
        """No-op decorator — LangSmith tracing is disabled."""
        def decorator(fn):
            return fn
        return decorator

    def enrich_current_trace(metadata: dict) -> None:
        """No-op — LangSmith tracing is disabled."""
        pass
