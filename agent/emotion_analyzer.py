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

# Try to import google.genai (new unified SDK)
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

logger = logging.getLogger(__name__)

# Valid emotion states (ordered from positive to negative)
# Expanded from 5 to 8 states for more granular detection
EmotionState = Literal[
    "enthusiastic",  # NEW: Very interested, ready to act, excited
    "happy",         # Satisfied, positive, ready to close
    "receptive",     # Open, engaged, listening attentively
    "curious",       # NEW: Asking questions, seeking info, interested
    "neutral",       # Evaluating, no opinion formed yet
    "hesitant",      # Uncertain, has doubts, needs more info
    "skeptical",     # NEW: Doubting, challenging, questioning validity
    "frustrated"     # Irritated, impatient, losing interest
]
VALID_EMOTIONS: list[EmotionState] = [
    "enthusiastic", "happy", "receptive", "curious",
    "neutral", "hesitant", "skeptical", "frustrated"
]

# Trend types
TrendType = Literal["improving", "declining", "stable"]

# Base intensity for each emotion state (0-100 scale)
EMOTION_BASE_INTENSITY: dict[EmotionState, int] = {
    "enthusiastic": 100,
    "happy": 88,
    "receptive": 75,
    "curious": 62,
    "neutral": 50,
    "hesitant": 35,
    "skeptical": 20,
    "frustrated": 0,
}


class EmotionResult(TypedDict):
    """Result of emotion analysis with intensity, trend, and reason."""
    state: EmotionState
    intensity: int  # 0-100
    trend: TrendType
    reason: str | None  # Human-readable reason for emotion change

# Emotion analysis prompt for Gemini Flash
# Enhanced with 8 states for more precise detection
EMOTION_ANALYSIS_PROMPT = """Analise a emocao do CLIENTE nesta conversa de vendas.

Contexto: O usuario esta praticando vendas/negociacao com um avatar AI. Voce deve avaliar como o CLIENTE (avatar) esta se sentindo, nao o vendedor.

Fala do cliente (avatar): "{text}"

Historico recente da conversa (para contexto):
{context}

Indicadores a observar:
- Tom: palavras intensificadoras (muito, demais, nunca), pausas, interjeicoes
- Conteudo: perguntas (interesse), objecoes (resistencia), concordancia
- Padrao: mudanca de comportamento vs falas anteriores

Estados possiveis (do mais positivo ao mais negativo):
- enthusiastic: Muito interessado, animado, frases como "adorei", "quando podemos comecar", "excelente"
- happy: Satisfeito, "faz sentido", "gostei da proposta", pronto para fechar
- receptive: Aberto, engajado, "entendo", "continue", "me conte mais"
- curious: Questionador positivo, "como funciona?", "e se...", buscando informacao
- neutral: Avaliando, sem opiniao clara ainda, tom profissional
- hesitant: Incerto, "nao sei", "preciso pensar", "talvez", tem duvidas
- skeptical: Duvidoso, "sera mesmo?", "outros dizem que...", "nao acredito", desafiando
- frustrated: Irritado, "ja disse", "nao e isso", "olha...", perdendo paciencia

Responda com APENAS uma palavra (o estado emocional):"""


