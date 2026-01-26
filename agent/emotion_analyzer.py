"""
Emotion Analyzer Module

Analyzes user emotions during roleplay sessions using AI (Gemini Flash)
with keyword-based fallback for reliability.

The emotion meter should reflect the CLIENT's satisfaction level,
not the agent's responses.
"""

import os
import logging
from typing import Literal, TypedDict

# Try to import google.generativeai for Gemini Flash
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = logging.getLogger(__name__)

# Valid emotion states (ordered from positive to negative)
EmotionState = Literal["happy", "receptive", "neutral", "hesitant", "frustrated"]
VALID_EMOTIONS: list[EmotionState] = ["happy", "receptive", "neutral", "hesitant", "frustrated"]

# Trend types
TrendType = Literal["improving", "declining", "stable"]

# Base intensity for each emotion state (0-100 scale)
EMOTION_BASE_INTENSITY: dict[EmotionState, int] = {
    "happy": 100,
    "receptive": 75,
    "neutral": 50,
    "hesitant": 25,
    "frustrated": 0,
}


class EmotionResult(TypedDict):
    """Result of emotion analysis with intensity, trend, and reason."""
    state: EmotionState
    intensity: int  # 0-100
    trend: TrendType
    reason: str | None  # Human-readable reason for emotion change

# Emotion analysis prompt for Gemini Flash
EMOTION_ANALYSIS_PROMPT = """Analise a emocao do CLIENTE (usuario) nesta fala de uma sessao de treinamento de vendas.

Contexto: O usuario esta praticando vendas/negociacao com um avatar AI. Voce deve avaliar como o CLIENTE (avatar) esta se sentindo, nao o vendedor.

Fala do cliente (avatar): "{text}"

Historico recente da conversa (para contexto):
{context}

Baseado na fala E no contexto, qual e o estado emocional do CLIENTE?

Responda com APENAS uma palavra:
- happy: Cliente satisfeito, interessado, pronto para fechar
- receptive: Cliente aberto, ouvindo com atencao, engajado
- neutral: Cliente neutro, ainda avaliando, sem opiniao formada
- hesitant: Cliente com duvidas, incerto, precisa de mais informacoes
- frustrated: Cliente irritado, impaciente, perdendo interesse

Resposta (apenas uma palavra):"""


