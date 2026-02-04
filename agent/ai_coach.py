"""
AI Coach Engine Module

AI-powered coaching that generates specific, contextual suggestions
using Gemini Flash for fast inference.

Features:
- Generates specific questions/phrases (not just techniques)
- Streaming analysis for low latency
- Context-aware suggestions based on conversation history
- Objective tracking during session
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Optional
from enum import Enum

# Try to import google.genai (new unified SDK)
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

import os

logger = logging.getLogger(__name__)


class SuggestionType(str, Enum):
    """Types of AI-generated suggestions."""
    QUESTION = "question"      # A specific question to ask
    STATEMENT = "statement"    # A specific phrase/statement to use
    TECHNIQUE = "technique"    # A technique/approach suggestion
    OBJECTION_RESPONSE = "objection_response"  # Response to an objection
    ENCOURAGEMENT = "encouragement"  # Positive reinforcement


class MethodologyStep(str, Enum):
    """SPIN methodology steps."""
    SITUATION = "situation"
    PROBLEM = "problem"
    IMPLICATION = "implication"
    NEED_PAYOFF = "need_payoff"


@dataclass
class AISuggestion:
    """An AI-generated coaching suggestion."""
    id: str
    type: SuggestionType
    title: str
    message: str  # The specific question/phrase
    context: str  # Why this suggestion
    priority: int  # 1 (highest) to 5 (lowest)
    methodology_step: Optional[MethodologyStep] = None
    is_streaming: bool = False  # True if from partial analysis
    confidence: float = 1.0  # 0.0-1.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "type": self.type.value,
            "title": self.title,
            "message": self.message,
            "context": self.context,
            "priority": self.priority,
            "methodology_step": self.methodology_step.value if self.methodology_step else None,
            "is_streaming": self.is_streaming,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class LearningProfile:
    """User's cross-session learning profile."""
    recurring_weaknesses: list[str] = field(default_factory=list)
    recurring_strengths: list[str] = field(default_factory=list)
    spin_proficiency: dict[str, float] = field(default_factory=lambda: {
        "situation": 0, "problem": 0, "implication": 0, "need_payoff": 0
    })
    average_score: float = 0
    total_sessions: int = 0
    objection_handling: dict[str, dict] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> "LearningProfile":
        """Create LearningProfile from dictionary."""
        return cls(
            recurring_weaknesses=data.get("recurring_weaknesses", []) or [],
            recurring_strengths=data.get("recurring_strengths", []) or [],
            spin_proficiency=data.get("spin_proficiency", {}) or {},
            average_score=float(data.get("average_score", 0) or 0),
            total_sessions=int(data.get("total_sessions", 0) or 0),
            objection_handling=data.get("objection_handling", {}) or {},
        )


@dataclass
class ConversationContext:
    """Context for AI analysis."""
    scenario_name: str
    scenario_context: str
    avatar_profile: str
    expected_objections: list[str]
    conversation_history: list[tuple[str, str]]  # (speaker, text)
    methodology_progress: dict[str, bool]
    pending_objections: list[str]
    talk_ratio: int
    learning_profile: Optional[LearningProfile] = None


@dataclass
class SessionObjective:
    """A coaching objective for the session."""
    id: str
    description: str
    spin_step: Optional[str] = None
    completed: bool = False
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "spin_step": self.spin_step,
            "completed": self.completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# AI Coaching Prompt Template
