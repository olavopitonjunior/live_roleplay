"""Shared fixtures for coach_orchestrator tests."""
import sys
import os
from unittest.mock import patch
from datetime import datetime, timezone

import pytest

# Add agent dir to path so we can import coach_orchestrator
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Patch OpenAI before importing coach_orchestrator
with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
    from coach_orchestrator import CoachOrchestrator
    from ai_coach import AISuggestion, MethodologyStep, SuggestionType


MOCK_SCENARIO = {
    "context": "Venda de software CRM para empresa de medio porte",
    "avatar_profile": "Carlos, gerente de TI de uma empresa de 200 funcionarios",
    "objections": [
        {"description": "Preco alto para o orcamento"},
        {"description": "Ja temos um sistema legado"},
    ],
}

MOCK_OUTCOMES = [
    {
        "outcome_type": "sale_closed",
        "description": "Cliente decide comprar o CRM",
        "avatar_closing_line": "Vamos fechar negocio!",
        "display_order": 1,
    },
    {
        "outcome_type": "rejected",
        "description": "Cliente rejeita a proposta",
        "avatar_closing_line": "Nao estou interessado.",
        "display_order": 2,
    },
]

MOCK_RUBRICS = [
    {
        "criterion_name": "Descoberta de necessidades",
        "criterion_description": "Faz perguntas SPIN para entender o cliente",
        "weight": 2,
        "level_1_descriptor": "Nao faz perguntas",
        "level_4_descriptor": "Perguntas profundas e relevantes",
    },
    {
        "criterion_name": "Tratamento de objecoes",
        "criterion_description": "Responde objecoes com empatia e dados",
        "weight": 1,
        "level_1_descriptor": "Ignora objecoes",
        "level_4_descriptor": "Transforma objecoes em oportunidades",
    },
]


def make_suggestion(
    id="sug_1",
    type=SuggestionType.QUESTION,
    message="Pergunte sobre o ROI atual da empresa",
    methodology_step=None,
):
    return AISuggestion(
        id=id,
        type=type,
        title="Sugestao",
        message=message,
        context="Contexto",
        priority=1,
        methodology_step=methodology_step,
    )


@pytest.fixture
def orchestrator():
    """Create a fresh CoachOrchestrator with mocked OpenAI."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
        orch = CoachOrchestrator()
        orch._client = None  # Disable AI path
        orch.start_session(
            scenario=MOCK_SCENARIO,
            outcomes=MOCK_OUTCOMES,
            criterion_rubrics=MOCK_RUBRICS,
            difficulty_level=5,
            session_mode="training",
            duration_seconds=180,
        )
        return orch


@pytest.fixture
def eval_orchestrator():
    """Orchestrator in evaluation mode (coaching disabled)."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
        orch = CoachOrchestrator()
        orch._client = None
        orch.start_session(
            scenario=MOCK_SCENARIO,
            outcomes=MOCK_OUTCOMES,
            criterion_rubrics=MOCK_RUBRICS,
            difficulty_level=5,
            session_mode="evaluation",
            duration_seconds=180,
        )
        return orch


@pytest.fixture
def suggestion():
    return make_suggestion()


@pytest.fixture
def question_suggestion():
    return make_suggestion(
        id="sug_q1",
        type=SuggestionType.QUESTION,
        message="Pergunte sobre o ROI atual da empresa",
        methodology_step=MethodologyStep.SITUATION,
    )