class EmotionAnalyzer:
    """
    Analyzes emotions using Gemini Flash with keyword fallback.

    The analyzer evaluates the CLIENT's (avatar's) emotional state,
    which reflects how well the user (salesperson) is performing.
    """

    def __init__(self):
        """Initialize the emotion analyzer."""
        self._gemini_client = None
        self._intensity_history: list[int] = []  # Track recent intensities for trend
        self._max_history = 5  # Number of readings to keep for trend calculation
        self._last_state: EmotionState | None = None  # Track previous state for reason generation
        self._setup_gemini()

    def _setup_gemini(self):
        """Setup Gemini Flash for emotion analysis."""
        if not GEMINI_AVAILABLE:
            logger.warning("google-genai not installed, using keyword fallback only")
            return

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.warning("GOOGLE_API_KEY not set, using keyword fallback only")
            return

        try:
            # Use new unified google-genai SDK with Client pattern
            self._gemini_client = genai.Client(api_key=api_key)
            logger.info("Gemini Flash initialized for emotion analysis (google-genai SDK)")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini: {e}")
            self._gemini_client = None

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
        if use_ai and self._gemini_client:
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

        # Reason based on transition (expanded for 8 states)
        reasons: dict[tuple[EmotionState, EmotionState], str] = {
            # Positive transitions (moving up the scale)
            ("frustrated", "skeptical"): "Cliente menos resistente",
            ("frustrated", "hesitant"): "Cliente considerando",
            ("frustrated", "neutral"): "Cliente mais aberto",
            ("frustrated", "receptive"): "Cliente engajou na conversa",
            ("frustrated", "happy"): "Cliente mudou de opiniao!",
            ("frustrated", "enthusiastic"): "Transformacao completa!",
            ("skeptical", "hesitant"): "Duvidas diminuindo",
            ("skeptical", "neutral"): "Cliente mais aberto",
            ("skeptical", "curious"): "Cliente interessado em saber mais",
            ("skeptical", "receptive"): "Cliente convencido",
            ("hesitant", "neutral"): "Incertezas diminuindo",
            ("hesitant", "curious"): "Cliente quer entender melhor",
            ("hesitant", "receptive"): "Cliente mais interessado",
            ("hesitant", "happy"): "Cliente convencido!",
            ("neutral", "curious"): "Despertou curiosidade",
            ("neutral", "receptive"): "Cliente demonstrou interesse",
            ("neutral", "happy"): "Cliente satisfeito",
            ("curious", "receptive"): "Cliente engajado",
            ("curious", "happy"): "Cliente muito satisfeito",
            ("curious", "enthusiastic"): "Cliente muito animado!",
            ("receptive", "happy"): "Cliente pronto para fechar",
            ("receptive", "enthusiastic"): "Cliente entusiasmado!",
            ("happy", "enthusiastic"): "Cliente muito animado!",
            # Negative transitions (moving down the scale)
            ("enthusiastic", "happy"): "Cliente ainda satisfeito",
            ("enthusiastic", "receptive"): "Entusiasmo diminuiu",
            ("enthusiastic", "neutral"): "Cliente esfriou",
            ("happy", "receptive"): "Cliente ainda interessado",
            ("happy", "curious"): "Surgiram perguntas",
            ("happy", "neutral"): "Cliente esfriou um pouco",
            ("happy", "hesitant"): "Surgiram duvidas",
            ("happy", "skeptical"): "Cliente questionando",
            ("happy", "frustrated"): "Cliente ficou frustrado",
            ("receptive", "curious"): "Cliente quer mais detalhes",
            ("receptive", "neutral"): "Interesse diminuiu",
            ("receptive", "hesitant"): "Cliente com duvidas",
            ("receptive", "skeptical"): "Cliente duvidando",
            ("receptive", "frustrated"): "Cliente perdeu paciencia",
            ("curious", "neutral"): "Curiosidade satisfeita",
            ("curious", "hesitant"): "Respostas nao convenceram",
            ("curious", "skeptical"): "Cliente duvidoso",
            ("neutral", "hesitant"): "Cliente com incertezas",
            ("neutral", "skeptical"): "Cliente questionando",
            ("neutral", "frustrated"): "Cliente impaciente",
            ("hesitant", "skeptical"): "Duvidas aumentando",
            ("hesitant", "frustrated"): "Cliente desistindo",
            ("skeptical", "frustrated"): "Cliente perdeu paciencia",
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

        # Generate response using new google-genai SDK
        response = await self._gemini_client.aio.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,  # Low temperature for consistent results
                max_output_tokens=10,  # We only need one word
            )
        )

        # Extract and validate emotion (handle empty responses)
        if not response or not response.text:
            logger.warning("Gemini returned empty response for emotion analysis")
            raise ValueError("Empty response from Gemini")

        emotion = response.text.strip().lower()

        # Handle potential variations (expanded for 8 states)
        emotion_map = {
            # Enthusiastic
            "enthusiastic": "enthusiastic",
            "entusiasmado": "enthusiastic",
            "animado": "enthusiastic",
            "empolgado": "enthusiastic",
            "excitado": "enthusiastic",
            # Happy
            "happy": "happy",
            "feliz": "happy",
            "satisfeito": "happy",
            "contente": "happy",
            # Receptive
            "receptive": "receptive",
            "receptivo": "receptive",
            "aberto": "receptive",
            "engajado": "receptive",
            # Curious
            "curious": "curious",
            "curioso": "curious",
            "interessado": "curious",
            "questionador": "curious",
            # Neutral
            "neutral": "neutral",
            "neutro": "neutral",
            "indiferente": "neutral",
            # Hesitant
            "hesitant": "hesitant",
            "hesitante": "hesitant",
            "duvidoso": "hesitant",
            "incerto": "hesitant",
            # Skeptical
            "skeptical": "skeptical",
            "cetico": "skeptical",
            "desconfiado": "skeptical",
            "suspeitoso": "skeptical",
            # Frustrated
            "frustrated": "frustrated",
            "frustrado": "frustrated",
            "irritado": "frustrated",
            "impaciente": "frustrated",
        }

        return emotion_map.get(emotion, emotion)

    def _analyze_with_keywords(self, text: str) -> EmotionState:
        """
        Fallback keyword-based emotion analysis.

        This analyzes the AVATAR's response (client) to determine
        how satisfied they are with the user's (salesperson's) approach.
        Expanded to support 8 emotion states.
        """
        text_lower = text.lower()

        # Frustrated indicators (client losing patience) - Priority 1
        frustrated_keywords = [
            "ja entendi", "nao estou interessado", "olha...", "voce nao esta",
            "nao e isso", "como eu disse", "pela ultima vez", "chega",
            "nao quero", "cansei", "vou desligar", "nao tenho tempo",
            "isso nao funciona", "impossivel", "ridiculo", "absurdo",
            "nao me interessa", "tchau", "encerra"
        ]
        if any(kw in text_lower for kw in frustrated_keywords):
            return "frustrated"

        # Skeptical indicators (client doubting) - Priority 2
        skeptical_keywords = [
            "sera mesmo", "nao acredito", "duvido", "prove", "como posso ter certeza",
            "outros dizem", "ja ouvi isso antes", "parece bom demais", "qual a garantia",
            "nao confio", "fonte", "evidencia", "dados", "tem como provar",
            "nao me convence", "sei nao", "acho dificil"
        ]
        if any(kw in text_lower for kw in skeptical_keywords):
            return "skeptical"

        # Hesitant indicators (client uncertain) - Priority 3
        hesitant_keywords = [
            "nao sei", "tenho duvidas", "preciso pensar", "talvez", "mas...",
            "porem", "ainda assim", "nao tenho certeza", "hmm", "sera que",
            "deixa eu ver", "vou analisar", "preciso consultar", "nao posso decidir",
            "vou pensar", "depois vejo", "quem sabe"
        ]
        if any(kw in text_lower for kw in hesitant_keywords):
            return "hesitant"

        # Enthusiastic indicators (client very excited) - Priority 4
        enthusiastic_keywords = [
            "adorei", "incrivel", "fantastico", "maravilhoso", "quando comecamos",
            "quero agora", "fecha", "manda o contrato", "estou muito animado",
            "exatamente o que preciso", "perfeito", "sensacional", "uau",
            "isso e demais", "preciso disso", "vamos em frente"
        ]
        if any(kw in text_lower for kw in enthusiastic_keywords):
            return "enthusiastic"

        # Happy indicators (client satisfied/ready to close) - Priority 5
        happy_keywords = [
            "faz sentido", "gostei", "otimo", "excelente", "muito bom",
            "concordo", "voce tem razao", "fechado", "vamos la",
            "me convenceu", "pode mandar", "estou convencido", "bom",
            "legal", "bacana", "isso ai"
        ]
        if any(kw in text_lower for kw in happy_keywords):
            return "happy"

        # Curious indicators (client seeking info) - Priority 6
        curious_keywords = [
            "como funciona", "me explica", "quero saber mais", "e se",
            "por que", "qual a diferenca", "como seria", "poderia detalhar",
            "interessante, mas", "quero entender", "fale mais sobre",
            "como voces fazem", "qual o processo"
        ]
        if any(kw in text_lower for kw in curious_keywords):
            return "curious"

        # Receptive indicators (client engaged/listening) - Priority 7
        receptive_keywords = [
            "entendo", "continue", "me conte mais", "como assim", "explique",
            "ok", "certo", "ah sim", "uhum", "interessante", "e dai",
            "pode falar", "estou ouvindo", "fale mais", "sim", "ta"
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

    async def analyze_streaming(
        self,
        partial_text: str,
        full_history: list[str] | None = None,
    ) -> EmotionResult:
        """
        Analyze emotion from partial transcript (streaming mode).
        Uses lighter prompt for faster response (~50-100ms).
        Returns lower confidence for partial results.
        """
        if not partial_text or len(partial_text) < 10:
            return EmotionResult(
                state="neutral",
                intensity=50,
                trend="stable",
                reason=None
            )

        # Use keyword analysis for ultra-fast streaming (no API call)
        # AI analysis is reserved for final transcripts to save latency
        state = self._analyze_with_keywords(partial_text)

        # Calculate intensity with reduced confidence
        base = EMOTION_BASE_INTENSITY[state]
        intensity = base  # No adjustment for streaming

        # Don't update history for partial results
        trend = self._calculate_trend() if self._intensity_history else "stable"

        return EmotionResult(
            state=state,
            intensity=intensity,
            trend=trend,
            reason=None  # No reason for streaming results
        )


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


async def analyze_emotion_streaming(
    partial_text: str,
    conversation_history: list[str] | None = None,
) -> EmotionResult:
    """
    Analyze emotion from partial transcript (streaming mode).
    Fast keyword-based analysis for real-time feedback.

    Args:
        partial_text: The partial transcript text
        conversation_history: Recent conversation for context

    Returns:
        EmotionResult with state, intensity, and trend (lower confidence)
    """
    analyzer = get_emotion_analyzer()
    return await analyzer.analyze_streaming(partial_text, conversation_history)
