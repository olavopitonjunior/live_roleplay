"""
Pipecat Flow configuration for the Retention scenario.

5-state FSM based on tests/benchmark/fixtures/scenario_retention.json:
  greeting → engagement → objection_handling → resolution → closing

Uses DYNAMIC flows — each handler function returns (result, next_node_config).
The LLM decides WHEN to call a transition function based on conversation progress.
"""

import logging
from typing import Any

from pipecat_flows import FlowManager, FlowsFunctionSchema

logger = logging.getLogger(__name__)

# Type alias for Pipecat Flows
FlowArgs = dict[str, Any]
NodeConfig = dict[str, Any]


def get_retention_flow_config(scenario: dict) -> dict:
    """Build the static flow config for the retention scenario.

    Returns a flow_config dict compatible with FlowManager(flow_config=...).

    The static flow defines all nodes and transitions upfront.
    The LLM decides when to call transition functions based on conversation.
    """
    avatar_name = scenario.get("avatar_name", "Carlos")
    context = scenario.get("context", "")
    profile = scenario.get("avatar_profile", "")
    objections = scenario.get("objections", [])
    difficulty = scenario.get("difficulty_level", 5)

    # Difficulty-based behavior hints
    if difficulty <= 3:
        behavior = "Seja receptivo e aceite bons argumentos rapidamente."
    elif difficulty <= 6:
        behavior = "Seja moderadamente exigente. Questione mas esteja aberto."
    else:
        behavior = "Seja muito exigente e cetico. Nao aceite facilmente."

    base_role = (
        f"Voce e {avatar_name}. {profile}\n"
        f"Contexto: {context}\n"
        f"Dificuldade: {difficulty}/10. {behavior}\n"
        f"REGRA: Voce e SEMPRE o cliente. NUNCA inverta papeis."
    )

    return {
        "initial_node": "greeting",
        "nodes": {
            "greeting": {
                "role_messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{base_role}\n\n"
                            "Cumprimente o atendente de forma BREVE e direta. "
                            "Diga que quer resolver o problema — nao entre em detalhes ainda."
                        ),
                    }
                ],
                "task_messages": [
                    {
                        "role": "system",
                        "content": "Diga 'ola' e mencione brevemente que tem um problema para resolver.",
                    }
                ],
                "functions": [
                    {
                        "type": "function",
                        "function": {
                            "name": "move_to_engagement",
                            "description": (
                                "O atendente respondeu ao cumprimento. "
                                "Mova para explicar o problema em detalhes."
                            ),
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "engagement",
                        },
                    }
                ],
            },
            "engagement": {
                "role_messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{base_role}\n\n"
                            f"Explique o problema principal: {objections[0] if objections else 'problema geral'}.\n"
                            "Espere a resposta do atendente antes de mencionar outros problemas."
                        ),
                    }
                ],
                "task_messages": [
                    {
                        "role": "system",
                        "content": "Explique seu problema principal e espere uma resposta.",
                    }
                ],
                "functions": [
                    {
                        "type": "function",
                        "function": {
                            "name": "present_more_objections",
                            "description": (
                                "O atendente respondeu ao problema inicial. "
                                "Apresente objecoes adicionais."
                            ),
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "objection_handling",
                        },
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "escalate_early",
                            "description": (
                                "O atendente nao esta ajudando. "
                                "Peca para falar com supervisor ou encerre."
                            ),
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "closing",
                        },
                    },
                ],
            },
            "objection_handling": {
                "role_messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{base_role}\n\n"
                            f"Apresente estas objecoes adicionais uma por uma:\n"
                            + "\n".join(
                                f"- {obj}" for obj in objections[1:]
                            )
                            + "\n\nReaja as respostas do atendente de forma realista."
                        ),
                    }
                ],
                "task_messages": [
                    {
                        "role": "system",
                        "content": "Apresente suas objecoes e avalie as respostas do atendente.",
                    }
                ],
                "functions": [
                    {
                        "type": "function",
                        "function": {
                            "name": "consider_proposal",
                            "description": (
                                "O atendente fez uma proposta razoavel. "
                                "Avalie se aceita."
                            ),
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "resolution",
                        },
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "insist_on_cancel",
                            "description": (
                                "Nenhuma solucao satisfatoria. "
                                "Insista no cancelamento."
                            ),
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "closing",
                        },
                    },
                ],
            },
            "resolution": {
                "role_messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{base_role}\n\n"
                            "O atendente fez uma proposta. Avalie-a com cuidado.\n"
                            "Se for boa, aceite. Se tiver duvidas, pergunte. "
                            "Seja realista na sua decisao."
                        ),
                    }
                ],
                "task_messages": [
                    {
                        "role": "system",
                        "content": "Avalie a proposta do atendente e decida.",
                    }
                ],
                "functions": [
                    {
                        "type": "function",
                        "function": {
                            "name": "accept_and_stay",
                            "description": "Aceitar a proposta e permanecer como cliente.",
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "closing",
                        },
                    },
                    {
                        "type": "function",
                        "function": {
                            "name": "reject_and_escalate",
                            "description": "Rejeitar a proposta e pedir supervisor.",
                            "parameters": {"type": "object", "properties": {}},
                            "transition_to": "closing",
                        },
                    },
                ],
            },
            "closing": {
                "role_messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{base_role}\n\n"
                            "Encerre a conversa naturalmente. "
                            "Seja breve e objetivo na despedida."
                        ),
                    }
                ],
                "task_messages": [
                    {
                        "role": "system",
                        "content": "Despeca-se de forma natural e encerre a conversa.",
                    }
                ],
                "functions": [],  # Terminal node — no transitions
            },
        },
    }
