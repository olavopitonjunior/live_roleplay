"""Unit tests for coach_orchestrator.py — pure logic, no API calls."""
import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

# Ensure agent dir is on path (conftest does this too, but be safe)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from coach_orchestrator import (
    AgentState,
    AvatarDirective,
    CoachOrchestrator,
    DIFFICULTY_THRESHOLDS,
    DIMENSION_WEIGHTS,
    InjectionQueue,
    SessionScore,
    SuggestionLifecycle,
    TurnEvaluation,
    WMA_WEIGHTS,
    _parse_methodology_step,
)
from ai_coach import AISuggestion, LearningProfile, MethodologyStep, SuggestionType


# ---------------------------------------------------------------------------
# Test constants (duplicated from conftest to avoid import issues)
# ---------------------------------------------------------------------------

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


# =====================================================================
# 1. Scoring Algorithm
# =====================================================================

class TestScoringAlgorithm:
    """Tests for _update_score, _recalculate_score, WMA, trajectory."""

    def test_initial_score_is_neutral(self, orchestrator):
        assert orchestrator._session_score.cumulative == 50.0
        assert orchestrator._session_score.trajectory == "neutral"
        assert orchestrator._session_score.turns_evaluated == 0

    def test_single_turn_wma(self, orchestrator):
        """Single turn: WMA with 1 weight → score equals turn score."""
        ev = TurnEvaluation(
            turn_number=1, speaker="user", text="test",
            timestamp=datetime.now(timezone.utc),
            coach_adherence=0.8, emotional_quality=0.7,
            objection_handling=0.6, conversation_quality=0.9,
        )
        ev.weighted_score = (
            0.8 * 0.30 + 0.7 * 0.20 + 0.6 * 0.25 + 0.9 * 0.25
        ) * 100  # = 75.5
        orchestrator._turn_evaluations.append(ev)
        orchestrator._update_score(ev)

        assert orchestrator._session_score.turns_evaluated == 1
        assert abs(orchestrator._session_score.cumulative - 75.5) < 0.1

    def test_wma_with_multiple_turns(self, orchestrator):
        """5 turns: verify WMA calculation matches hand-computed."""
        scores = [40, 50, 60, 70, 80]
        for i, s in enumerate(scores):
            ev = TurnEvaluation(
                turn_number=i + 1, speaker="user", text="t",
                timestamp=datetime.now(timezone.utc),
                weighted_score=s,
            )
            orchestrator._turn_evaluations.append(ev)
            orchestrator._update_score(ev)

        # WMA: (40*0.10 + 50*0.15 + 60*0.20 + 70*0.25 + 80*0.30) / 1.0
        expected = (4 + 7.5 + 12 + 17.5 + 24) / 1.0  # = 65.0
        assert abs(orchestrator._session_score.cumulative - expected) < 0.1
        assert orchestrator._session_score.turns_evaluated == 5

    def test_wma_window_cap_at_5(self, orchestrator):
        """Adding 6th turn drops the 1st from window."""
        for i in range(6):
            ev = TurnEvaluation(
                turn_number=i + 1, speaker="user", text="t",
                timestamp=datetime.now(timezone.utc),
                weighted_score=50.0 + i * 10,  # 50, 60, 70, 80, 90, 100
            )
            orchestrator._turn_evaluations.append(ev)
            orchestrator._update_score(ev)

        # Window: [60, 70, 80, 90, 100]
        expected = (60 * 0.10 + 70 * 0.15 + 80 * 0.20 + 90 * 0.25 + 100 * 0.30) / 1.0
        assert abs(orchestrator._session_score.cumulative - expected) < 0.1
        assert len(orchestrator._session_score.turn_scores) == 5

    def test_trajectory_positive(self, orchestrator):
        """Score above threshold → positive trajectory."""
        # threshold for difficulty 5 is 52
        ev = TurnEvaluation(
            turn_number=1, speaker="user", text="t",
            timestamp=datetime.now(timezone.utc), weighted_score=60.0,
        )
        orchestrator._turn_evaluations.append(ev)
        orchestrator._update_score(ev)
        assert orchestrator._session_score.trajectory == "positive"

    def test_trajectory_negative(self, orchestrator):
        """Score <= threshold-15 → negative trajectory."""
        # threshold=52, negative when <= 37
        ev = TurnEvaluation(
            turn_number=1, speaker="user", text="t",
            timestamp=datetime.now(timezone.utc), weighted_score=30.0,
        )
        orchestrator._turn_evaluations.append(ev)
        orchestrator._update_score(ev)
        assert orchestrator._session_score.trajectory == "negative"

    def test_trajectory_neutral_in_between(self, orchestrator):
        """Score between threshold-15 and threshold → neutral."""
        # threshold=52, neutral when 37 < score < 52
        ev = TurnEvaluation(
            turn_number=1, speaker="user", text="t",
            timestamp=datetime.now(timezone.utc), weighted_score=45.0,
        )
        orchestrator._turn_evaluations.append(ev)
        orchestrator._update_score(ev)
        assert orchestrator._session_score.trajectory == "neutral"

    def test_difficulty_thresholds_all_levels(self):
        """All 10 difficulty levels map to expected thresholds."""
        expected = {1: 35, 2: 38, 3: 42, 4: 48, 5: 52, 6: 56, 7: 62, 8: 66, 9: 70, 10: 75}
        assert DIFFICULTY_THRESHOLDS == expected

    def test_recalculate_score_after_correction(self, orchestrator):
        """_recalculate_score rebuilds from modified evaluations."""
        for i in range(3):
            ev = TurnEvaluation(
                turn_number=i + 1, speaker="user", text="t",
                timestamp=datetime.now(timezone.utc), weighted_score=40.0,
            )
            orchestrator._turn_evaluations.append(ev)
            orchestrator._update_score(ev)

        # "AI correction" — change last eval to 80
        orchestrator._turn_evaluations[-1].weighted_score = 80.0
        orchestrator._recalculate_score()

        # Window: [40, 40, 80] with weights [0.20, 0.25, 0.30]
        w = [0.20, 0.25, 0.30]
        expected = (40 * 0.20 + 40 * 0.25 + 80 * 0.30) / sum(w)
        assert abs(orchestrator._session_score.cumulative - expected) < 0.1