class EmotionAnalyzer:
    """
    Analyzes emotions using Gemini Flash with keyword fallback.

    The analyzer evaluates the CLIENT's (avatar's) emotional state,
    which reflects how well the user (salesperson) is performing.
    """

    def __init__(self):
        """Initialize the emotion analyzer."""
        self._gemini_model = None
        self._intensity_history: list[int] = []  # Track recent intensities for trend
        self._max_history = 5  # Number of readings to keep for trend calculation
        self._last_state: EmotionState | None = None  # Track previous state for reason generation
        self._setup_gemini()

    def _setup_gemini(self):
        """Setup Gemini Flash for emotion analysis."""
        if not GEMINI_AVAILABLE:
            logger.warning("google-generativeai not installed, using keyword fallback only")
            return

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("GOOGLE_API_KEY not set, using keyword fallback only")
            return

        try:
            genai.configure(api_key=api_key)
            # Use Gemini Flash for fast, cheap analysis
            self._gemini_model = genai.GenerativeModel("gemini-2.0-flash-exp")
            logger.info("Gemini Flash initialized for emotion analysis")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            self._gemini_model = None

    async def analyze(
        self,
        text: str,
        conversation_history: list[str] | None = None,
        use_ai: bool = True
    ) -> EmotionState:
        """
        Analyze emotion from text.

        Args:
            text: The text to analyze (should be avatar/client response)
            conversation_history: Recent conversation lines for context
            use_ai: Whether to use AI analysis (falls back to keywords if fails)

        Returns:
            EmotionState: One of 'happy', 'receptive', 'neutral', 'hesitant', 'frustrated'
        """
        if not text or not text.strip():
            return "neutral"

        # Try AI analysis first (if enabled and available)
        if use_ai and self._gemini_model:
            try:
                emotion = await self._analyze_with_gemini(text, conversation_history)
                if emotion in VALID_EMOTIONS:
                    logger.debug(f"Gemini emotion analysis: {emotion}")
                    return emotion
            except Exception as e:
                logger.warning(f"Gemini analysis failed, using fallback: {e}")

        # Fallback to keyword-based analysis
        emotion = self._analyze_with_keywords(text)
        logger.debug(f"Keyword emotion analysis: {emotion}")
        return emotion

    async def analyze_with_intensity(
        self,
        text: str,
        conversation_history: list[str] | None = None,
        use_ai: bool = True
    ) -> EmotionResult:
        """
        Analyze emotion with intensity (0-100) and trend.

        Args:
            text: The text to analyze (should be avatar/client response)
            conversation_history: Recent conversation lines for context
            use_ai: Whether to use AI analysis

        Returns:
            EmotionResult with state, intensity (0-100), trend, and reason
        """
        # Get base emotion state
        state = await self.analyze(text, conversation_history, use_ai)

        # Calculate intensity based on keyword strength
        intensity = self._calculate_intensity(text, state)

        # Update history and calculate trend
        self._intensity_history.append(intensity)
        if len(self._intensity_history) > self._max_history:
            self._intensity_history.pop(0)

        trend = self._calculate_trend()

        # Generate reason if state changed
        reason = self._generate_reason(state, trend)

        # Update last state
        self._last_state = state

        logger.debug(f"Emotion result: state={state}, intensity={intensity}, trend={trend}, reason={reason}")

        return EmotionResult(state=state, intensity=intensity, trend=trend, reason=reason)

    def _generate_reason(self, new_state: EmotionState, trend: TrendType) -> str | None:
        """Generate a human-readable reason for emotion change."""
        # Only show reason if state actually changed
        if self._last_state is None or self._last_state == new_state:
            return None

        # Reason based on transition
        reasons: dict[tuple[EmotionState, EmotionState], str] = {
            # Positive transitions
            ("frustrated", "hesitant"): "Cliente menos resistente",
            ("frustrated", "neutral"): "Cliente mais aberto",
            ("frustrated", "receptive"): "Cliente engajou na conversa",
            ("frustrated", "happy"): "Cliente mudou de opiniao!",
            ("hesitant", "neutral"): "Duvidas diminuindo",
            ("hesitant", "receptive"): "Cliente mais interessado",
            ("hesitant", "happy"): "Cliente convencido!",
            ("neutral", "receptive"): "Cliente demonstrou interesse",
            ("neutral", "happy"): "Cliente satisfeito",
            ("receptive", "happy"): "Cliente pronto para fechar",
            # Negative transitions
            ("happy", "receptive"): "Cliente ainda interessado",
            ("happy", "neutral"): "Cliente esfriou um pouco",
            ("happy", "hesitant"): "Surgiram duvidas",
            ("happy", "frustrated"): "Cliente ficou frustrado",
            ("receptive", "neutral"): "Interesse diminuiu",
            ("receptive", "hesitant"): "Cliente com duvidas",
            ("receptive", "frustrated"): "Cliente perdeu paciencia",
            ("neutral", "hesitant"): "Cliente com incertezas",
            ("neutral", "frustrated"): "Cliente impaciente",
            ("hesitant", "frustrated"): "Cliente desistindo",
        }

        return reasons.get((self._last_state, new_state))

    def _calculate_intensity(self, text: str, state: EmotionState) -> int:
        """
        Calculate intensity within the emotion state range.

        Each state has a base intensity, and we adjust +/- 12 points
        based on keyword strength.
        """
        base = EMOTION_BASE_INTENSITY[state]
        text_lower = text.lower()

        # Strong indicators add/subtract from base
        strong_positive = ["excelente", "perfeito", "adorei", "maravilhoso", "fantastico"]
        strong_negative = ["ridiculo", "absurdo", "impossivel", "nunca", "jamais"]
        moderate_positive = ["bom", "legal", "interessante", "ok", "certo"]
        moderate_negative = ["mas", "porem", "entretanto", "nao sei"]

        adjustment = 0

        # Check for strong indicators
        if any(kw in text_lower for kw in strong_positive):
            adjustment += 10
        if any(kw in text_lower for kw in strong_negative):
            adjustment -= 10
        if any(kw in text_lower for kw in moderate_positive):
            adjustment += 5
        if any(kw in text_lower for kw in moderate_negative):
            adjustment -= 5

        # Clamp to valid range
        intensity = max(0, min(100, base + adjustment))
        return intensity

    def _calculate_trend(self) -> TrendType:
        """Calculate trend based on recent intensity history."""
        if len(self._intensity_history) < 2:
            return "stable"

        # Compare average of recent readings vs older readings
        recent = self._intensity_history[-2:]
        older = self._intensity_history[:-2] if len(self._intensity_history) > 2 else [self._intensity_history[0]]

        avg_recent = sum(recent) / len(recent)
        avg_older = sum(older) / len(older)

        diff = avg_recent - avg_older

        if diff > 8:
            return "improving"
        elif diff < -8:
            return "declining"
        else:
            return "stable"

    def reset_history(self):
        """Reset intensity history (call at start of new session)."""
        self._intensity_history = []

    async def _analyze_with_gemini(
        self,
        text: str,
        conversation_history: list[str] | None = None
    ) -> str:
        """Analyze emotion using Gemini Flash."""
        # Build context from recent history (last 4 messages)
        context = ""
        if conversation_history:
            recent = conversation_history[-4:]
            context = "\n".join(recent)
        else:
            context = "(sem historico disponivel)"

        prompt = EMOTION_ANALYSIS_PROMPT.format(text=text, context=context)

        # Generate response (non-streaming for speed)
        response = await self._gemini_model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,  # Low temperature for consistent results
                max_output_tokens=10,  # We only need one word
            )
        )

        # Extract and validate emotion
        emotion = response.text.strip().lower()

        # Handle potential variations
        emotion_map = {
            "happy": "happy",
            "feliz": "happy",
            "satisfeito": "happy",
            "receptive": "receptive",
            "receptivo": "receptive",
            "aberto": "receptive",
            "neutral": "neutral",
            "neutro": "neutral",
            "hesitant": "hesitant",
            "hesitante": "hesitant",
            "duvidoso": "hesitant",
            "frustrated": "frustrated",
            "frustrado": "frustrated",
            "irritado": "frustrated",
        }

        return emotion_map.get(emotion, emotion)

    def _analyze_with_keywords(self, text: str) -> EmotionState:
        """
        Fallback keyword-based emotion analysis.

        This analyzes the AVATAR's response (client) to determine
        how satisfied they are with the user's (salesperson's) approach.
        """
        text_lower = text.lower()

        # Frustrated indicators (client losing patience)
        frustrated_keywords = [
            "ja entendi", "nao estou interessado", "olha...", "voce nao esta",
            "nao e isso", "como eu disse", "pela ultima vez", "chega",
            "nao quero", "cansei", "vou desligar", "nao tenho tempo",
            "isso nao funciona", "impossivel", "ridiculo"
        ]
        if any(kw in text_lower for kw in frustrated_keywords):
            return "frustrated"

        # Hesitant indicators (client uncertain)
        hesitant_keywords = [
            "nao sei", "tenho duvidas", "preciso pensar", "talvez", "mas...",
            "porem", "ainda assim", "nao tenho certeza", "hmm", "sera que",
            "deixa eu ver", "vou analisar", "preciso consultar", "nao posso decidir"
        ]
        if any(kw in text_lower for kw in hesitant_keywords):
            return "hesitant"

        # Happy indicators (client satisfied/ready to close)
        happy_keywords = [
            "interessante", "faz sentido", "gostei", "otimo", "excelente",
            "muito bom", "concordo", "voce tem razao", "fechado", "vamos la",
            "perfeito", "adorei", "me convenceu", "pode mandar", "quando comecamos",
            "ok vamos fechar", "estou convencido"
        ]
        if any(kw in text_lower for kw in happy_keywords):
            return "happy"

        # Receptive indicators (client engaged/listening)
        receptive_keywords = [
            "entendo", "continue", "me conte mais", "como assim", "explique",
            "ok", "certo", "ah sim", "uhum", "interessante", "e dai",
            "pode falar", "estou ouvindo", "fale mais"
        ]
        if any(kw in text_lower for kw in receptive_keywords):
            return "receptive"

        # Default to neutral
        return "neutral"

    def analyze_sync(self, text: str) -> EmotionState:
        """
        Synchronous keyword-only analysis for when async is not available.
        """
        return self._analyze_with_keywords(text)