AI_COACHING_PROMPT = """Voce e um coach de vendas experiente observando uma sessao de treinamento em tempo real.

## Contexto do Cenario
Nome: {scenario_name}
Descricao: {scenario_context}
Perfil do cliente: {avatar_profile}
Objecoes esperadas: {objections}

## Perfil de Aprendizado do Vendedor
{learning_profile_section}

## Conversa Ate Agora
{conversation_history}

## Ultima Fala ({speaker})
"{text}"

## Progresso SPIN
- Situacao: {spin_s}
- Problema: {spin_p}
- Implicacao: {spin_i}
- Necessidade: {spin_n}

## Objecoes Pendentes
{pending_objections}

## Talk Ratio
Vendedor: {talk_ratio}% (ideal: 30-50%)

---

Baseado na conversa, gere UMA sugestao ESPECIFICA e PRATICA para o vendedor.
A sugestao DEVE ser uma PERGUNTA ou FRASE EXATA que o vendedor pode usar imediatamente.

REGRAS:
1. Seja especifico - nao diga "explore os problemas", diga "Pergunte: 'Qual o maior desafio que voce enfrenta hoje com X?'"
2. Adapte ao contexto - use informacoes que o cliente ja mencionou
3. Siga o SPIN - sugira o proximo passo logico da metodologia
4. Se houver objecao pendente, priorize responde-la
5. Mantenha o tom profissional mas conversacional
6. PRIORIZE ajudar nos PONTOS FRACOS RECORRENTES do vendedor (se houver)

EXEMPLOS DE BOAS SUGESTOES:
- "Pergunte: 'Voce mencionou que perde tempo com X. Quantas horas por semana isso representa?'"
- "Diga: 'Entendo sua preocupacao com o investimento. Se eu mostrar que o retorno e de 3x em 6 meses, isso mudaria sua perspectiva?'"
- "Explore: 'Como essa situacao afeta sua equipe no dia a dia?'"
- "Responda a objecao: 'Compreendo. Muitos clientes tinham a mesma preocupacao antes de ver os resultados. Posso compartilhar um caso similar?'"

Responda APENAS com JSON valido (sem markdown, sem texto extra):
{{"type": "question|statement|technique|objection_response|encouragement", "title": "Titulo curto (max 5 palavras)", "message": "A sugestao especifica com pergunta/frase exata", "context": "Por que esta sugestao agora (1 frase)", "priority": 1-5, "methodology_step": "situation|problem|implication|need_payoff|null"}}"""


# Streaming analysis prompt (lighter, faster)
STREAMING_COACHING_PROMPT = """Coach de vendas analisando em tempo real.

Conversa recente:
{recent_history}

Fala atual ({speaker}, em andamento): "{text}"

Progresso SPIN: S:{spin_s} P:{spin_p} I:{spin_i} N:{spin_n}
{weakness_reminder}

Se houver uma sugestao URGENTE (objecao detectada, oportunidade clara), responda com JSON.
Se nao houver nada urgente, responda apenas: {{"skip": true}}

JSON: {{"type": "question|statement|objection_response", "title": "...", "message": "Sugestao especifica", "context": "...", "priority": 1-3, "methodology_step": "..."}}"""


class CoachIntensity(str, Enum):
    """Coach intensity levels (PRD 08, US-11)."""
    LOW = "low"       # Minimal hints, only critical ones
    MEDIUM = "medium" # Balanced guidance
    HIGH = "high"     # Maximum guidance for intensive learning


# Intensity-based configuration
INTENSITY_CONFIG = {
    CoachIntensity.LOW: {
        "cooldown_seconds": 8,      # Longer cooldown
        "streaming_cooldown": 4,
        "max_hints_per_minute": 4,  # Fewer hints
        "min_priority": 2,          # Only high priority hints
    },
    CoachIntensity.MEDIUM: {
        "cooldown_seconds": 2,
        "streaming_cooldown": 1,
        "max_hints_per_minute": 12,
        "min_priority": 4,          # Most hints
    },
    CoachIntensity.HIGH: {
        "cooldown_seconds": 1,      # Very short cooldown
        "streaming_cooldown": 0.5,
        "max_hints_per_minute": 20, # Maximum hints
        "min_priority": 5,          # All hints
    },
}


