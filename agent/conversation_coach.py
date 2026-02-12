"""
Conversation Coach Module (Layer 2)

Lightweight proactive coaching that detects:
- User hesitation (very short responses, < N tokens)
- Prolonged silence (user not speaking for stuck_timeout seconds)

Pattern adapted from Immersion/ConversationCoach:
- Background watchdog loop for silence detection
- Token-counting for hesitation detection
- Zero LLM cost — pure heuristic

Integrates with existing coaching layers:
- Layer 1: Keywords (coaching.py) — zero cost
- Layer 2: THIS MODULE — zero cost, proactive
- Layer 3: AI Coach (ai_coach.py) — Gemini Flash, every 2-3 turns
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Callable, Awaitable, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProactiveHint:
    """A proactive coaching nudge (hesitation or silence-based)."""
    trigger: str  # "hesitation" | "silence"
    text: str
    reason: str


# PT-BR nudge templates by SPIN stage
HESITATION_NUDGES = {
    "situation": [
        "Tente fazer perguntas sobre a situacao atual do cliente.",
        "Explore o cenario do cliente — pergunte sobre processos e ferramentas.",
    ],
    "problem": [
        "Identifique os problemas do cliente — pergunte sobre dificuldades.",
        "Explore os desafios que o cliente enfrenta no dia a dia.",
    ],
    "implication": [
        "Aprofunde o impacto do problema — pergunte sobre consequencias.",
        "O que acontece se o problema nao for resolvido? Explore isso.",
    ],
    "need_payoff": [
        "Mostre o valor da solucao — como ela resolve o problema?",
        "Conecte sua solucao ao problema identificado.",
    ],
    "default": [
        "Tente elaborar mais sua resposta.",
        "Que tal fazer uma pergunta aberta ao cliente?",
        "Explore o que o cliente acabou de dizer.",
    ],
}

SILENCE_NUDGES = [
    "Voce esta em silencio ha um tempo. Tente retomar a conversa!",
    "O cliente esta esperando — que tal fazer uma pergunta?",
    "Nao deixe o silencio se prolongar. Continue a conversa!",
]


class ConversationCoach:
    """
    Detects user hesitation and prolonged silence.
    Generates zero-cost proactive nudges without any LLM calls.

    Usage:
        coach = ConversationCoach(stuck_timeout=10, hesitation_tokens=3)
        coach.start_watchdog(on_silence_callback)

        # On each user message:
        coach.reset_timer()
        if hint := coach.check_hesitation(text, spin_stage):
            send_hint(hint)
    """

    def __init__(
        self,
        stuck_timeout: float = 10.0,
        hesitation_tokens: int = 3,
    ):
        self._stuck_timeout = stuck_timeout
        self._hesitation_tokens = hesitation_tokens
        self._last_user_activity = time.monotonic()
        self._watchdog_task: Optional[asyncio.Task] = None
        self._nudge_index = 0  # Rotate through nudges
        self._silence_nudge_index = 0
        self._active = True

    def reset_timer(self) -> None:
        """Call when user speaks — resets the silence watchdog."""
        self._last_user_activity = time.monotonic()

    def check_hesitation(
        self, text: str, spin_stage: str = "default"
    ) -> Optional[ProactiveHint]:
        """
        Check if user response is too short (hesitation).
        Returns a nudge if text has <= hesitation_tokens meaningful words.
        """
        # Clean and tokenize
        cleaned = text.strip().replace("?", " ").replace(".", " ").replace(",", " ")
        tokens = [t for t in cleaned.split() if len(t) > 1]  # Skip single chars

        if len(tokens) > self._hesitation_tokens:
            return None  # Not hesitation

        # Pick a nudge based on SPIN stage
        nudges = HESITATION_NUDGES.get(spin_stage, HESITATION_NUDGES["default"])
        nudge_text = nudges[self._nudge_index % len(nudges)]
        self._nudge_index += 1

        return ProactiveHint(
            trigger="hesitation",
            text=nudge_text,
            reason=f"Resposta curta ({len(tokens)} palavras)",
        )

    def start_watchdog(
        self,
        on_silence: Callable[[], Awaitable[None]],
    ) -> None:
        """Start background watchdog that calls on_silence when user is silent too long."""
        if self._watchdog_task and not self._watchdog_task.done():
            return  # Already running

        async def _watchdog_loop():
            while self._active:
                await asyncio.sleep(max(self._stuck_timeout / 2, 2))
                elapsed = time.monotonic() - self._last_user_activity
                if elapsed > self._stuck_timeout:
                    try:
                        await on_silence()
                    except Exception as e:
                        logger.warning(f"ConversationCoach silence callback failed: {e}")
                    # Reset timer after nudge to avoid spamming
                    self._last_user_activity = time.monotonic()

        self._watchdog_task = asyncio.create_task(_watchdog_loop())
        logger.info(
            f"ConversationCoach watchdog started: "
            f"stuck_timeout={self._stuck_timeout}s, "
            f"hesitation_tokens={self._hesitation_tokens}"
        )

    def get_silence_nudge(self) -> ProactiveHint:
        """Get the next silence nudge (rotates through templates)."""
        text = SILENCE_NUDGES[self._silence_nudge_index % len(SILENCE_NUDGES)]
        self._silence_nudge_index += 1
        return ProactiveHint(
            trigger="silence",
            text=text,
            reason=f"Silencio > {self._stuck_timeout}s",
        )

    def stop(self) -> None:
        """Stop the watchdog loop."""
        self._active = False
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
            self._watchdog_task = None
        logger.info("ConversationCoach stopped")