# Singleton instance for easy access
_analyzer: EmotionAnalyzer | None = None


def get_emotion_analyzer() -> EmotionAnalyzer:
    """Get or create the singleton emotion analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = EmotionAnalyzer()
    return _analyzer


async def analyze_emotion(
    text: str,
    conversation_history: list[str] | None = None,
    use_ai: bool = True
) -> EmotionState:
    """
    Convenience function to analyze emotion.

    Args:
        text: The text to analyze
        conversation_history: Recent conversation for context
        use_ai: Whether to use AI analysis (default True)

    Returns:
        EmotionState: The detected emotion
    """
    analyzer = get_emotion_analyzer()
    return await analyzer.analyze(text, conversation_history, use_ai)


def analyze_emotion_sync(text: str) -> EmotionState:
    """
    Synchronous emotion analysis using keywords only.

    Args:
        text: The text to analyze

    Returns:
        EmotionState: The detected emotion
    """
    analyzer = get_emotion_analyzer()
    return analyzer.analyze_sync(text)


async def analyze_emotion_with_intensity(
    text: str,
    conversation_history: list[str] | None = None,
    use_ai: bool = True
) -> EmotionResult:
    """
    Analyze emotion with intensity (0-100) and trend.

    Args:
        text: The text to analyze
        conversation_history: Recent conversation for context
        use_ai: Whether to use AI analysis (default True)

    Returns:
        EmotionResult with state, intensity, and trend
    """
    analyzer = get_emotion_analyzer()
    return await analyzer.analyze_with_intensity(text, conversation_history, use_ai)


def reset_emotion_history():
    """Reset the emotion history (call at start of new session)."""
    analyzer = get_emotion_analyzer()
    analyzer.reset_history()
