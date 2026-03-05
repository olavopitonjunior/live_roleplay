"""
Coach Orchestrator Module

Unified coaching layer that replaces the 3 independent coaching layers
(CoachingEngine keywords, AICoachEngine GPT-4o-mini, ConversationCoach heuristic).

The orchestrator is an ACTIVE mediator between user and avatar:
- Evaluates every user turn against evaluation criteria
- Injects behavioral context into the avatar via generate_reply()
- Manages scoring, trajectory, and output determination
- Handles context anchoring for long sessions (5-10 min)

Key design decisions:
- generate_reply(instructions=...) does NOT persist — each injection is self-contained
- InjectionQueue with state machine prevents "active response in progress" errors
- Hybrid evaluation: fast heuristic path + periodic AI correction via GPT-4o-mini
- Scoring uses weighted moving average (window=5) across 4 dimensions
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Literal, Optional

try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from ai_coach import (
    AISuggestion,
    ConversationContext,
    LearningProfile,
    MethodologyStep,
    SuggestionType,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data Structures
# ---------------------------------------------------------------------------

@dataclass
class SuggestionLifecycle:
    """Lifecycle of a coaching suggestion — from creation to resolution."""
    suggestion: AISuggestion
    sent_at: datetime
    status: Literal["pending", "active", "followed", "ignored", "skipped"] = "pending"
    adherence_score: Optional[float] = None  # 0.0-1.0 when evaluated
    evaluation_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "suggestion_id": self.suggestion.id,
            "message": self.suggestion.message,
            "type": self.suggestion.type.value if isinstance(self.suggestion.type, Enum) else self.suggestion.type,
            "sent_at": self.sent_at.isoformat(),
            "status": self.status,
            "adherence_score": self.adherence_score,
            "evaluation_reason": self.evaluation_reason,
        }


@dataclass
class TurnEvaluation:
    """Evaluation of a single conversation turn."""
    turn_number: int
    speaker: str  # "user" | "avatar"
    text: str
    timestamp: datetime
    # Dimensions (0.0 to 1.0 each)
    coach_adherence: float = 0.5
    emotional_quality: float = 0.5
    objection_handling: float = 0.5
    conversation_quality: float = 0.5
    # Result
    weighted_score: float = 50.0
    deviation: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "turn": self.turn_number,
            "speaker": self.speaker,
            "timestamp": self.timestamp.isoformat(),
            "coach_adherence": round(self.coach_adherence, 3),
            "emotional_quality": round(self.emotional_quality, 3),
            "objection_handling": round(self.objection_handling, 3),
            "conversation_quality": round(self.conversation_quality, 3),
            "weighted_score": round(self.weighted_score, 1),
            "deviation": self.deviation,
        }


@dataclass
class SessionScore:
    """Cumulative session score with trajectory tracking."""
    cumulative: float = 50.0  # 0-100, starts neutral
    trajectory: str = "neutral"  # "positive" | "negative" | "neutral"
    dimension_history: dict = field(default_factory=lambda: {
        "coach_adherence": [],
        "emotional_quality": [],
        "objection_handling": [],
        "conversation_quality": [],
    })
    turn_scores: list = field(default_factory=list)  # Raw turn scores for WMA
    turns_evaluated: int = 0
    positive_threshold: float = 52.0  # Overridden by difficulty

    def to_dict(self) -> dict:
        return {
            "cumulative": round(self.cumulative, 1),
            "trajectory": self.trajectory,
            "turns_evaluated": self.turns_evaluated,
            "positive_threshold": self.positive_threshold,
        }


@dataclass
class AvatarDirective:
    """Instruction injected into avatar — MUST be self-contained."""
    role_reminder: str
    conversation_summary: str
    emotional_state: str
    behavior_instruction: str
    emotional_shift: str
    intensity: float = 0.5  # 0.0-1.0
    reason: str = ""

    def to_prompt(self) -> str:
        """Build the full injection prompt."""
        return INJECTION_TEMPLATE.format(
            role_reminder=self.role_reminder,
            conversation_summary=self.conversation_summary,
            emotional_state=self.emotional_state,
            behavior_instruction=self.behavior_instruction,
            emotional_shift=self.emotional_shift,
            reason=self.reason,
        )


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DIMENSION_WEIGHTS = {
    "coach_adherence": 0.30,
    "emotional_quality": 0.20,
    "objection_handling": 0.25,
    "conversation_quality": 0.25,
}

# Score threshold for positive output by difficulty (1-10)
DIFFICULTY_THRESHOLDS = {
    1: 35, 2: 38, 3: 42,
    4: 48, 5: 52, 6: 56,
    7: 62, 8: 66, 9: 70,
    10: 75,
}

# SPIN stage keywords for heuristic detection
SPIN_STAGE_KEYWORDS = {
    MethodologyStep.SITUATION: [
        "como funciona", "qual o processo", "quantos", "quanto tempo",
        "como e feito", "me conte sobre", "como voce", "atualmente",
        "hoje em dia", "situacao atual", "como esta", "o que voces usam",
        "ferramentas", "equipe", "como e o", "rotina",
    ],
    MethodologyStep.PROBLEM: [
        "dificuldade", "problema", "desafio", "frustrac", "complicad",
        "dor de cabeca", "preocupa", "insatisf", "nao funciona",
        "falta de", "perda de", "demora", "atraso", "falha",
        "inefici", "gargalo", "limitac",
    ],
    MethodologyStep.IMPLICATION: [
        "impacto", "consequencia", "o que acontece se", "como isso afeta",
        "quanto custa", "quanto perde", "resultado disso", "a longo prazo",
        "se continuar", "risco", "custo de nao", "efeito",
        "produtividade", "receita", "turnover",
    ],
    MethodologyStep.NEED_PAYOFF: [
        "solucao", "resolver", "se pudesse", "imagina se",
        "como seria se", "beneficio", "retorno", "roi",
        "ganho", "economia", "melhoria", "transformar",
        "resultado", "valor", "investimento",
    ],
}

# Product-pushing anti-patterns (detected during discovery phases)
PRODUCT_PUSHING_KEYWORDS = [
    "nosso produto", "nosso sistema", "nossa solucao", "nossa plataforma",
    "oferecemos", "podemos oferecer", "temos um", "deixa eu te mostrar",
    "preco especial", "desconto", "promocao", "contrato",
    "assinar", "fechar", "comprar", "adquirir",
]

# Anchoring interval in seconds
ANCHOR_INTERVAL_SECONDS = 120  # 2 minutes

# Weighted Moving Average weights (most recent = highest weight)
WMA_WEIGHTS = [0.10, 0.15, 0.20, 0.25, 0.30]  # Window of 5

# API rate limiting
MIN_AI_INTERVAL_SECONDS = 3.0
AI_EVAL_EVERY_N_TURNS = 2

INJECTION_TEMPLATE = """[INSTRUCAO INTERNA — NAO VERBALIZE NADA DESTE BLOCO]