class AICoachEngine:
    """
    AI-powered coaching engine that generates specific, contextual suggestions.
    Uses Gemini Flash for fast inference (~100-200ms).
    Supports intensity control (low/medium/high) per PRD 08, US-11.
    """

    # Default configuration (medium intensity)
    COOLDOWN_SECONDS = 2  # Reduced from 5 to 2 for faster suggestions
    STREAMING_COOLDOWN = 1  # Shorter cooldown for streaming
    MAX_HINTS_PER_MINUTE = 12  # Increased from 6 to 12
    MIN_TEXT_LENGTH_STREAMING = 15
    MIN_TEXT_LENGTH_FINAL = 5

    def __init__(self):
        self._gemini_client = None
        self._suggestion_counter = 0
        self._last_suggestion_time: float = 0
        self._last_streaming_time: float = 0
        self._suggestions_this_minute: list[float] = []
        self._context: Optional[ConversationContext] = None
        self._objectives: list[SessionObjective] = []
        self._intensity: CoachIntensity = CoachIntensity.MEDIUM
        self._setup_gemini()

    @property
    def intensity(self) -> CoachIntensity:
        """Get current coaching intensity."""
        return self._intensity

    @intensity.setter
    def intensity(self, value: str | CoachIntensity):
        """Set coaching intensity."""
        if isinstance(value, str):
            try:
                self._intensity = CoachIntensity(value)
            except ValueError:
                logger.warning(f"Invalid intensity '{value}', using medium")
                self._intensity = CoachIntensity.MEDIUM
        else:
            self._intensity = value
        logger.info(f"Coach intensity set to: {self._intensity.value}")

    def _get_intensity_config(self) -> dict:
        """Get configuration based on current intensity."""
        return INTENSITY_CONFIG.get(self._intensity, INTENSITY_CONFIG[CoachIntensity.MEDIUM])

    def _setup_gemini(self):
        """Setup Gemini Flash for coaching."""
        if not GEMINI_AVAILABLE:
            logger.warning("google-genai not installed, AI coaching unavailable")
            return

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("GOOGLE_API_KEY not set, AI coaching unavailable")
            return

        try:
            self._gemini_client = genai.Client(api_key=api_key)
            logger.info("Gemini Flash initialized for AI coaching")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini for coaching: {e}")
            self._gemini_client = None

    def start_session(
        self,
        scenario_name: str = "",
        scenario_context: str = "",
        avatar_profile: str = "",
        expected_objections: list[str] = None,
        objectives: list[dict] = None,
        intensity: str = "medium",
        learning_profile: dict = None
    ):
        """Initialize a new coaching session with context, intensity, and learning profile."""
        # Set intensity first
        self.intensity = intensity

        # Parse learning profile if provided
        profile_obj = None
        if learning_profile:
            profile_obj = LearningProfile.from_dict(learning_profile)
            logger.info(f"Learning profile loaded: {profile_obj.total_sessions} sessions, weaknesses: {profile_obj.recurring_weaknesses}")

        self._context = ConversationContext(
            scenario_name=scenario_name or "Cenario de vendas",
            scenario_context=scenario_context or "Treinamento de vendas B2B",
            avatar_profile=avatar_profile or "Decisor de empresa de medio porte",
            expected_objections=expected_objections or ["preco", "timing", "necessidade"],
            conversation_history=[],
            methodology_progress={
                "situation": False,
                "problem": False,
                "implication": False,
                "need_payoff": False,
            },
            pending_objections=[],
            talk_ratio=50,
            learning_profile=profile_obj,
        )

        # Load objectives
        self._objectives = []
        if objectives:
            for obj in objectives:
                self._objectives.append(SessionObjective(
                    id=obj.get("id", f"obj_{len(self._objectives)}"),
                    description=obj.get("description", ""),
                    spin_step=obj.get("spin_step"),
                ))

        self._suggestion_counter = 0
        self._last_suggestion_time = 0
        self._last_streaming_time = 0
        self._suggestions_this_minute = []

        logger.info(f"AI Coach session started: {scenario_name}")

    async def generate_initial_suggestion(self) -> Optional[AISuggestion]:
        """Generate proactive suggestion at session start."""
        if not self._gemini_client:
            logger.warning("Coach: Gemini client not initialized")
            return None

        if not self._context:
            logger.warning("Coach: No context available for initial suggestion")
            return None

        try:
            prompt = f"""Voce e um coach de vendas experiente. Uma sessao de treinamento acabou de comecar.

Cenario: {self._context.scenario_name}
Contexto: {self._context.scenario_context}
Perfil do cliente: {self._context.avatar_profile}

O avatar (cliente) vai iniciar a conversa em breve. Gere UMA sugestao INICIAL para o vendedor - uma pergunta de abertura ou tecnica para comecar bem a conversa.

REGRAS:
1. Seja especifico - de uma pergunta ou frase EXATA que o vendedor pode usar
2. Foque em perguntas de SITUACAO (primeiro passo do SPIN)
3. A sugestao deve ser natural e profissional

Responda APENAS com JSON valido (sem markdown):
{{"type": "question", "title": "Abertura", "message": "Sugestao especifica para iniciar a conversa", "context": "Dica de abertura para engajar o cliente", "priority": 1, "methodology_step": "situation"}}"""

            # Add timeout to prevent blocking
            response = await asyncio.wait_for(
                self._gemini_client.aio.models.generate_content(
                    model="gemini-1.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.4,
                        max_output_tokens=200,
                    )
                ),
                timeout=5.0
            )

            if not response or not response.text:
                logger.warning("Coach: Gemini returned empty response for initial suggestion")
                return None

            result = self._parse_response(response.text, is_streaming=False)
            if result:
                self._record_suggestion(is_streaming=False)
                logger.info(f"Coach: Initial suggestion generated: {result.title}")
            return result

        except asyncio.TimeoutError:
            logger.error("Coach: Initial suggestion timeout after 5s")
            return None
        except Exception as e:
            logger.warning(f"Coach: Initial suggestion generation failed: {e}")
            return None

    def update_context(
        self,
        methodology_progress: dict[str, bool] = None,
        pending_objections: list[str] = None,
        talk_ratio: int = None
    ):
        """Update session context."""
        if not self._context:
            return

        if methodology_progress:
            self._context.methodology_progress = methodology_progress
        if pending_objections is not None:
            self._context.pending_objections = pending_objections
        if talk_ratio is not None:
            self._context.talk_ratio = talk_ratio

    def add_to_history(self, speaker: str, text: str):
        """Add a message to conversation history."""
        if self._context:
            self._context.conversation_history.append((speaker, text))
            # Keep last 20 messages for context
            if len(self._context.conversation_history) > 20:
                self._context.conversation_history = self._context.conversation_history[-20:]

    def _generate_suggestion_id(self) -> str:
        """Generate unique suggestion ID."""
        self._suggestion_counter += 1
        return f"ai_sug_{self._suggestion_counter}"

    def _can_send_suggestion(self, is_streaming: bool = False, priority: int = 3) -> bool:
        """Check if we can send a suggestion (respects rate limits based on intensity)."""
        now = time.time()
        config = self._get_intensity_config()

        # Check cooldown based on intensity
        cooldown = config["streaming_cooldown"] if is_streaming else config["cooldown_seconds"]
        last_time = self._last_streaming_time if is_streaming else self._last_suggestion_time
        time_since_last = now - last_time

        if time_since_last < cooldown:
            logger.debug(f"Coach rate limited: {cooldown - time_since_last:.1f}s remaining (streaming={is_streaming}, intensity={self._intensity.value})")
            return False

        # Check rate limit (max per minute based on intensity)
        max_hints = config["max_hints_per_minute"]
        self._suggestions_this_minute = [
            t for t in self._suggestions_this_minute
            if now - t < 60
        ]
        if len(self._suggestions_this_minute) >= max_hints:
            logger.warning(f"Coach hit max hints/minute limit: {max_hints} (intensity={self._intensity.value})")
            return False

        # Filter by priority based on intensity (low intensity only shows high priority)
        min_priority = config["min_priority"]
        if priority > min_priority:
            logger.debug(f"Coach skipping low priority hint: {priority} > {min_priority} (intensity={self._intensity.value})")
            return False

        return True

    def _record_suggestion(self, is_streaming: bool = False):
        """Record that a suggestion was sent."""
        now = time.time()
        if is_streaming:
            self._last_streaming_time = now
        else:
            self._last_suggestion_time = now
        self._suggestions_this_minute.append(now)

    def _format_conversation_history(self, limit: int = 10) -> str:
        """Format conversation history for prompt."""
        if not self._context or not self._context.conversation_history:
            return "(Inicio da conversa)"

        history = self._context.conversation_history[-limit:]
        lines = []
        for speaker, text in history:
            role = "Vendedor" if speaker == "user" else "Cliente"
            lines.append(f"{role}: {text}")

        return "\n".join(lines)

    def _format_learning_profile_section(self) -> str:
        """Format learning profile data for the main prompt."""
        if not self._context or not self._context.learning_profile:
            return "Primeiro treinamento do vendedor (sem historico)"

        profile = self._context.learning_profile
        lines = []

        # Basic stats
        if profile.total_sessions > 0:
            lines.append(f"Sessoes anteriores: {profile.total_sessions}")
            lines.append(f"Score medio: {profile.average_score:.0f}%")

        # Recurring weaknesses (most important for coaching!)
        if profile.recurring_weaknesses:
            lines.append(f"PONTOS FRACOS RECORRENTES (PRIORIZE AJUDAR AQUI):")
            for weakness in profile.recurring_weaknesses[:3]:  # Top 3
                lines.append(f"  - {weakness}")

        # Recurring strengths
        if profile.recurring_strengths:
            lines.append(f"Pontos fortes: {', '.join(profile.recurring_strengths[:3])}")

        # SPIN proficiency
        if profile.spin_proficiency:
            spin_weak = []
            for step, score in profile.spin_proficiency.items():
                if score < 0.5:  # Less than 50% proficiency
                    step_name = {
                        "situation": "Situacao",
                        "problem": "Problema",
                        "implication": "Implicacao",
                        "need_payoff": "Necessidade"
                    }.get(step, step)
                    spin_weak.append(f"{step_name} ({score*100:.0f}%)")
            if spin_weak:
                lines.append(f"SPIN a melhorar: {', '.join(spin_weak)}")

        # Objection handling weaknesses
        if profile.objection_handling:
            weak_objections = []
            for obj_type, data in profile.objection_handling.items():
                if isinstance(data, dict) and data.get("success_rate", 1) < 0.5:
                    weak_objections.append(obj_type)
            if weak_objections:
                lines.append(f"Objecoes com dificuldade: {', '.join(weak_objections)}")

        return "\n".join(lines) if lines else "Primeiro treinamento do vendedor"

    def _format_weakness_reminder(self) -> str:
        """Format a short weakness reminder for streaming prompt."""
        if not self._context or not self._context.learning_profile:
            return ""

        profile = self._context.learning_profile
        if profile.recurring_weaknesses:
            top_weakness = profile.recurring_weaknesses[0]
            return f"LEMBRE: Vendedor tem dificuldade com: {top_weakness}"
        return ""

    async def analyze_streaming(
        self,
        text: str,
        speaker: str
    ) -> Optional[AISuggestion]:
        """
        Analyze partial transcript for urgent suggestions.
        Uses lighter prompt for faster response.
        """
        if not self._gemini_client or not self._context:
            return None

        if len(text) < self.MIN_TEXT_LENGTH_STREAMING:
            return None

        if not self._can_send_suggestion(is_streaming=True):
            return None

        try:
            prompt = STREAMING_COACHING_PROMPT.format(
                recent_history=self._format_conversation_history(limit=4),
                speaker="vendedor" if speaker == "user" else "cliente",
                text=text,
                spin_s="OK" if self._context.methodology_progress.get("situation") else "-",
                spin_p="OK" if self._context.methodology_progress.get("problem") else "-",
                spin_i="OK" if self._context.methodology_progress.get("implication") else "-",
                spin_n="OK" if self._context.methodology_progress.get("need_payoff") else "-",
                weakness_reminder=self._format_weakness_reminder(),
            )

            response = await self._gemini_client.aio.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=200,
                )
            )

            # Handle empty responses
            if not response or not response.text:
                logger.warning("Gemini returned empty response for streaming coach")
                return None

            result = self._parse_response(response.text, is_streaming=True)
            if result:
                self._record_suggestion(is_streaming=True)
                logger.debug(f"Streaming suggestion generated: {result.title}")

            return result

        except Exception as e:
            logger.warning(f"Streaming analysis failed: {e}")
            return None

    async def analyze_final(
        self,
        text: str,
        speaker: str
    ) -> Optional[AISuggestion]:
        """
        Analyze final transcript for comprehensive suggestion.
        """
        if not self._gemini_client or not self._context:
            return None

        if len(text) < self.MIN_TEXT_LENGTH_FINAL:
            return None

        if not self._can_send_suggestion(is_streaming=False):
            return None

        # Add to history
        self.add_to_history(speaker, text)

        try:
            prompt = AI_COACHING_PROMPT.format(
                scenario_name=self._context.scenario_name,
                scenario_context=self._context.scenario_context,
                avatar_profile=self._context.avatar_profile,
                objections=", ".join(self._context.expected_objections),
                learning_profile_section=self._format_learning_profile_section(),
                conversation_history=self._format_conversation_history(limit=10),
                speaker="vendedor" if speaker == "user" else "cliente",
                text=text,
                spin_s="Completo" if self._context.methodology_progress.get("situation") else "Pendente",
                spin_p="Completo" if self._context.methodology_progress.get("problem") else "Pendente",
                spin_i="Completo" if self._context.methodology_progress.get("implication") else "Pendente",
                spin_n="Completo" if self._context.methodology_progress.get("need_payoff") else "Pendente",
                pending_objections=", ".join(self._context.pending_objections) if self._context.pending_objections else "Nenhuma",
                talk_ratio=self._context.talk_ratio,
            )

            response = await self._gemini_client.aio.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=300,
                )
            )

            # Handle empty responses
            if not response or not response.text:
                logger.warning("Gemini returned empty response for final coach")
                return None

            result = self._parse_response(response.text, is_streaming=False)
            if result:
                self._record_suggestion(is_streaming=False)
                logger.debug(f"Final suggestion generated: {result.title}")

                # Check if this completes any objectives
                await self._check_objectives(text, speaker)

            return result

        except Exception as e:
            logger.warning(f"Final analysis failed: {e}")
            return None

    def _parse_response(
        self,
        response_text: str,
        is_streaming: bool
    ) -> Optional[AISuggestion]:
        """Parse Gemini response into AISuggestion."""
        try:
            # Clean response
            text = response_text.strip()

            # Remove markdown code blocks if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            if text.endswith("```"):
                text = text[:-3]

            text = text.strip()

            data = json.loads(text)

            # Skip if flagged
            if data.get("skip"):
                return None

            # Validate required fields
            if not all(k in data for k in ["type", "title", "message"]):
                logger.warning(f"Missing required fields in response: {data}")
                return None

            # Map type
            type_map = {
                "question": SuggestionType.QUESTION,
                "statement": SuggestionType.STATEMENT,
                "technique": SuggestionType.TECHNIQUE,
                "objection_response": SuggestionType.OBJECTION_RESPONSE,
                "encouragement": SuggestionType.ENCOURAGEMENT,
            }
            suggestion_type = type_map.get(data["type"], SuggestionType.TECHNIQUE)

            # Map methodology step
            step_map = {
                "situation": MethodologyStep.SITUATION,
                "problem": MethodologyStep.PROBLEM,
                "implication": MethodologyStep.IMPLICATION,
                "need_payoff": MethodologyStep.NEED_PAYOFF,
            }
            methodology_step = step_map.get(data.get("methodology_step"))

            return AISuggestion(
                id=self._generate_suggestion_id(),
                type=suggestion_type,
                title=data["title"],
                message=data["message"],
                context=data.get("context", ""),
                priority=int(data.get("priority", 3)),
                methodology_step=methodology_step,
                is_streaming=is_streaming,
                confidence=0.7 if is_streaming else 1.0,
            )

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON response: {e} - Response: {response_text[:200]}")
            return None
        except Exception as e:
            logger.warning(f"Failed to parse suggestion: {e}")
            return None

    async def _check_objectives(self, text: str, speaker: str):
        """Check if any objectives were completed."""
        if not self._objectives or not self._gemini_client:
            return

        uncompleted = [obj for obj in self._objectives if not obj.completed]
        if not uncompleted:
            return

        # Simple check - could be enhanced with AI
        for obj in uncompleted:
            # Check SPIN-based objectives
            if obj.spin_step and self._context:
                if self._context.methodology_progress.get(obj.spin_step):
                    obj.completed = True
                    obj.completed_at = datetime.now(timezone.utc)
                    logger.info(f"Objective completed: {obj.description}")

    def get_objectives_state(self) -> list[dict]:
        """Get current objectives state."""
        return [obj.to_dict() for obj in self._objectives]

    def get_completed_objectives(self) -> list[str]:
        """Get IDs of completed objectives."""
        return [obj.id for obj in self._objectives if obj.completed]


# Singleton instance
_ai_coach: Optional[AICoachEngine] = None


def get_ai_coach() -> AICoachEngine:
    """Get or create the singleton AI coach instance."""
    global _ai_coach
    if _ai_coach is None:
        _ai_coach = AICoachEngine()
    return _ai_coach


def reset_ai_coach():
    """Reset the AI coach for a new session."""
    global _ai_coach
    _ai_coach = None