# =====================================================================
# 2. Heuristic Evaluators
# =====================================================================

class TestAdherenceHeuristic:
    def test_no_active_suggestion_returns_neutral(self, orchestrator):
        score = orchestrator._evaluate_adherence_fast("qualquer texto aqui")
        assert score == 0.5

    def test_question_suggestion_user_asks_question(self, orchestrator, question_suggestion):
        lc = SuggestionLifecycle(
            suggestion=question_suggestion,
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        orchestrator._active_suggestion = lc
        score = orchestrator._evaluate_adherence_fast(
            "Como esta o ROI atual da empresa?"
        )
        # Base 0.5 + 0.3 (question) + 0.2 (SPIN situation keywords) + overlap
        assert score > 0.7

    def test_question_suggestion_user_no_question(self, orchestrator, question_suggestion):
        lc = SuggestionLifecycle(
            suggestion=question_suggestion,
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        orchestrator._active_suggestion = lc
        score = orchestrator._evaluate_adherence_fast(
            "Nosso produto resolve tudo facilmente"
        )
        # Base 0.5 - 0.2 (no question) → ~0.3, then product pushing may clip to 0.1
        assert score < 0.5

    def test_product_pushing_during_discovery_clips_to_01(self, orchestrator, question_suggestion):
        lc = SuggestionLifecycle(
            suggestion=question_suggestion,
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        orchestrator._active_suggestion = lc
        score = orchestrator._evaluate_adherence_fast(
            "Deixa eu te mostrar nosso produto incrivel"
        )
        assert score == pytest.approx(0.1, abs=0.01)

    def test_short_response_penalty(self, orchestrator, question_suggestion):
        lc = SuggestionLifecycle(
            suggestion=question_suggestion,
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        orchestrator._active_suggestion = lc
        short = orchestrator._evaluate_adherence_fast("sim ok")
        long = orchestrator._evaluate_adherence_fast(
            "sim ok entendi vou verificar o ROI com o financeiro"
        )
        # Short should be penalized relative to longer
        assert short < long


class TestEmotionalQualityHeuristic:
    def test_neutral_text(self, orchestrator):
        score = orchestrator._evaluate_emotional_quality_fast("Vou pensar sobre isso")
        assert score == pytest.approx(0.5, abs=0.05)

    def test_positive_keywords_boost(self, orchestrator):
        score = orchestrator._evaluate_emotional_quality_fast("Entendo, faz sentido")
        assert score > 0.5

    def test_empathy_keywords_boost(self, orchestrator):
        score = orchestrator._evaluate_emotional_quality_fast(
            "Imagino que deve ser dificil lidar com isso"
        )
        assert score >= 0.7

    def test_negative_keywords_penalty(self, orchestrator):
        score = orchestrator._evaluate_emotional_quality_fast(
            "Voce esta errado, ja falei isso"
        )
        assert score < 0.3


class TestObjectionHandlingHeuristic:
    def test_no_pending_objections_neutral(self, orchestrator):
        orchestrator._pending_objections = []
        score = orchestrator._evaluate_objection_handling_fast("qualquer coisa")
        assert score == 0.5

    def test_addresses_objection_higher_score(self, orchestrator):
        orchestrator._pending_objections = ["preco"]
        score = orchestrator._evaluate_objection_handling_fast(
            "Entendo sua preocupacao com o preco. Deixa eu explicar o retorno que outros clientes tiveram"
        )
        assert score > 0.5

    def test_product_pushing_with_objections_clips(self, orchestrator):
        orchestrator._pending_objections = ["preco"]
        score = orchestrator._evaluate_objection_handling_fast(
            "Deixa eu te mostrar nosso produto premium"
        )
        assert score == pytest.approx(0.1, abs=0.01)


class TestConversationQualityHeuristic:
    def test_open_ended_question_boost(self, orchestrator):
        score = orchestrator._evaluate_conversation_quality_fast(
            "Como voces fazem o processo de vendas atualmente?"
        )
        assert score > 0.6

    def test_short_response_penalty(self, orchestrator):
        score = orchestrator._evaluate_conversation_quality_fast("sim")
        assert score < 0.5

    def test_long_detailed_response_boost(self, orchestrator):
        score = orchestrator._evaluate_conversation_quality_fast(
            "Entendo perfeitamente sua situacao. Na minha experiencia trabalhando com empresas similares, "
            "o principal desafio costuma ser a integracao com sistemas legados. Podemos explorar isso juntos?"
        )
        assert score > 0.6


# =====================================================================
# 3. Deviation Detection
# =====================================================================

class TestDeviationDetection:
    def test_product_pushing_during_situation(self, orchestrator):
        orchestrator._spin_stage = "situation"
        dev = orchestrator._detect_deviation("Deixa eu te mostrar nosso produto")
        assert dev == "pushed_product_without_discovery"

    def test_product_pushing_during_problem(self, orchestrator):
        orchestrator._spin_stage = "problem"
        dev = orchestrator._detect_deviation("Podemos oferecer nossa plataforma")
        assert dev == "pushed_product_without_discovery"

    def test_no_deviation_during_need_payoff(self, orchestrator):
        orchestrator._spin_stage = "need_payoff"
        dev = orchestrator._detect_deviation("Nosso produto resolve esse problema")
        assert dev is None

    def test_ignored_objection_repeatedly(self, orchestrator):
        orchestrator._pending_objections = ["preco"]
        orchestrator._conversation_history = [
            ("avatar", "Isso esta muito caro"),
            ("user", "Vamos falar de funcionalidades"),
            ("avatar", "Mas e o preco?"),
            ("user", "As funcionalidades sao incriveis"),
        ]
        dev = orchestrator._detect_deviation("Temos muitos recursos disponiveis")
        assert dev == "ignored_objection_repeatedly"

    def test_minimal_response_with_objections(self, orchestrator):
        orchestrator._pending_objections = ["preco"]
        dev = orchestrator._detect_deviation("ok")
        assert dev == "minimal_response_with_pending_objections"

    def test_no_deviation_normal_text(self, orchestrator):
        orchestrator._spin_stage = "situation"
        orchestrator._pending_objections = []
        dev = orchestrator._detect_deviation(
            "Como funciona o processo de vendas atualmente na empresa?"
        )
        assert dev is None


# =====================================================================
# 4. SPIN Stage Progression
# =====================================================================

class TestSpinStageProgression:
    def test_starts_at_situation(self, orchestrator):
        assert orchestrator._spin_stage == "situation"

    def test_advances_to_problem(self, orchestrator):
        orchestrator._update_spin_stage("Qual a maior dificuldade que voces enfrentam?")
        assert orchestrator._spin_stage == "problem"

    def test_advances_to_implication(self, orchestrator):
        orchestrator._spin_stage = "problem"
        orchestrator._update_spin_stage("Qual o impacto disso na produtividade?")
        assert orchestrator._spin_stage == "implication"

    def test_advances_to_need_payoff(self, orchestrator):
        orchestrator._spin_stage = "implication"
        orchestrator._update_spin_stage("Se pudesse resolver isso, qual seria o beneficio?")
        assert orchestrator._spin_stage == "need_payoff"

    def test_does_not_regress(self, orchestrator):
        orchestrator._spin_stage = "need_payoff"
        orchestrator._update_spin_stage("Como funciona atualmente?")  # situation keyword
        assert orchestrator._spin_stage == "need_payoff"

    def test_no_change_on_unrelated_text(self, orchestrator):
        orchestrator._update_spin_stage("Boa tarde, tudo bem?")
        assert orchestrator._spin_stage == "situation"


# =====================================================================
# 5. Objection Detection
# =====================================================================

class TestObjectionDetection:
    def test_detects_price_objection(self, orchestrator):
        orchestrator._detect_objections("Isso esta muito caro para nosso orcamento")
        assert "preco" in orchestrator._pending_objections

    def test_detects_timing_objection(self, orchestrator):
        orchestrator._detect_objections("Agora nao e o momento certo")
        assert "timing" in orchestrator._pending_objections

    def test_detects_need_objection(self, orchestrator):
        orchestrator._detect_objections("Ja temos um sistema que funciona bem")
        assert "necessidade" in orchestrator._pending_objections

    def test_detects_authority_objection(self, orchestrator):
        orchestrator._detect_objections("Preciso consultar meu chefe sobre isso")
        assert "autoridade" in orchestrator._pending_objections

    def test_detects_trust_objection(self, orchestrator):
        orchestrator._detect_objections("Nunca ouvi falar dessa empresa, tem referencia?")
        assert "confianca" in orchestrator._pending_objections

    def test_no_duplicates(self, orchestrator):
        orchestrator._detect_objections("Isso e muito caro")
        orchestrator._detect_objections("O preco e alto demais")
        assert orchestrator._pending_objections.count("preco") == 1

    def test_multiple_categories_single_text(self, orchestrator):
        orchestrator._detect_objections(
            "Isso e muito caro e agora nao e o momento certo"
        )
        assert "preco" in orchestrator._pending_objections
        assert "timing" in orchestrator._pending_objections


# =====================================================================
# 6. Output Determination
# =====================================================================

class TestOutputDetermination:
    def test_returns_none_before_80_percent(self, orchestrator):
        # Session just started — elapsed ~0%
        result = orchestrator.check_output_determination()
        assert result is None

    def test_positive_output_when_score_above_threshold(self, orchestrator):
        # Force 80% elapsed
        orchestrator._session_start_time = time.time() - 150  # 150s of 180s = 83%
        orchestrator._session_score.cumulative = 60.0  # > threshold 52
        directive = orchestrator.check_output_determination()
        assert directive is not None
        assert orchestrator._final_output_type == "positive"
        assert "receptivo" in directive.emotional_shift

    def test_negative_output_when_score_below_threshold(self, orchestrator):
        orchestrator._session_start_time = time.time() - 150
        orchestrator._session_score.cumulative = 40.0  # < threshold 52
        directive = orchestrator.check_output_determination()
        assert directive is not None
        assert orchestrator._final_output_type == "negative"
        assert "frustrado" in directive.emotional_shift

    def test_fires_only_once(self, orchestrator):
        orchestrator._session_start_time = time.time() - 150
        orchestrator._session_score.cumulative = 60.0
        d1 = orchestrator.check_output_determination()
        d2 = orchestrator.check_output_determination()
        assert d1 is not None
        assert d2 is None

    def test_positive_outcome_selection(self, orchestrator):
        outcome = orchestrator._get_positive_outcome()
        assert outcome["outcome_type"] == "sale_closed"

    def test_negative_outcome_selection(self, orchestrator):
        outcome = orchestrator._get_negative_outcome()
        assert outcome["outcome_type"] == "rejected"


# =====================================================================
# 7. Suggestion Lifecycle
# =====================================================================

class TestSuggestionLifecycle:
    def _setup_plan(self, orchestrator):
        """Helper to populate coaching plan."""
        plan = []
        for i in range(3):
            sug = make_suggestion(id=f"plan_{i+1}", message=f"Sugestao {i+1}")
            lc = SuggestionLifecycle(
                suggestion=sug,
                sent_at=datetime.now(timezone.utc),
                status="pending",
            )
            plan.append(lc)
        orchestrator._coaching_plan = plan
        orchestrator._plan_index = 0
        return plan

    def test_activate_first_pending(self, orchestrator):
        self._setup_plan(orchestrator)
        sug = orchestrator.activate_next_suggestion()
        assert sug is not None
        assert sug.id == "plan_1"
        assert orchestrator._active_suggestion.status == "active"

    def test_activate_next_skips_previous(self, orchestrator):
        self._setup_plan(orchestrator)
        orchestrator.activate_next_suggestion()  # plan_1 → active
        sug2 = orchestrator.activate_next_suggestion()  # plan_1 → skipped, plan_2 → active
        assert sug2.id == "plan_2"
        assert orchestrator._coaching_plan[0].status == "skipped"

    def test_returns_none_when_exhausted(self, orchestrator):
        self._setup_plan(orchestrator)
        orchestrator.activate_next_suggestion()
        orchestrator.activate_next_suggestion()
        orchestrator.activate_next_suggestion()
        result = orchestrator.activate_next_suggestion()
        assert result is None

    def test_followed_when_adherence_high(self, orchestrator):
        self._setup_plan(orchestrator)
        sug = orchestrator.activate_next_suggestion()

        # Set active suggestion with QUESTION type for high adherence
        orchestrator._active_suggestion.suggestion = make_suggestion(
            type=SuggestionType.QUESTION,
            message="Como funciona o processo atualmente?",
            methodology_step=MethodologyStep.SITUATION,
        )
        orchestrator._active_suggestion.status = "active"

        orchestrator.evaluate_user_turn_fast(
            "Como funciona o processo de vendas atualmente na empresa?"
        )
        assert orchestrator._coaching_plan[0].status == "followed"

    def test_ignored_when_adherence_low(self, orchestrator):
        self._setup_plan(orchestrator)
        orchestrator.activate_next_suggestion()
        # Product pushing ignores the suggestion
        orchestrator.evaluate_user_turn_fast("Nosso produto e o melhor do mercado")
        assert orchestrator._coaching_plan[0].status == "ignored"


# =====================================================================
# 8. Hesitation Detection
# =====================================================================

class TestHesitationDetection:
    def test_short_text_returns_nudge(self, orchestrator):
        result = orchestrator.check_hesitation("ok sim")
        assert result is not None
        assert isinstance(result, str)

    def test_normal_text_returns_none(self, orchestrator):
        result = orchestrator.check_hesitation(
            "Entendo perfeitamente, vou verificar os dados"
        )
        assert result is None

    def test_nudge_varies_by_spin_stage(self, orchestrator):
        orchestrator._spin_stage = "situation"
        n1 = orchestrator.check_hesitation("ok")
        orchestrator._spin_stage = "implication"
        n2 = orchestrator.check_hesitation("ok")
        assert n1 != n2

    def test_punctuation_stripped(self, orchestrator):
        # "ok." → tokens: ["ok"] (1 token, ≤ 3) → nudge
        result = orchestrator.check_hesitation("ok.")
        assert result is not None


# =====================================================================
# 9. InjectionQueue State Machine
# =====================================================================

class TestInjectionQueue:
    @pytest.fixture
    def queue(self):
        q = InjectionQueue()
        q._generate_reply_fn = MagicMock()
        return q

    @pytest.fixture
    def directive(self):
        return AvatarDirective(
            role_reminder="Voce e Carlos",
            conversation_summary="Conversa sobre CRM",
            emotional_state="neutral",
            behavior_instruction="Mantenha postura neutra",
            emotional_shift="neutro",
            reason="test",
        )

    def test_initial_state_is_idle(self, queue):
        assert queue.state == AgentState.IDLE

    def test_state_transitions(self, queue):
        queue.on_agent_state_changed("thinking")
        assert queue.state == AgentState.THINKING
        queue.on_agent_state_changed("speaking")
        assert queue.state == AgentState.SPEAKING
        queue.on_agent_state_changed("idle")
        assert queue.state == AgentState.IDLE

    def test_enqueue_when_idle_injects_immediately(self, queue, directive):
        async def _run():
            await queue.enqueue(directive)
        asyncio.run(_run())
        queue._generate_reply_fn.assert_called_once()
        assert queue.injection_count == 1

    def test_enqueue_when_speaking_queues(self, queue, directive):
        async def _run():
            queue.on_agent_state_changed("speaking")
            await queue.enqueue(directive)
        asyncio.run(_run())
        queue._generate_reply_fn.assert_not_called()
        assert queue._pending is not None

    def test_pending_injected_on_idle(self, queue, directive):
        async def _run():
            queue.on_agent_state_changed("speaking")
            await queue.enqueue(directive)
            assert queue._pending is not None
            # Transition to idle triggers injection
            queue.on_agent_state_changed("idle")
            # Give asyncio.create_task a chance to run
            await asyncio.sleep(0.05)
        asyncio.run(_run())
        queue._generate_reply_fn.assert_called_once()

    def test_requeue_on_active_response_error(self, queue, directive):
        async def _run():
            queue._generate_reply_fn.side_effect = Exception("active response in progress")
            await queue.enqueue(directive)
        asyncio.run(_run())
        # Should re-enqueue
        assert queue._pending is not None
        assert queue.state == AgentState.SPEAKING

    def test_overwrite_warning(self, queue, directive):
        async def _run():
            queue.on_agent_state_changed("speaking")
            await queue.enqueue(directive)
            d2 = AvatarDirective(
                role_reminder="X", conversation_summary="Y",
                emotional_state="Z", behavior_instruction="W",
                emotional_shift="V", reason="second",
            )
            with patch("coach_orchestrator.logger") as mock_logger:
                await queue.enqueue(d2)
                mock_logger.warning.assert_called()
            assert queue._pending.reason == "second"
        asyncio.run(_run())

    def test_race_protection_sets_injecting(self, queue, directive):
        async def _run():
            queue.on_agent_state_changed("speaking")
            await queue.enqueue(directive)
            # Simulate transition to idle — should set INJECTING before create_task
            queue.on_agent_state_changed("idle")
            # Immediately after on_agent_state_changed, state should be INJECTING
            assert queue.state == AgentState.INJECTING
        asyncio.run(_run())


# =====================================================================
# 10. Snapshot & Results
# =====================================================================

class TestSnapshotAndResults:
    def test_get_snapshot_structure(self, orchestrator):
        snap = orchestrator.get_snapshot()
        assert "session_score" in snap
        assert "trajectory" in snap
        assert "dimensions" in snap
        assert "spin_stage" in snap
        assert "pending_objections" in snap
        assert "avatar_emotion" in snap
        assert "deviation" in snap

    def test_get_snapshot_defaults(self, orchestrator):
        snap = orchestrator.get_snapshot()
        assert snap["session_score"] == 50.0
        assert snap["trajectory"] == "neutral"
        assert all(v == 0.5 for v in snap["dimensions"].values())

    def test_get_session_results_top_level_turns(self, orchestrator):
        results = orchestrator.get_session_results()
        assert "turns_evaluated" in results
        assert results["turns_evaluated"] == 0

    def test_get_session_results_after_turns(self, orchestrator):
        orchestrator.evaluate_user_turn_fast("Como funciona o processo?")
        orchestrator.evaluate_user_turn_fast("Qual a maior dificuldade?")
        results = orchestrator.get_session_results()
        assert results["turns_evaluated"] == 2
        assert len(results["turn_evaluations"]) == 2

    def test_get_trajectory_message_format(self, orchestrator):
        msg = orchestrator.get_trajectory_message()
        assert msg["type"] == "session_trajectory"
        assert "score" in msg
        assert "trajectory" in msg
        assert "dimensions" in msg
        assert set(msg["dimensions"].keys()) == {
            "coach_adherence", "emotional_quality",
            "objection_handling", "conversation_quality",
        }


# =====================================================================
# 11. Data Structure Serialization
# =====================================================================

class TestSerialization:
    def test_suggestion_lifecycle_to_dict(self, suggestion):
        lc = SuggestionLifecycle(
            suggestion=suggestion,
            sent_at=datetime.now(timezone.utc),
            status="active",
        )
        d = lc.to_dict()
        assert d["suggestion_id"] == suggestion.id
        assert d["status"] == "active"
        assert d["type"] == "question"

    def test_turn_evaluation_to_dict_rounds(self):
        ev = TurnEvaluation(
            turn_number=1, speaker="user", text="test",
            timestamp=datetime.now(timezone.utc),
            coach_adherence=0.12345, emotional_quality=0.67891,
            objection_handling=0.5, conversation_quality=0.5,
            weighted_score=55.123,
        )
        d = ev.to_dict()
        assert d["coach_adherence"] == 0.123
        assert d["emotional_quality"] == 0.679
        assert d["weighted_score"] == 55.1

    def test_session_score_to_dict(self):
        ss = SessionScore()
        d = ss.to_dict()
        assert d["cumulative"] == 50.0
        assert d["trajectory"] == "neutral"
        assert d["turns_evaluated"] == 0
        assert d["positive_threshold"] == 52.0

    def test_avatar_directive_to_prompt(self):
        d = AvatarDirective(
            role_reminder="Voce e Carlos",
            conversation_summary="Conversa sobre CRM",
            emotional_state="neutral",
            behavior_instruction="Mantenha postura neutra",
            emotional_shift="neutro",
            reason="test",
        )
        prompt = d.to_prompt()
        assert "Voce e Carlos" in prompt
        assert "Conversa sobre CRM" in prompt
        assert "Mantenha postura neutra" in prompt
        assert "INSTRUCAO INTERNA" in prompt


# =====================================================================
# 12. Session Lifecycle
# =====================================================================

class TestSessionLifecycle:
    def test_start_sets_threshold(self, orchestrator):
        # Difficulty 5 → threshold 52
        assert orchestrator._session_score.positive_threshold == 52.0

    def test_start_different_difficulty(self):
        with patch.dict("os.environ", {"OPENAI_API_KEY": ""}):
            orch = CoachOrchestrator()
            orch._client = None
            orch.start_session(
                scenario=MOCK_SCENARIO, outcomes=MOCK_OUTCOMES,
                criterion_rubrics=MOCK_RUBRICS,
                difficulty_level=10, session_mode="training",
            )
            assert orch._session_score.positive_threshold == 75.0

    def test_evaluation_mode_inactive(self, eval_orchestrator):
        assert eval_orchestrator._active is False

    def test_training_mode_active(self, orchestrator):
        assert orchestrator._active is True

    def test_stop_sets_inactive(self, orchestrator):
        orchestrator.stop()
        assert orchestrator._active is False


# =====================================================================
# 13. Helpers
# =====================================================================

class TestHelpers:
    def test_parse_methodology_step_valid(self):
        assert _parse_methodology_step("situation") == MethodologyStep.SITUATION
        assert _parse_methodology_step("problem") == MethodologyStep.PROBLEM
        assert _parse_methodology_step("implication") == MethodologyStep.IMPLICATION
        assert _parse_methodology_step("need_payoff") == MethodologyStep.NEED_PAYOFF

    def test_parse_methodology_step_null(self):
        assert _parse_methodology_step(None) is None
        assert _parse_methodology_step("null") is None

    def test_parse_methodology_step_invalid(self):
        assert _parse_methodology_step("invalid") is None
        assert _parse_methodology_step("") is None

    def test_format_rubrics(self, orchestrator):
        text = orchestrator._format_rubrics()
        assert "Descoberta de necessidades" in text
        assert "peso 2" in text

    def test_format_rubrics_empty(self, orchestrator):
        orchestrator._criterion_rubrics = []
        text = orchestrator._format_rubrics()
        assert "Nenhum" in text

    def test_format_recent_history_empty(self, orchestrator):
        text = orchestrator._format_recent_history()
        assert "Inicio" in text

    def test_format_recent_history_with_data(self, orchestrator):
        orchestrator._conversation_history = [
            ("user", "Ola"),
            ("avatar", "Ola, como posso ajudar?"),
        ]
        text = orchestrator._format_recent_history()
        assert "Vendedor: Ola" in text
        assert "Cliente: Ola, como posso ajudar?" in text

    def test_format_recent_history_respects_limit(self, orchestrator):
        orchestrator._conversation_history = [("user", f"msg {i}") for i in range(20)]
        text = orchestrator._format_recent_history(limit=3)
        lines = [l for l in text.strip().split("\n") if l.strip()]
        assert len(lines) == 3

    def test_build_quick_summary(self, orchestrator):
        orchestrator._pending_objections = ["preco"]
        orchestrator._current_emotion = "cetico"
        summary = orchestrator._build_quick_summary()
        assert "preco" in summary
        assert "cetico" in summary
        assert "situation" in summary

    def test_get_positive_outcome(self, orchestrator):
        outcome = orchestrator._get_positive_outcome()
        assert outcome["outcome_type"] == "sale_closed"

    def test_get_negative_outcome(self, orchestrator):
        outcome = orchestrator._get_negative_outcome()
        assert outcome["outcome_type"] == "rejected"

    def test_get_positive_outcome_fallback(self, orchestrator):
        orchestrator._outcomes = [{"outcome_type": "custom", "description": "test"}]
        outcome = orchestrator._get_positive_outcome()
        assert outcome["outcome_type"] == "custom"  # Falls back to first

    def test_get_outcomes_empty(self, orchestrator):
        orchestrator._outcomes = []
        assert orchestrator._get_positive_outcome() is None
        assert orchestrator._get_negative_outcome() is None


# =====================================================================
# 14. Full Fast Path Integration
# =====================================================================

class TestFastPathIntegration:
    def test_evaluate_increments_counters(self, orchestrator):
        orchestrator.evaluate_user_turn_fast("Como funciona o processo?")
        assert orchestrator._turn_counter == 1
        assert orchestrator._user_turn_counter == 1
        assert len(orchestrator._conversation_history) == 1

    def test_multiple_turns_score_evolves(self, orchestrator):
        # Good turn
        orchestrator.evaluate_user_turn_fast(
            "Como funciona o processo de vendas atualmente na empresa?"
        )
        score_after_1 = orchestrator._session_score.cumulative

        # Bad turn (product pushing)
        orchestrator._spin_stage = "situation"
        orchestrator.evaluate_user_turn_fast(
            "Deixa eu te mostrar nosso produto incrivel com preco especial"
        )
        score_after_2 = orchestrator._session_score.cumulative

        # Score should decrease after bad turn
        assert score_after_2 < score_after_1

    def test_conversation_history_capped(self, orchestrator):
        for i in range(35):
            orchestrator.evaluate_user_turn_fast(f"Mensagem {i}")
        assert len(orchestrator._conversation_history) <= 30

    def test_avatar_turn_tracks_objections(self, orchestrator):
        orchestrator.evaluate_avatar_turn_fast(
            "Isso esta muito caro para nosso orcamento"
        )
        assert "preco" in orchestrator._pending_objections
        assert orchestrator._turn_counter == 1

    def test_dimension_weights_sum_to_one(self):
        total = sum(DIMENSION_WEIGHTS.values())
        assert abs(total - 1.0) < 1e-9

    def test_wma_weights_sum_to_one(self):
        total = sum(WMA_WEIGHTS)
        assert abs(total - 1.0) < 1e-9

    def test_build_directive_from_score_positive(self, orchestrator):
        orchestrator._session_score.cumulative = 70.0
        orchestrator._session_score.trajectory = "positive"
        d = orchestrator.build_directive_from_score()
        assert d is not None
        assert "receptivo" in d.behavior_instruction

    def test_build_directive_from_score_negative(self, orchestrator):
        orchestrator._session_score.cumulative = 30.0
        orchestrator._session_score.trajectory = "negative"
        d = orchestrator.build_directive_from_score()
        assert "ceticismo" in d.behavior_instruction

    def test_build_directive_inactive(self, eval_orchestrator):
        d = eval_orchestrator.build_directive_from_score()
        assert d is None
