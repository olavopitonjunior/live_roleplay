"""
Coaching Engine Module

Real-time coaching suggestions for sales roleplay sessions.
Analyzes conversation context and provides actionable hints to help
users improve their sales techniques.

Features:
- Sales methodology tracking (SPIN, BANT, MEDDIC)
- Objection detection and response suggestions
- Talk ratio monitoring
- Contextual encouragement and warnings
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class HintType(str, Enum):
    """Types of coaching hints."""
    ENCOURAGEMENT = "encouragement"  # Positive reinforcement
    WARNING = "warning"              # Potential issue detected
    SUGGESTION = "suggestion"        # Actionable tip
    REMINDER = "reminder"            # Methodology reminder
    OBJECTION = "objection"          # Objection detected


class MethodologyStep(str, Enum):
    """SPIN methodology steps."""
    SITUATION = "situation"      # Understanding current state
    PROBLEM = "problem"          # Identifying pain points
    IMPLICATION = "implication"  # Exploring consequences
    NEED_PAYOFF = "need_payoff"  # Presenting solution value


@dataclass
class CoachingHint:
    """A coaching hint/suggestion for the user."""
    id: str
    type: HintType
    title: str
    message: str
    priority: int  # 1 (highest) to 5 (lowest)
    methodology_step: Optional[MethodologyStep] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "message": self.message,
            "priority": self.priority,
            "methodology_step": self.methodology_step.value if self.methodology_step else None,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class MethodologyProgress:
    """Tracks progress through sales methodology."""
    situation: bool = False
    problem: bool = False
    implication: bool = False
    need_payoff: bool = False

    def to_dict(self) -> dict:
        return {
            "situation": self.situation,
            "problem": self.problem,
            "implication": self.implication,
            "need_payoff": self.need_payoff,
            "completion_percentage": self.completion_percentage,
        }

    @property
    def completion_percentage(self) -> int:
        """Calculate completion percentage."""
        completed = sum([self.situation, self.problem, self.implication, self.need_payoff])
        return int((completed / 4) * 100)


@dataclass
class Objection:
    """Detected objection from the client."""
    id: str
    text: str
    category: str  # price, timing, need, authority, trust
    addressed: bool = False
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "text": self.text,
            "category": self.category,
            "addressed": self.addressed,
            "timestamp": self.timestamp.isoformat(),
        }


class CoachingEngine:
    """
    Real-time coaching engine that analyzes conversation and generates hints.

    Usage:
        engine = CoachingEngine()
        engine.start_session(scenario)

        # On each user message
        hints = engine.analyze_user_message(text)

        # On each avatar (client) message
        hints = engine.analyze_avatar_message(text)

        # Get current state
        state = engine.get_state()
    """

    # Minimum seconds between hints of the same type
    HINT_COOLDOWN = 15

    def __init__(self):
        self._methodology = MethodologyProgress()
        self._objections: list[Objection] = []
        self._hints: list[CoachingHint] = []
        self._last_hint_time: dict[HintType, datetime] = {}
        self._user_word_count = 0
        self._avatar_word_count = 0
        self._hint_counter = 0
        self._scenario: Optional[dict] = None
        self._conversation_history: list[tuple[str, str]] = []  # (speaker, text)

    def start_session(self, scenario: Optional[dict] = None):
        """Initialize a new coaching session."""
        self._methodology = MethodologyProgress()
        self._objections = []
        self._hints = []
        self._last_hint_time = {}
        self._user_word_count = 0
        self._avatar_word_count = 0
        self._hint_counter = 0
        self._scenario = scenario
        self._conversation_history = []
        logger.info("Coaching session started")

    def _generate_hint_id(self) -> str:
        """Generate unique hint ID."""
        self._hint_counter += 1
        return f"hint_{self._hint_counter}"

    def _can_send_hint(self, hint_type: HintType) -> bool:
        """Check if we can send a hint of this type (respects cooldown)."""
        last_time = self._last_hint_time.get(hint_type)
        if not last_time:
            return True
        elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
        return elapsed >= self.HINT_COOLDOWN

    def _record_hint(self, hint: CoachingHint):
        """Record that a hint was sent."""
        self._hints.append(hint)
        self._last_hint_time[hint.type] = hint.timestamp

    def analyze_user_message(self, text: str) -> list[CoachingHint]:
        """
        Analyze user (salesperson) message and return coaching hints.

        Args:
            text: The user's spoken text

        Returns:
            List of coaching hints (may be empty)
        """
        if not text.strip():
            return []

        self._conversation_history.append(("user", text))
        self._user_word_count += len(text.split())
        hints: list[CoachingHint] = []
        text_lower = text.lower()

        # Check methodology progress
        methodology_hint = self._check_methodology_user(text_lower)
        if methodology_hint:
            hints.append(methodology_hint)

        # Check for good practices
        practice_hint = self._check_good_practices(text_lower)
        if practice_hint:
            hints.append(practice_hint)

        # Check talk ratio
        ratio_hint = self._check_talk_ratio()
        if ratio_hint:
            hints.append(ratio_hint)

        return hints

    def analyze_avatar_message(self, text: str) -> list[CoachingHint]:
        """
        Analyze avatar (client) message and return coaching hints.

        Args:
            text: The avatar's spoken text

        Returns:
            List of coaching hints (may be empty)
        """
        if not text.strip():
            return []

        self._conversation_history.append(("avatar", text))
        self._avatar_word_count += len(text.split())
        hints: list[CoachingHint] = []
        text_lower = text.lower()

        # Detect objections
        objection_hint = self._detect_objection(text_lower)
        if objection_hint:
            hints.append(objection_hint)

        # Check methodology cues from client
        methodology_hint = self._check_methodology_avatar(text_lower)
        if methodology_hint:
            hints.append(methodology_hint)

        return hints

    def _check_methodology_user(self, text: str) -> Optional[CoachingHint]:
        """Check if user's message advances the SPIN methodology."""
        # Situation questions
        situation_keywords = [
            "como funciona", "atualmente", "hoje em dia", "processo atual",
            "como voces fazem", "me conte sobre", "qual a situacao"
        ]
        if any(kw in text for kw in situation_keywords) and not self._methodology.situation:
            self._methodology.situation = True
            if self._can_send_hint(HintType.ENCOURAGEMENT):
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.ENCOURAGEMENT,
                    title="Boa pergunta!",
                    message="Voce esta entendendo a situacao atual do cliente. Continue explorando.",
                    priority=3,
                    methodology_step=MethodologyStep.SITUATION,
                )
                self._record_hint(hint)
                return hint

        # Problem questions
        problem_keywords = [
            "dificuldade", "problema", "desafio", "frustracao", "o que impede",
            "qual o maior", "onde doi", "o que te preocupa"
        ]
        if any(kw in text for kw in problem_keywords) and not self._methodology.problem:
            self._methodology.problem = True
            if self._can_send_hint(HintType.ENCOURAGEMENT):
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.ENCOURAGEMENT,
                    title="Excelente!",
                    message="Identificando os problemas do cliente. Isso cria urgencia.",
                    priority=3,
                    methodology_step=MethodologyStep.PROBLEM,
                )
                self._record_hint(hint)
                return hint

        # Implication questions
        implication_keywords = [
            "o que acontece se", "qual o impacto", "como isso afeta",
            "consequencia", "resultado disso", "quanto isso custa"
        ]
        if any(kw in text for kw in implication_keywords) and not self._methodology.implication:
            self._methodology.implication = True
            if self._can_send_hint(HintType.ENCOURAGEMENT):
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.ENCOURAGEMENT,
                    title="Otimo!",
                    message="Explorando as implicacoes. O cliente vai sentir a urgencia.",
                    priority=3,
                    methodology_step=MethodologyStep.IMPLICATION,
                )
                self._record_hint(hint)
                return hint

        # Need-payoff questions
        need_keywords = [
            "seria util", "ajudaria", "resolveria", "imagina se",
            "e se voce pudesse", "quanto valeria", "o que mudaria"
        ]
        if any(kw in text for kw in need_keywords) and not self._methodology.need_payoff:
            self._methodology.need_payoff = True
            if self._can_send_hint(HintType.ENCOURAGEMENT):
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.ENCOURAGEMENT,
                    title="Perfeito!",
                    message="Fazendo o cliente visualizar o valor. Momento ideal para apresentar a solucao.",
                    priority=2,
                    methodology_step=MethodologyStep.NEED_PAYOFF,
                )
                self._record_hint(hint)
                return hint

        # Suggest next step if stuck
        if len(self._conversation_history) >= 6 and self._can_send_hint(HintType.REMINDER):
            if not self._methodology.situation:
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.REMINDER,
                    title="Dica SPIN",
                    message="Tente entender a situacao atual: 'Como voces fazem isso hoje?'",
                    priority=4,
                    methodology_step=MethodologyStep.SITUATION,
                )
                self._record_hint(hint)
                return hint
            elif not self._methodology.problem:
                hint = CoachingHint(
                    id=self._generate_hint_id(),
                    type=HintType.REMINDER,
                    title="Dica SPIN",
                    message="Explore os problemas: 'Qual seu maior desafio com isso?'",
                    priority=4,
                    methodology_step=MethodologyStep.PROBLEM,
                )
                self._record_hint(hint)
                return hint

        return None

    def _check_methodology_avatar(self, text: str) -> Optional[CoachingHint]:
        """Check client response for methodology opportunities."""
        # Client mentioned a problem - suggest exploring it
        problem_indicators = ["nao gosto", "e dificil", "perde tempo", "custa caro", "frustrante"]
        if any(kw in text for kw in problem_indicators) and self._can_send_hint(HintType.SUGGESTION):
            hint = CoachingHint(
                id=self._generate_hint_id(),
                type=HintType.SUGGESTION,
                title="Oportunidade!",
                message="Cliente mencionou uma dor. Explore mais: 'Como isso afeta seu dia a dia?'",
                priority=2,
            )
            self._record_hint(hint)
            return hint

        # Client showed interest - suggest advancing
        interest_indicators = ["interessante", "faz sentido", "gostei", "parece bom"]
        if any(kw in text for kw in interest_indicators) and self._can_send_hint(HintType.SUGGESTION):
            hint = CoachingHint(
                id=self._generate_hint_id(),
                type=HintType.SUGGESTION,
                title="Bom sinal!",
                message="Cliente interessado. Bom momento para propor proximo passo.",
                priority=3,
            )
            self._record_hint(hint)
            return hint

        return None

    def _detect_objection(self, text: str) -> Optional[CoachingHint]:
        """Detect objections in client's message."""
        objections_map = {
            "price": ["caro", "preco", "orcamento", "dinheiro", "custo", "valor alto", "nao tenho verba"],
            "timing": ["agora nao", "depois", "outro momento", "preciso pensar", "vou analisar", "deixa pra depois"],
            "need": ["nao preciso", "ja tenho", "nao e prioridade", "nao vejo necessidade"],
            "authority": ["nao decido", "preciso falar", "meu chefe", "diretoria", "aprovacao"],
            "trust": ["nunca ouvi falar", "nao conheco", "como sei que", "garantia"],
        }

        response_suggestions = {
            "price": "Tente mostrar o ROI ou dividir o custo em parcelas menores.",
            "timing": "Crie urgencia mostrando o custo de nao agir agora.",
            "need": "Volte aos problemas identificados e suas consequencias.",
            "authority": "Pergunte como voce pode ajudar no processo de decisao.",
            "trust": "Mencione cases de sucesso ou ofereca um piloto/trial.",
        }

        for category, keywords in objections_map.items():
            if any(kw in text for kw in keywords):
                # Record the objection
                objection = Objection(
                    id=f"obj_{len(self._objections) + 1}",
                    text=text[:100],
                    category=category,
                )
                self._objections.append(objection)

                if self._can_send_hint(HintType.OBJECTION):
                    hint = CoachingHint(
                        id=self._generate_hint_id(),
                        type=HintType.OBJECTION,
                        title=f"Objecao: {category.capitalize()}",
                        message=response_suggestions.get(category, "Tente entender melhor a preocupacao."),
                        priority=1,
                    )
                    self._record_hint(hint)
                    return hint

        return None

    def _check_good_practices(self, text: str) -> Optional[CoachingHint]:
        """Check for good sales practices in user's speech."""
        # Active listening indicators
        listening_keywords = ["entendo", "compreendo", "faz sentido", "interessante voce mencionar"]
        if any(kw in text for kw in listening_keywords) and self._can_send_hint(HintType.ENCOURAGEMENT):
            hint = CoachingHint(
                id=self._generate_hint_id(),
                type=HintType.ENCOURAGEMENT,
                title="Escuta ativa",
                message="Bom! Voce esta demonstrando que ouve o cliente.",
                priority=4,
            )
            self._record_hint(hint)
            return hint

        return None

    def _check_talk_ratio(self) -> Optional[CoachingHint]:
        """Check if user is talking too much or too little."""
        total = self._user_word_count + self._avatar_word_count
        if total < 50:  # Not enough data
            return None

        user_ratio = self._user_word_count / total

        # User talking too much (>60%)
        if user_ratio > 0.6 and self._can_send_hint(HintType.WARNING):
            hint = CoachingHint(
                id=self._generate_hint_id(),
                type=HintType.WARNING,
                title="Talk Ratio Alto",
                message="Voce esta falando muito. Faca mais perguntas e deixe o cliente falar.",
                priority=2,
            )
            self._record_hint(hint)
            return hint

        # User talking too little (<25%)
        if user_ratio < 0.25 and self._can_send_hint(HintType.WARNING):
            hint = CoachingHint(
                id=self._generate_hint_id(),
                type=HintType.WARNING,
                title="Talk Ratio Baixo",
                message="Voce esta muito quieto. Conduza a conversa com mais perguntas.",
                priority=3,
            )
            self._record_hint(hint)
            return hint

        return None

    def mark_objection_addressed(self, objection_id: str):
        """Mark an objection as addressed."""
        for obj in self._objections:
            if obj.id == objection_id:
                obj.addressed = True
                break

    def get_talk_ratio(self) -> int:
        """Get user's talk ratio as percentage (0-100)."""
        total = self._user_word_count + self._avatar_word_count
        if total == 0:
            return 50
        return int((self._user_word_count / total) * 100)

    def get_state(self) -> dict:
        """Get current coaching state for frontend."""
        return {
            "methodology": self._methodology.to_dict(),
            "objections": [obj.to_dict() for obj in self._objections if not obj.addressed],
            "addressed_objections": [obj.to_dict() for obj in self._objections if obj.addressed],
            "recent_hints": [h.to_dict() for h in self._hints[-5:]],
            "talk_ratio": self.get_talk_ratio(),
            "user_word_count": self._user_word_count,
            "avatar_word_count": self._avatar_word_count,
        }


# Singleton instance
_engine: Optional[CoachingEngine] = None


def get_coaching_engine() -> CoachingEngine:
    """Get or create the singleton coaching engine."""
    global _engine
    if _engine is None:
        _engine = CoachingEngine()
    return _engine


def reset_coaching_engine():
    """Reset the coaching engine for a new session."""
    global _engine
    _engine = None
