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

Se houver uma sugestao URGENTE (objecao detectada, oportunidade clara), responda com JSON.
Se nao houver nada urgente, responda apenas: {{"skip": true}}

JSON: {{"type": "question|statement|objection_response", "title": "...", "message": "Sugestao especifica", "context": "...", "priority": 1-3, "methodology_step": "..."}}"""


class AICoachEngine:
    """
    AI-powered coaching engine that generates specific, contextual suggestions.
    Uses Gemini Flash for fast inference (~100-200ms).
    """

    # Configuration
    COOLDOWN_SECONDS = 5  # Reduced from 15 to 5
    STREAMING_COOLDOWN = 2  # Shorter cooldown for streaming
    MAX_HINTS_PER_MINUTE = 6
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
        self._setup_gemini()

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
        objectives: list[dict] = None
    ):
        """Initialize a new coaching session with context."""
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
        if not self._gemini_client or not self._context:
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

            response = await self._gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.4,
                    max_output_tokens=200,
                )
            )

            if not response or not response.text:
                logger.warning("Gemini returned empty response for initial suggestion")
                return None

            result = self._parse_response(response.text, is_streaming=False)
            if result:
                self._record_suggestion(is_streaming=False)
                logger.info(f"Initial suggestion generated: {result.title}")
            return result

        except Exception as e:
            logger.warning(f"Initial suggestion generation failed: {e}")
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

    def _can_send_suggestion(self, is_streaming: bool = False) -> bool:
        """Check if we can send a suggestion (respects rate limits)."""
        now = time.time()

        # Check cooldown
        cooldown = self.STREAMING_COOLDOWN if is_streaming else self.COOLDOWN_SECONDS
        last_time = self._last_streaming_time if is_streaming else self._last_suggestion_time

        if now - last_time < cooldown:
            return False

        # Check rate limit (max per minute)
        self._suggestions_this_minute = [
            t for t in self._suggestions_this_minute
            if now - t < 60
        ]
        if len(self._suggestions_this_minute) >= self.MAX_HINTS_PER_MINUTE:
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
            )

            response = await self._gemini_client.aio.models.generate_content(
                model="gemini-2.0-flash",
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
                model="gemini-2.0-flash",
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