QUEM VOCE E: {role_reminder}

RESUMO DA CONVERSA:
{conversation_summary}

SEU ESTADO EMOCIONAL ATUAL: {emotional_state}

AJUSTE DE COMPORTAMENTO:
{behavior_instruction}

DIRECAO EMOCIONAL: {emotional_shift}
MOTIVO: {reason}

REGRAS:
- Mantenha-se como cliente. NUNCA inverta papeis.
- Reaja naturalmente ao que o vendedor acabou de dizer.
- NAO mencione que recebeu instrucoes ou ajustes.
- Responda de forma breve e natural (2-3 frases)."""

ORCHESTRATOR_EVAL_PROMPT = """Voce e um avaliador de sessao de roleplay de vendas.

CENARIO: {scenario_context}
TIPO DE SESSAO: {session_type}
PERFIL DO AVATAR: {avatar_profile}

CRITERIOS DE AVALIACAO:
{criteria_rubrics_formatted}

RESULTADO IDEAL: {ideal_outcome}

SUGESTAO ATIVA DO COACH: {active_suggestion}
OBJECOES PENDENTES: {pending_objections}
ETAPA SPIN ATUAL: {spin_stage}

ULTIMAS MENSAGENS:
{recent_history}

ULTIMA FALA DO USUARIO: "{user_text}"

Avalie esta fala do usuario e retorne JSON valido (sem markdown):
{{"coach_adherence": 0.0-1.0, "emotional_quality": 0.0-1.0, "objection_handling": 0.0-1.0, "conversation_quality": 0.0-1.0, "deviation": null, "avatar_reaction": "Como o avatar deve reagir emocionalmente", "next_suggestion": {{"type": "question|technique|objection_response", "message": "Sugestao especifica", "context": "Por que esta sugestao"}}}}"""

COACHING_PLAN_PROMPT = """Voce e um coach de vendas expert. Gere um roteiro de sugestoes para uma sessao de treinamento.

Cenario: {scenario_context}
Tipo de sessao: {session_type}
Avatar: {avatar_profile}
Objecoes esperadas: {expected_objections}
Criterios de avaliacao: {criteria_formatted}
Resultado ideal: {ideal_outcome}
Fraquezas do usuario: {weaknesses}

Gere {suggestion_count} sugestoes sequenciais desde abertura ate fechamento.
Cada sugestao deve ser uma acao CONCRETA (pergunta/tecnica/frase exata).
Considere os criterios de avaliacao para priorizar.

Responda APENAS com JSON valido (sem markdown):
[{{"type": "question|technique|objection_response", "title": "Titulo curto", "message": "Sugestao especifica", "context": "Por que esta sugestao", "methodology_step": "situation|problem|implication|need_payoff|null"}}]"""

SUMMARY_PROMPT = """Resuma esta conversa de roleplay de vendas em 3-4 frases.
Mencione: o que foi discutido, objecoes apresentadas, estado emocional atual do cliente, e proximos passos logicos.

Conversa:
{conversation}

Resumo conciso:"""


# ---------------------------------------------------------------------------
# Agent State Machine (concurrency control for generate_reply)
# ---------------------------------------------------------------------------

class AgentState(Enum):
    IDLE = "idle"
    THINKING = "thinking"
    SPEAKING = "speaking"
    INJECTING = "injecting"


class InjectionQueue:
    """
    Queue for avatar context injections.
    Ensures only ONE injection at a time, only when agent is IDLE.
    Prevents "active response in progress" errors.
    """

    def __init__(self):
        self._state: AgentState = AgentState.IDLE
        self._pending: Optional[AvatarDirective] = None
        self._lock = asyncio.Lock()
        self._generate_reply_fn: Optional[Callable] = None
        self._on_injection_sent: Optional[Callable] = None
        self._injection_count: int = 0
        self._last_injection_time: float = 0.0

    def set_generate_reply(self, fn: Callable):
        """Set the generate_reply function from AgentSession."""
        self._generate_reply_fn = fn

    def set_on_injection_sent(self, fn: Callable):
        """Callback after injection is sent (for logging/metrics)."""
        self._on_injection_sent = fn

    @property
    def state(self) -> AgentState:
        return self._state

    @property
    def injection_count(self) -> int:
        return self._injection_count

    async def enqueue(self, directive: AvatarDirective):
        """Enqueue directive. If IDLE, inject immediately. Otherwise, wait."""
        async with self._lock:
            if self._pending is not None:
                logger.warning(
                    f"Orchestrator: overwriting pending directive "
                    f"(previous reason={self._pending.reason})"
                )
            self._pending = directive
            if self._state == AgentState.IDLE:
                await self._inject_now()

    def on_agent_state_changed(self, new_state: str):
        """Called by agent_state_changed event handler."""
        if new_state == "thinking":
            self._state = AgentState.THINKING
        elif new_state == "speaking":
            self._state = AgentState.SPEAKING
        else:  # idle, listening, etc.
            prev = self._state
            self._state = AgentState.IDLE
            if self._pending and prev != AgentState.IDLE:
                # Set INJECTING before yielding to event loop to prevent double-injection
                self._state = AgentState.INJECTING
                asyncio.create_task(self._try_inject_pending())

    async def _try_inject_pending(self):
        """Try to inject pending directive (called when state → IDLE)."""
        async with self._lock:
            if self._pending and self._state in (AgentState.IDLE, AgentState.INJECTING):
                await self._inject_now()
            elif not self._pending:
                # Pending was consumed by a concurrent enqueue — reset to IDLE
                if self._state == AgentState.INJECTING:
                    self._state = AgentState.IDLE

    async def _inject_now(self):
        """Execute injection when safe."""
        if not self._generate_reply_fn or not self._pending:
            return

        self._state = AgentState.INJECTING
        directive = self._pending
        self._pending = None

        try:
            prompt = directive.to_prompt()
            self._generate_reply_fn(instructions=prompt)
            self._injection_count += 1
            self._last_injection_time = time.time()
            logger.info(
                f"Orchestrator: Injected directive #{self._injection_count} "
                f"(reason={directive.reason}, intensity={directive.intensity:.1f})"
            )
            if self._on_injection_sent:
                try:
                    self._on_injection_sent(directive)
                except Exception:
                    pass
            # After injection, agent will go to THINKING → SPEAKING → IDLE
            self._state = AgentState.THINKING
        except Exception as e:
            error_msg = str(e).lower()
            if "active response" in error_msg:
                logger.warning("Orchestrator: active response in progress — re-enqueuing directive")
                self._pending = directive
                self._state = AgentState.SPEAKING
            else:
                logger.error(f"Orchestrator: injection failed: {e}")
                self._state = AgentState.IDLE


# ---------------------------------------------------------------------------
# Coach Orchestrator
# ---------------------------------------------------------------------------

class CoachOrchestrator:
    """
    Unified coaching orchestrator that replaces 3 independent coaching layers.

    In TRAINING mode: evaluates turns, injects context, sends suggestions.
    In EVALUATION mode: completely disabled — no suggestions, no injections.
    """

    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None
        self._active = False

        # Session context
        self._scenario: dict = {}
        self._outcomes: list[dict] = []
        self._criterion_rubrics: list[dict] = []
        self._learning_profile: Optional[LearningProfile] = None
        self._difficulty_level: int = 3
        self._session_mode: str = "training"
        self._duration_seconds: int = 180  # 3 min default

        # State
        self._session_score = SessionScore()
        self._turn_evaluations: list[TurnEvaluation] = []
        self._suggestion_lifecycle: list[SuggestionLifecycle] = []
        self._active_suggestion: Optional[SuggestionLifecycle] = None
        self._coaching_plan: list[SuggestionLifecycle] = []
        self._plan_index: int = 0

        # Conversation tracking
        self._conversation_history: list[tuple[str, str]] = []  # (speaker, text)
        self._turn_counter: int = 0
        self._user_turn_counter: int = 0
        self._pending_objections: list[str] = []
        self._presented_objections: list[str] = []
        self._spin_stage: str = "situation"
        self._current_emotion: str = "neutral"
        self._conversation_summary: str = ""

        # Injection queue
        self.injection_queue = InjectionQueue()

        # Output determination
        self._output_determined: bool = False
        self._final_output_type: Optional[str] = None

        # Rate limiting
        self._last_ai_eval_time: float = 0.0
        self._ai_turn_counter: int = 0

        # Anchoring
        self._anchor_task: Optional[asyncio.Task] = None
        self._last_anchor_time: float = 0.0
        self._session_start_time: float = 0.0

        # Silence/hesitation (absorbed from ConversationCoach)
        self._last_user_activity: float = 0.0
        self._watchdog_task: Optional[asyncio.Task] = None
        self._stuck_timeout: float = 10.0
        self._hesitation_tokens: int = 3

        # Suggestion counter for unique IDs
        self._suggestion_counter: int = 0

        self._setup_openai()

    def _setup_openai(self):
        """Setup OpenAI client for GPT-4o-mini evaluations."""
        if not OPENAI_AVAILABLE:
            logger.warning("openai not available — orchestrator AI path disabled")
            return
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not set — orchestrator AI path disabled")
            return
        try:
            self._client = AsyncOpenAI(api_key=api_key)
            logger.info("Orchestrator: OpenAI client initialized (GPT-4o-mini)")
        except Exception as e:
            logger.error(f"Orchestrator: Failed to init OpenAI: {e}")

    # ------------------------------------------------------------------
    # Session Lifecycle
    # ------------------------------------------------------------------

    def start_session(
        self,
        scenario: dict,
        outcomes: list[dict],
        criterion_rubrics: list[dict],
        learning_profile: Optional[dict] = None,
        difficulty_level: int = 3,
        session_mode: str = "training",
        duration_seconds: int = 180,
    ):
        """Initialize orchestrator for a new session."""
        self._scenario = scenario
        self._outcomes = outcomes
        self._criterion_rubrics = criterion_rubrics
        self._difficulty_level = difficulty_level
        self._session_mode = session_mode
        self._session_type = scenario.get('session_type', '')
        self._duration_seconds = duration_seconds
        self._active = session_mode == "training"

        if learning_profile:
            self._learning_profile = LearningProfile.from_dict(learning_profile)

        # Set score threshold based on difficulty
        self._session_score.positive_threshold = DIFFICULTY_THRESHOLDS.get(
            difficulty_level, 52
        )

        self._session_start_time = time.time()
        self._last_user_activity = time.monotonic()

        logger.info(
            f"Orchestrator: session started "
            f"(mode={session_mode}, difficulty={difficulty_level}, "
            f"threshold={self._session_score.positive_threshold}, "
            f"duration={duration_seconds}s, "
            f"rubrics={len(criterion_rubrics)}, "
            f"outcomes={len(outcomes)})"
        )

    def stop(self):
        """Stop orchestrator and cleanup."""
        self._active = False
        if self._anchor_task and not self._anchor_task.done():
            self._anchor_task.cancel()
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
        logger.info("Orchestrator: stopped")

    def start_anchoring(self):
        """Start periodic context anchoring loop."""
        if not self._active:
            return
        if self._anchor_task and not self._anchor_task.done():
            return

        async def _anchor_loop():
            while self._active:
                try:
                    await asyncio.sleep(ANCHOR_INTERVAL_SECONDS)
                    if not self._active:
                        break
                    await self._do_anchor()
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warning(f"Orchestrator: anchoring failed: {e}")

        self._anchor_task = asyncio.create_task(_anchor_loop())
        logger.info(f"Orchestrator: anchoring started (interval={ANCHOR_INTERVAL_SECONDS}s)")

    def start_watchdog(self, on_silence: Callable[[], Coroutine]):
        """Start silence watchdog (absorbed from ConversationCoach)."""
        if not self._active:
            return
        if self._watchdog_task and not self._watchdog_task.done():
            return

        async def _watchdog_loop():
            while self._active:
                await asyncio.sleep(max(self._stuck_timeout / 2, 2))
                elapsed = time.monotonic() - self._last_user_activity
                if elapsed > self._stuck_timeout:
                    try:
                        await on_silence()
                    except Exception as e:
                        logger.warning(f"Orchestrator: silence callback failed: {e}")
                    self._last_user_activity = time.monotonic()

        self._watchdog_task = asyncio.create_task(_watchdog_loop())
        logger.info(f"Orchestrator: watchdog started (timeout={self._stuck_timeout}s)")

    def reset_silence_timer(self):
        """Reset silence timer (call when user speaks)."""
        self._last_user_activity = time.monotonic()

    # ------------------------------------------------------------------
    # Coaching Plan (pre-loaded suggestions)
    # ------------------------------------------------------------------

    async def generate_coaching_plan(self) -> list[dict]:
        """Generate pre-loaded coaching plan for the session."""
        if not self._active or not self._client:
            return []

        scenario = self._scenario
        rubrics = self._criterion_rubrics

        # Format criteria
        criteria_lines = []
        for r in rubrics:
            criteria_lines.append(
                f"- {r.get('criterion_name', '')}: {r.get('criterion_description', '')} "
                f"(peso: {r.get('weight', 1)})"
            )

        # Format objections
        objections = scenario.get("objections", [])
        obj_texts = [o.get("description", "") for o in objections] if objections else []

        # Weaknesses
        weaknesses = "Nenhuma registrada"
        if self._learning_profile and self._learning_profile.recurring_weaknesses:
            weaknesses = ", ".join(self._learning_profile.recurring_weaknesses[:3])

        # Ideal outcome
        ideal = self._get_positive_outcome()
        ideal_text = ideal.get("description", "Venda fechada") if ideal else "Venda fechada"

        suggestion_count = 6 if self._duration_seconds <= 180 else 8

        prompt = COACHING_PLAN_PROMPT.format(
            scenario_context=scenario.get("context", ""),
            session_type=self._session_type,
            avatar_profile=scenario.get("avatar_profile", ""),
            expected_objections=", ".join(obj_texts) if obj_texts else "Nenhuma especifica",
            criteria_formatted="\n".join(criteria_lines) if criteria_lines else "Nenhum criterio",
            ideal_outcome=ideal_text,
            weaknesses=weaknesses,
            suggestion_count=suggestion_count,
        )

        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=800,
                ),
                timeout=15.0,
            )
            text = response.choices[0].message.content if response.choices else None
            if not text:
                return []

            # Parse JSON
            text = text.strip()
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            text = text.strip()

            suggestions_data = json.loads(text)
            if not isinstance(suggestions_data, list):
                return []

            plan = []
            for i, s in enumerate(suggestions_data):
                sug = AISuggestion(
                    id=f"plan_{i+1}",
                    type=_safe_suggestion_type(s.get("type", "technique")),
                    title=s.get("title", f"Passo {i+1}"),
                    message=s.get("message", ""),
                    context=s.get("context", ""),
                    priority=1,
                    methodology_step=_parse_methodology_step(s.get("methodology_step")),
                )
                lifecycle = SuggestionLifecycle(
                    suggestion=sug,
                    sent_at=datetime.now(timezone.utc),
                    status="pending",
                )
                plan.append(lifecycle)

            self._coaching_plan = plan
            self._plan_index = 0
            logger.info(f"Orchestrator: coaching plan generated ({len(plan)} suggestions)")
            return [lc.to_dict() for lc in plan]

        except asyncio.TimeoutError:
            logger.warning("Orchestrator: coaching plan timeout")
            return []
        except json.JSONDecodeError as e:
            logger.warning(f"Orchestrator: coaching plan JSON parse error: {e}")
            return []
        except Exception as e:
            logger.warning(f"Orchestrator: coaching plan failed: {e}")
            return []

    def activate_next_suggestion(self) -> Optional[AISuggestion]:
        """Activate the next suggestion from the coaching plan."""
        if not self._coaching_plan:
            return None

        # Close current active suggestion
        if self._active_suggestion and self._active_suggestion.status == "active":
            self._active_suggestion.status = "skipped"

        # Find next pending suggestion
        while self._plan_index < len(self._coaching_plan):
            lc = self._coaching_plan[self._plan_index]
            self._plan_index += 1
            if lc.status == "pending":
                lc.status = "active"
                self._active_suggestion = lc
                self._suggestion_lifecycle.append(lc)
                return lc.suggestion

        return None

    # ------------------------------------------------------------------
    # Turn Evaluation — Fast Path (heuristic, <5ms, no API)
    # ------------------------------------------------------------------

    def evaluate_user_turn_fast(self, text: str) -> TurnEvaluation:
        """
        Fast heuristic evaluation of user turn.
        Runs synchronously on every user turn (is_final=True).
        """
        self._turn_counter += 1
        self._user_turn_counter += 1
        self._conversation_history.append(("user", text))
        if len(self._conversation_history) > 30:
            self._conversation_history = self._conversation_history[-30:]

        # 1. Coach adherence
        adherence = self._evaluate_adherence_fast(text)

        # 2. Emotional quality (based on text characteristics)
        emotional = self._evaluate_emotional_quality_fast(text)

        # 3. Objection handling
        objection = self._evaluate_objection_handling_fast(text)

        # 4. Conversation quality (SPIN alignment, question quality)
        quality = self._evaluate_conversation_quality_fast(text)

        # 5. Detect deviation
        deviation = self._detect_deviation(text)

        # Calculate weighted score
        weighted = (
            adherence * DIMENSION_WEIGHTS["coach_adherence"]
            + emotional * DIMENSION_WEIGHTS["emotional_quality"]
            + objection * DIMENSION_WEIGHTS["objection_handling"]
            + quality * DIMENSION_WEIGHTS["conversation_quality"]
        ) * 100

        evaluation = TurnEvaluation(
            turn_number=self._turn_counter,
            speaker="user",
            text=text,
            timestamp=datetime.now(timezone.utc),
            coach_adherence=adherence,
            emotional_quality=emotional,
            objection_handling=objection,
            conversation_quality=quality,
            weighted_score=weighted,
            deviation=deviation,
        )

        self._turn_evaluations.append(evaluation)
        self._update_score(evaluation)

        # Close active suggestion lifecycle
        if self._active_suggestion and self._active_suggestion.status == "active":
            self._active_suggestion.adherence_score = adherence
            if adherence >= 0.6:
                self._active_suggestion.status = "followed"
                self._active_suggestion.evaluation_reason = "Sugestao seguida"
            else:
                self._active_suggestion.status = "ignored"
                self._active_suggestion.evaluation_reason = deviation or "Sugestao ignorada"

        # Detect SPIN stage progression
        self._update_spin_stage(text)

        return evaluation

    def evaluate_avatar_turn_fast(self, text: str) -> None:
        """Track avatar turn (lighter evaluation — avatar is AI-controlled)."""
        self._turn_counter += 1
        self._conversation_history.append(("avatar", text))
        if len(self._conversation_history) > 30:
            self._conversation_history = self._conversation_history[-30:]

        # Detect objections in avatar speech
        self._detect_objections(text)

    # ------------------------------------------------------------------
    # Turn Evaluation — AI Path (GPT-4o-mini, async, ~300-500ms)
    # ------------------------------------------------------------------

    async def evaluate_user_turn_ai(self, text: str) -> Optional[dict]:
        """
        AI-powered evaluation of user turn.
        Runs every AI_EVAL_EVERY_N_TURNS user turns OR when deviation detected.
        Returns dict with corrected scores + next suggestion + avatar reaction.
        """
        if not self._client or not self._active:
            return None

        self._ai_turn_counter += 1

        # Only run every N turns unless deviation detected
        last_eval = self._turn_evaluations[-1] if self._turn_evaluations else None
        has_deviation = last_eval and last_eval.deviation is not None
        if not has_deviation and self._ai_turn_counter % AI_EVAL_EVERY_N_TURNS != 0:
            return None

        # Rate limiting
        now = time.time()
        if now - self._last_ai_eval_time < MIN_AI_INTERVAL_SECONDS:
            return None

        self._last_ai_eval_time = now

        # Format context
        rubrics_text = self._format_rubrics()
        history_text = self._format_recent_history(8)
        active_sug = self._active_suggestion.suggestion.message if self._active_suggestion else "Nenhuma"
        pending_obj = ", ".join(self._pending_objections) if self._pending_objections else "Nenhuma"

        ideal = self._get_positive_outcome()
        ideal_text = ideal.get("description", "") if ideal else ""

        prompt = ORCHESTRATOR_EVAL_PROMPT.format(
            scenario_context=self._scenario.get("context", ""),
            session_type=self._session_type,
            avatar_profile=self._scenario.get("avatar_profile", ""),
            criteria_rubrics_formatted=rubrics_text,
            ideal_outcome=ideal_text,
            active_suggestion=active_sug,
            pending_objections=pending_obj,
            spin_stage=self._spin_stage,
            recent_history=history_text,
            user_text=text,
        )

        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=400,
                ),
                timeout=5.0,
            )

            result_text = response.choices[0].message.content if response.choices else None
            if not result_text:
                return None

            # Parse JSON
            result_text = result_text.strip()
            result_text = re.sub(r"^```(?:json)?\s*", "", result_text)
            result_text = re.sub(r"\s*```$", "", result_text)

            data = json.loads(result_text.strip())

            # Correct the heuristic score with AI evaluation
            if last_eval:
                last_eval.coach_adherence = float(data.get("coach_adherence", last_eval.coach_adherence))
                last_eval.emotional_quality = float(data.get("emotional_quality", last_eval.emotional_quality))
                last_eval.objection_handling = float(data.get("objection_handling", last_eval.objection_handling))
                last_eval.conversation_quality = float(data.get("conversation_quality", last_eval.conversation_quality))
                last_eval.deviation = data.get("deviation")

                # Recalculate weighted score
                last_eval.weighted_score = (
                    last_eval.coach_adherence * DIMENSION_WEIGHTS["coach_adherence"]
                    + last_eval.emotional_quality * DIMENSION_WEIGHTS["emotional_quality"]
                    + last_eval.objection_handling * DIMENSION_WEIGHTS["objection_handling"]
                    + last_eval.conversation_quality * DIMENSION_WEIGHTS["conversation_quality"]
                ) * 100

                # Recalculate session score with corrected values
                self._recalculate_score()

            logger.info(
                f"Orchestrator AI eval: adherence={data.get('coach_adherence')}, "
                f"quality={data.get('conversation_quality')}, "
                f"deviation={data.get('deviation')}"
            )

            return data

        except asyncio.TimeoutError:
            logger.warning("Orchestrator: AI eval timeout")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Orchestrator: AI eval JSON error: {e}")
            return None
        except Exception as e:
            error_str = str(e)
            if "429" in error_str:
                logger.warning("Orchestrator: AI eval rate limited")
            else:
                logger.warning(f"Orchestrator: AI eval failed: {e}")
            return None

    # ------------------------------------------------------------------
    # Avatar Context Injection
    # ------------------------------------------------------------------

    def build_directive_from_score(self) -> Optional[AvatarDirective]:
        """Build an avatar directive based on current score and context."""
        if not self._active:
            return None

        score = self._session_score.cumulative
        trajectory = self._session_score.trajectory

        # Build role reminder from scenario
        avatar_name = self._scenario.get("avatar_profile", "um cliente")
        role_reminder = f"Voce e {avatar_name}. Voce e o CLIENTE/PROSPECT. NUNCA inverta papeis."

        # Add session_type context to role reminder
        if self._session_type == 'cold_call':
            role_reminder += " LEMBRE: voce NAO estava esperando esta ligacao."
        elif self._session_type in ('entrevista', 'interview'):
            role_reminder += " LEMBRE: voce e o CANDIDATO sendo entrevistado."
        elif self._session_type in ('apresentacao', 'presentation'):
            role_reminder += " LEMBRE: esta reuniao foi agendada — voce estava esperando."
        elif self._session_type in ('retencao', 'retention'):
            role_reminder += " LEMBRE: voce e um cliente insatisfeito querendo cancelar."

        # Conversation summary
        summary = self._conversation_summary or self._build_quick_summary()

        # Determine behavior based on trajectory
        if trajectory == "positive":
            behavior = (
                "O vendedor esta indo bem. Mostre-se mais receptivo. "
                "Reduza levemente a resistencia. Faca perguntas genuinas."
            )
            emotional_shift = "mais receptivo"
        elif trajectory == "negative":
            behavior = (
                "O vendedor nao esta convencendo. Aumente ceticismo. "
                "Insista em objecoes nao respondidas. Questione mais."
            )
            emotional_shift = "mais cetico"
        else:
            behavior = (
                "Mantenha postura neutra. Responda proporcionalmente "
                "a qualidade dos argumentos do vendedor."
            )
            emotional_shift = "neutro"

        # Intensity based on how far from threshold
        threshold = self._session_score.positive_threshold
        distance = abs(score - threshold)
        intensity = min(1.0, distance / 30.0)  # Normalize to 0-1

        return AvatarDirective(
            role_reminder=role_reminder,
            conversation_summary=summary,
            emotional_state=self._current_emotion,
            behavior_instruction=behavior,
            emotional_shift=emotional_shift,
            intensity=intensity,
            reason=f"score={score:.0f}, trajectory={trajectory}",
        )

    def build_output_directive(self) -> Optional[AvatarDirective]:
        """Build directive for output determination (last 20% of session)."""
        if self._output_determined:
            return None

        threshold = self._session_score.positive_threshold
        score = self._session_score.cumulative

        avatar_name = self._scenario.get("avatar_profile", "um cliente")
        role_reminder = f"Voce e {avatar_name}. Voce e o CLIENTE/PROSPECT. NUNCA inverta papeis."
        summary = self._conversation_summary or self._build_quick_summary()

        if score >= threshold:
            # POSITIVE OUTPUT
            outcome = self._get_positive_outcome()
            desc = outcome.get("description", "Fechar a venda") if outcome else "Fechar a venda"
            closing = outcome.get("avatar_closing_line", "") if outcome else ""
            behavior = (
                f"Sinalize interesse crescente. Caminhe para: {desc}. "
                f"Reduza objecoes. Mostre-se pronto para fechar."
            )
            if closing:
                behavior += f' Use algo como: "{closing}"'
            emotional_shift = "receptivo → feliz"
            self._final_output_type = "positive"
        else:
            # NEGATIVE OUTPUT
            outcome = self._get_negative_outcome()
            desc = outcome.get("description", "Rejeitar a proposta") if outcome else "Rejeitar a proposta"
            closing = outcome.get("avatar_closing_line", "") if outcome else ""
            behavior = (
                f"Voce nao foi convencido. Comece a encerrar: {desc}. "
                f"Mantenha objecoes. Expresse insatisfacao."
            )
            if closing:
                behavior += f' Use algo como: "{closing}"'
            emotional_shift = "cetico → frustrado"
            self._final_output_type = "negative"

        self._output_determined = True

        return AvatarDirective(
            role_reminder=role_reminder,
            conversation_summary=summary,
            emotional_state=self._current_emotion,
            behavior_instruction=behavior,
            emotional_shift=emotional_shift,
            intensity=0.8,
            reason=f"output_determination: {self._final_output_type} (score={score:.0f}, threshold={threshold})",
        )

    def check_output_determination(self) -> Optional[AvatarDirective]:
        """Check if it's time to determine session output (last 20%)."""
        if self._output_determined:
            return None

        elapsed = time.time() - self._session_start_time
        elapsed_pct = elapsed / self._duration_seconds if self._duration_seconds > 0 else 1.0

        if elapsed_pct < 0.80:
            return None

        return self.build_output_directive()

    # ------------------------------------------------------------------
    # Context Anchoring (long sessions)
    # ------------------------------------------------------------------

    async def _do_anchor(self):
        """Perform a context anchor — summarize + inject."""
        if not self._active:
            return

        # Generate summary via GPT-4o-mini
        summary = await self._generate_conversation_summary()
        if summary:
            self._conversation_summary = summary

        # Build combined anchor + directive
        directive = self.build_directive_from_score()
        if directive:
            directive.conversation_summary = self._conversation_summary
            directive.reason = "periodic_anchor"
            await self.injection_queue.enqueue(directive)
            self._last_anchor_time = time.time()
            logger.info(f"Orchestrator: anchor sent (summary={len(self._conversation_summary)} chars)")

    async def _generate_conversation_summary(self) -> Optional[str]:
        """Generate conversation summary via GPT-4o-mini."""
        if not self._client:
            return None

        history = self._format_recent_history(15)
        prompt = SUMMARY_PROMPT.format(conversation=history)

        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=200,
                ),
                timeout=5.0,
            )
            text = response.choices[0].message.content if response.choices else None
            return text.strip() if text else None
        except Exception as e:
            logger.warning(f"Orchestrator: summary generation failed: {e}")
            return None

    # ------------------------------------------------------------------
    # Hesitation Detection (absorbed from ConversationCoach)
    # ------------------------------------------------------------------

    def check_hesitation(self, text: str) -> Optional[str]:
        """Check if user response is too short (hesitation). Returns nudge text or None."""
        cleaned = text.strip().replace("?", " ").replace(".", " ").replace(",", " ")
        tokens = [t for t in cleaned.split() if len(t) > 1]

        if len(tokens) > self._hesitation_tokens:
            return None

        # Context-aware nudge
        nudges = {
            "situation": "Tente fazer perguntas sobre a situacao atual do cliente.",
            "problem": "Explore os desafios que o cliente enfrenta.",
            "implication": "Aprofunde o impacto do problema — pergunte sobre consequencias.",
            "need_payoff": "Mostre o valor da solucao — como ela resolve o problema?",
        }
        return nudges.get(self._spin_stage, "Que tal fazer uma pergunta aberta ao cliente?")

    # ------------------------------------------------------------------
    # Snapshot (for transcript enrichment)
    # ------------------------------------------------------------------

    def get_snapshot(self) -> dict:
        """Get current orchestrator state snapshot for transcript metadata."""
        return {
            "session_score": round(self._session_score.cumulative, 1),
            "trajectory": self._session_score.trajectory,
            "dimensions": {
                dim: round(vals[-1], 3) if vals else 0.5
                for dim, vals in self._session_score.dimension_history.items()
            },
            "active_suggestion": {
                "id": self._active_suggestion.suggestion.id,
                "message": self._active_suggestion.suggestion.message,
                "status": self._active_suggestion.status,
            } if self._active_suggestion else None,
            "spin_stage": self._spin_stage,
            "pending_objections": self._pending_objections[:],
            "avatar_emotion": self._current_emotion,
            "avatar_directive_sent": self.injection_queue.injection_count > 0,
            "deviation": (
                self._turn_evaluations[-1].deviation
                if self._turn_evaluations else None
            ),
        }

    def get_session_results(self) -> dict:
        """Get final session results for DB persistence."""
        return {
            "session_trajectory": self._session_score.to_dict(),
            "turn_evaluations": [e.to_dict() for e in self._turn_evaluations],
            "turns_evaluated": self._session_score.turns_evaluated,
            "final_output_type": self._final_output_type,
            "output_score": round(self._session_score.cumulative, 2),
            "coaching_plan": [lc.to_dict() for lc in self._coaching_plan],
            "suggestions_followed": sum(
                1 for lc in self._suggestion_lifecycle if lc.status == "followed"
            ),
            "suggestions_total": len(self._suggestion_lifecycle),
        }

    def get_trajectory_message(self) -> dict:
        """Build trajectory message for frontend data channel."""
        return {
            "type": "session_trajectory",
            "score": round(self._session_score.cumulative, 1),
            "trajectory": self._session_score.trajectory,
            "dimensions": {
                dim: round(vals[-1], 3) if vals else 0.5
                for dim, vals in self._session_score.dimension_history.items()
            },
        }

    # ------------------------------------------------------------------
    # Emotion tracking
    # ------------------------------------------------------------------

    def update_emotion(self, emotion: str):
        """Update current avatar emotion (called by emotion analyzer)."""
        self._current_emotion = emotion

    # ------------------------------------------------------------------
    # Private: Heuristic Evaluators
    # ------------------------------------------------------------------

    def _evaluate_adherence_fast(self, text: str) -> float:
        """Evaluate if user followed active coaching suggestion."""
        if not self._active_suggestion or self._active_suggestion.status != "active":
            return 0.5  # Neutral when no active suggestion

        suggestion = self._active_suggestion.suggestion
        score = 0.5
        text_lower = text.lower()

        # Check if user asked a question (when suggestion was a question)
        if suggestion.type in (SuggestionType.QUESTION, "question"):
            has_question = "?" in text
            score += 0.3 if has_question else -0.2

        # SPIN stage alignment
        if suggestion.methodology_step:
            kw_list = SPIN_STAGE_KEYWORDS.get(suggestion.methodology_step, [])
            if any(kw in text_lower for kw in kw_list):
                score += 0.2

        # Keyword overlap with suggestion message
        sug_words = set(suggestion.message.lower().split())
        text_words = set(text_lower.split())
        # Remove common words
        stopwords = {"o", "a", "e", "de", "do", "da", "em", "um", "uma", "que", "para", "com", "se", "na", "no", "por"}
        sug_words -= stopwords
        text_words -= stopwords
        if sug_words:
            overlap = len(sug_words & text_words) / len(sug_words)
            score += overlap * 0.2

        # Anti-pattern: product pushing during discovery
        if suggestion.methodology_step in (MethodologyStep.SITUATION, MethodologyStep.PROBLEM):
            if self._detects_product_pushing(text_lower):
                score = 0.1
                return max(0.0, min(1.0, score))

        # Short responses = less effort
        if len(text.split()) < 5:
            score *= 0.7

        return max(0.0, min(1.0, score))

    def _evaluate_emotional_quality_fast(self, text: str) -> float:
        """Evaluate emotional quality of user response."""
        score = 0.5
        text_lower = text.lower()

        # Positive indicators
        positive = ["entendo", "compreendo", "boa pergunta", "faz sentido", "concordo",
                     "obrigado", "claro", "com certeza"]
        if any(kw in text_lower for kw in positive):
            score += 0.2

        # Empathy indicators
        empathy = ["imagino", "deve ser dificil", "entendo sua preocupacao",
                    "compreendo", "natural que"]
        if any(kw in text_lower for kw in empathy):
            score += 0.2

        # Negative indicators (aggressive, dismissive)
        negative = ["voce esta errado", "nao importa", "tanto faz", "como eu disse",
                     "ja falei", "voce nao entende"]
        if any(kw in text_lower for kw in negative):
            score -= 0.3

        return max(0.0, min(1.0, score))

    def _evaluate_objection_handling_fast(self, text: str) -> float:
        """Evaluate if user handled pending objections."""
        if not self._pending_objections:
            return 0.5  # Neutral when no pending objections

        text_lower = text.lower()
        score = 0.3  # Start lower — user should address objections

        # Check if response addresses objection keywords
        objection_response_patterns = [
            "entendo sua preocupacao", "boa observacao", "faz sentido",
            "deixa eu explicar", "na verdade", "por exemplo",
            "outros clientes", "caso de sucesso", "dados mostram",
            "retorno", "roi", "garantia", "resultado",
        ]
        addressed_count = sum(1 for p in objection_response_patterns if p in text_lower)
        score += min(0.5, addressed_count * 0.15)

        # If user just ignored objection and pushed product
        if self._detects_product_pushing(text_lower) and self._pending_objections:
            score = 0.1

        return max(0.0, min(1.0, score))

    def _evaluate_conversation_quality_fast(self, text: str) -> float:
        """Evaluate conversation quality (SPIN alignment, depth, questions)."""
        score = 0.5
        text_lower = text.lower()

        # Questions are generally good
        question_count = text.count("?")
        if question_count > 0:
            score += min(0.2, question_count * 0.1)

        # Open-ended questions are better
        open_starters = ["como", "por que", "o que", "qual", "quando", "onde", "quem"]
        if any(text_lower.strip().startswith(s) for s in open_starters):
            score += 0.1

        # SPIN alignment — is user in right stage?
        for step, keywords in SPIN_STAGE_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                if step.value == self._spin_stage:
                    score += 0.15  # Aligned with expected stage
                break

        # Depth — longer, more detailed responses
        word_count = len(text.split())
        if word_count >= 15:
            score += 0.1
        elif word_count < 5:
            score -= 0.15

        return max(0.0, min(1.0, score))

    def _detect_deviation(self, text: str) -> Optional[str]:
        """Detect critical deviations from expected behavior."""
        text_lower = text.lower()

        # Product pushing during discovery
        if self._spin_stage in ("situation", "problem"):
            if self._detects_product_pushing(text_lower):
                return "pushed_product_without_discovery"

        # Ignoring objection
        if self._pending_objections and len(self._conversation_history) >= 4:
            # Check last 2 user turns — if both ignore objection
            user_turns = [(s, t) for s, t in self._conversation_history[-4:] if s == "user"]
            if len(user_turns) >= 2:
                both_ignore = all(
                    not any(p in t.lower() for p in ["entendo", "preocupacao", "objecao", "ponto"])
                    for _, t in user_turns
                )
                if both_ignore:
                    return "ignored_objection_repeatedly"

        # Very short response to complex situation
        if len(text.split()) < 3 and self._pending_objections:
            return "minimal_response_with_pending_objections"

        return None

    @staticmethod
    def _detects_product_pushing(text_lower: str) -> bool:
        """Detect if user is pushing product instead of discovering needs."""
        return any(kw in text_lower for kw in PRODUCT_PUSHING_KEYWORDS)

    # ------------------------------------------------------------------
    # Private: Scoring
    # ------------------------------------------------------------------

    def _update_score(self, evaluation: TurnEvaluation):
        """Update session score with new turn evaluation."""
        # Add to dimension history
        for dim in DIMENSION_WEIGHTS:
            val = getattr(evaluation, dim)
            history = self._session_score.dimension_history[dim]
            history.append(val)
            if len(history) > 5:
                history.pop(0)

        # Add turn score to history
        self._session_score.turn_scores.append(evaluation.weighted_score)
        if len(self._session_score.turn_scores) > 5:
            self._session_score.turn_scores.pop(0)

        # Weighted moving average
        scores = self._session_score.turn_scores
        n = len(scores)
        weights = WMA_WEIGHTS[-n:]  # Use last N weights
        weight_sum = sum(weights)
        self._session_score.cumulative = sum(
            s * w for s, w in zip(scores, weights)
        ) / weight_sum if weight_sum > 0 else 50.0

        self._session_score.turns_evaluated += 1

        # Update trajectory
        threshold = self._session_score.positive_threshold
        if self._session_score.cumulative >= threshold:
            self._session_score.trajectory = "positive"
        elif self._session_score.cumulative <= threshold - 15:
            self._session_score.trajectory = "negative"
        else:
            self._session_score.trajectory = "neutral"

    def _recalculate_score(self):
        """Recalculate score from turn evaluations (after AI correction)."""
        if not self._turn_evaluations:
            return

        # Rebuild turn_scores from last 5 evaluations
        recent = self._turn_evaluations[-5:]
        self._session_score.turn_scores = [e.weighted_score for e in recent]

        scores = self._session_score.turn_scores
        n = len(scores)
        weights = WMA_WEIGHTS[-n:]
        weight_sum = sum(weights)
        self._session_score.cumulative = sum(
            s * w for s, w in zip(scores, weights)
        ) / weight_sum if weight_sum > 0 else 50.0

        # Update trajectory
        threshold = self._session_score.positive_threshold
        if self._session_score.cumulative >= threshold:
            self._session_score.trajectory = "positive"
        elif self._session_score.cumulative <= threshold - 15:
            self._session_score.trajectory = "negative"
        else:
            self._session_score.trajectory = "neutral"

    # ------------------------------------------------------------------
    # Private: SPIN & Objection Detection
    # ------------------------------------------------------------------

    def _update_spin_stage(self, text: str):
        """Update SPIN stage based on user text."""
        text_lower = text.lower()

        # Check keywords for each stage (in order)
        stages = [
            ("situation", MethodologyStep.SITUATION),
            ("problem", MethodologyStep.PROBLEM),
            ("implication", MethodologyStep.IMPLICATION),
            ("need_payoff", MethodologyStep.NEED_PAYOFF),
        ]

        for stage_name, step in stages:
            keywords = SPIN_STAGE_KEYWORDS.get(step, [])
            if any(kw in text_lower for kw in keywords):
                # Only advance (don't go backwards)
                stage_order = ["situation", "problem", "implication", "need_payoff"]
                current_idx = stage_order.index(self._spin_stage) if self._spin_stage in stage_order else 0
                new_idx = stage_order.index(stage_name)
                if new_idx >= current_idx:
                    self._spin_stage = stage_name
                break

    def _detect_objections(self, avatar_text: str):
        """Detect objections in avatar (client) speech."""
        text_lower = avatar_text.lower()

        objection_patterns = {
            "preco": ["caro", "preco", "custo", "investimento alto", "orcamento",
                       "nao cabe", "muito dinheiro", "gastar"],
            "timing": ["agora nao", "momento", "depois", "talvez mais pra frente",
                        "nao e prioridade", "ano que vem", "proximo trimestre"],
            "necessidade": ["nao preciso", "ja temos", "funciona bem", "nao vejo necessidade",
                            "estou satisfeito", "nao e pra gente"],
            "autoridade": ["nao depende de mim", "preciso consultar", "meu chefe",
                           "diretoria", "comite", "aprovacao"],
            "confianca": ["nunca ouvi falar", "garantia", "prova", "referencia",
                          "caso de sucesso", "quem usa"],
        }

        for category, patterns in objection_patterns.items():
            if any(p in text_lower for p in patterns):
                if category not in self._pending_objections:
                    self._pending_objections.append(category)
                if category not in self._presented_objections:
                    self._presented_objections.append(category)

    # ------------------------------------------------------------------
    # Private: Helpers
    # ------------------------------------------------------------------

    def _format_rubrics(self) -> str:
        """Format criterion rubrics for AI evaluation prompt."""
        if not self._criterion_rubrics:
            return "Nenhum criterio especifico"

        lines = []
        for r in self._criterion_rubrics:
            name = r.get("criterion_name", "")
            desc = r.get("criterion_description", "")
            weight = r.get("weight", 1)
            l4 = r.get("level_4_descriptor", "")
            l1 = r.get("level_1_descriptor", "")
            lines.append(
                f"- {name} (peso {weight}): {desc}\n"
                f"  Excelente: {l4}\n  Insuficiente: {l1}"
            )
        return "\n".join(lines)

    def _format_recent_history(self, limit: int = 8) -> str:
        """Format recent conversation history."""
        if not self._conversation_history:
            return "(Inicio da conversa)"

        history = self._conversation_history[-limit:]
        lines = []
        for speaker, text in history:
            role = "Vendedor" if speaker == "user" else "Cliente"
            lines.append(f"{role}: {text}")
        return "\n".join(lines)

    def _build_quick_summary(self) -> str:
        """Build quick summary without AI (for when GPT is unavailable)."""
        turns = len(self._conversation_history)
        objections = ", ".join(self._pending_objections) if self._pending_objections else "nenhuma"
        return (
            f"Conversa com {turns} turnos. "
            f"Etapa SPIN: {self._spin_stage}. "
            f"Objecoes pendentes: {objections}. "
            f"Emocao do cliente: {self._current_emotion}."
        )

    def _get_positive_outcome(self) -> Optional[dict]:
        """Get the positive outcome from scenario outcomes."""
        positive_types = {"sale_closed", "meeting_scheduled", "proposal_requested"}
        for o in self._outcomes:
            if o.get("outcome_type") in positive_types:
                return o
        # Fallback: first outcome with higher display_order
        return self._outcomes[0] if self._outcomes else None

    def _get_negative_outcome(self) -> Optional[dict]:
        """Get the negative outcome from scenario outcomes."""
        negative_types = {"rejected", "needs_follow_up"}
        for o in self._outcomes:
            if o.get("outcome_type") in negative_types:
                return o
        # Fallback: last outcome
        return self._outcomes[-1] if self._outcomes else None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_suggestion_type(value: str) -> SuggestionType:
    """Parse suggestion type string to enum with fallback."""
    try:
        return SuggestionType(value)
    except ValueError:
        return SuggestionType.TECHNIQUE


def _parse_methodology_step(value: Optional[str]) -> Optional[MethodologyStep]:
    """Parse methodology step string to enum."""
    if not value or value == "null":
        return None
    try:
        return MethodologyStep(value)
    except ValueError:
        return None
