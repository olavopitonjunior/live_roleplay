# PRD 04: Real-time Coaching

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Planejado |
| **Fase** | 3 - Real-time Coaching |
| **Prioridade** | P2 (Media) |
| **Dependencias** | PRD-01 (metricas), PRD-02 (emocoes) |
| **Estimativa** | 6-8 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
Atualmente, o feedback do Live Roleplay vem **apenas apos a sessao**. O usuario so descobre que estava falando demais ou ignorando objecoes quando ja terminou. Isso reduz significativamente o valor de aprendizado.

### Oportunidade
Estudos mostram que feedback imediato acelera aprendizado em 2-3x comparado com feedback atrasado. Plataformas como Gong e Clari estao investindo pesado em "real-time guidance" como diferencial.

### Hipotese
> "Vendedores que recebem coaching em tempo real durante o roleplay melhoram seu score 40% mais rapido que os que recebem apenas feedback pos-sessao."

---

## 2. Objetivos (OKRs)

### Objetivo
Fornecer orientacao contextual durante a sessao de roleplay para maximizar aprendizado em cada interacao.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | Reduzir tempo ate proficiencia em 30% | Mes 2 |
| KR2 | Melhoria de score D7 de +15% para +25% | Mes 2 |
| KR3 | 70% dos usuarios interagem com hints | Mes 1 |
| KR4 | NPS de "utilidade do coaching" > 4.2/5 | Mes 2 |

---

## 3. User Stories

### US-01: Receber Dica Contextual
**Como** vendedor em treinamento
**Quero** receber dicas relevantes durante a conversa
**Para** melhorar minha abordagem em tempo real

**Criterios de Aceite**:
- [ ] Dica aparece como overlay discreto
- [ ] Dica e contextual ao momento da conversa
- [ ] Nao interrompe fluxo da conversa
- [ ] Desaparece automaticamente apos 5s

### US-02: Receber Alerta de Comportamento
**Como** vendedor em treinamento
**Quero** ser alertado quando estou cometendo um erro
**Para** corrigir imediatamente

**Criterios de Aceite**:
- [ ] Alerta quando talk ratio > 70%
- [ ] Alerta quando objecao ignorada > 30s
- [ ] Alerta quando muitas hesitacoes
- [ ] Alerta e visual e sutil (nao intrusivo)

### US-03: Pausar para Refletir
**Como** vendedor em treinamento
**Quero** poder pausar a sessao e receber orientacao
**Para** pensar antes de responder em momentos dificeis

**Criterios de Aceite**:
- [ ] Botao de pausa visivel durante sessao
- [ ] Ao pausar, mostra contexto e sugestao
- [ ] Opcao de ouvir resposta sugerida
- [ ] Retomar sessao continua do mesmo ponto

### US-04: Seguir Metodologia
**Como** vendedor em treinamento
**Quero** ver um checklist da metodologia de vendas
**Para** garantir que estou seguindo o processo

**Criterios de Aceite**:
- [ ] Checklist lateral com etapas (SPIN, MEDDIC)
- [ ] Marca automaticamente etapas completadas
- [ ] Destaca proxima etapa sugerida
- [ ] Configuravel por cenario

### US-05: Verificar Compliance
**Como** gestor de vendas
**Quero** que vendedores sigam scripts obrigatorios
**Para** garantir compliance regulatorio

**Criterios de Aceite**:
- [ ] Definir frases obrigatorias por cenario
- [ ] Indicador visual de compliance durante sessao
- [ ] Alerta se frase obrigatoria nao foi dita
- [ ] Relatorio de compliance no feedback

### US-06: Configurar Regras de Coaching
**Como** gestor de vendas
**Quero** definir regras de coaching por cenario
**Para** personalizar treinamento da equipe

**Criterios de Aceite**:
- [ ] Interface para criar regras
- [ ] Regras baseadas em triggers (tempo, palavras, metricas)
- [ ] Testar regra antes de publicar
- [ ] Ativar/desativar regras

---

## 4. Requisitos Funcionais

### RF-01: Sistema de Hints

#### Tipos de Hints

| Tipo | Trigger | Exemplo |
|------|---------|---------|
| `encouragement` | Acao positiva detectada | "Otimo! Voce reconheceu a preocupacao do cliente." |
| `warning` | Comportamento negativo | "Atencao: voce esta falando muito. Deixe o cliente falar." |
| `suggestion` | Oportunidade detectada | "Bom momento para perguntar sobre orcamento." |
| `reminder` | Tempo/evento | "Objecao de preco ainda pendente ha 30s." |
| `compliance` | Frase obrigatoria | "Lembre-se de mencionar os termos de garantia." |

#### Logica de Hints

```python
class CoachingEngine:
    def __init__(self, scenario: dict, rules: list[CoachingRule]):
        self.scenario = scenario
        self.rules = rules
        self.hints_shown = []
        self.cooldown_ms = 15000  # 15s entre hints do mesmo tipo

    async def evaluate(self, context: SessionContext) -> Hint | None:
        """Avalia contexto e retorna hint se aplicavel"""

        for rule in self.rules:
            if self._should_trigger(rule, context):
                if self._is_on_cooldown(rule.type):
                    continue

                hint = Hint(
                    type=rule.type,
                    message=rule.message,
                    priority=rule.priority,
                    duration_ms=rule.duration_ms or 5000
                )

                self.hints_shown.append({
                    "hint": hint,
                    "timestamp": context.current_time_ms,
                    "rule_id": rule.id
                })

                return hint

        return None

    def _should_trigger(self, rule: CoachingRule, context: SessionContext) -> bool:
        """Verifica se regra deve disparar"""

        if rule.trigger_type == "talk_ratio":
            return context.metrics.talk_ratio.ratio > rule.threshold

        if rule.trigger_type == "objection_pending":
            if context.pending_objection:
                elapsed = context.current_time_ms - context.pending_objection.timestamp
                return elapsed > rule.threshold_ms

        if rule.trigger_type == "hesitation_count":
            return context.metrics.hesitation_count >= rule.threshold

        if rule.trigger_type == "compliance_missing":
            return not self._compliance_phrase_said(rule.phrase, context.transcript)

        if rule.trigger_type == "methodology_step":
            return self._should_prompt_step(rule.step, context)

        return False
```

### RF-02: Coaching Overlay

```typescript
// components/session/CoachingOverlay.tsx
interface CoachingOverlayProps {
  hint: Hint | null;
  onDismiss: () => void;
  position: 'top' | 'bottom';
}

interface Hint {
  type: 'encouragement' | 'warning' | 'suggestion' | 'reminder' | 'compliance';
  message: string;
  priority: 'low' | 'medium' | 'high';
  duration_ms: number;
}

// Posicao: parte inferior da tela, acima dos controles
// Animacao: slide up + fade in
// Auto-dismiss apos duration_ms
// Click para dismiss imediato
```

### RF-03: Pause & Reflect

```typescript
// Fluxo de pausa
interface PauseState {
  isPaused: boolean;
  pausedAt: number;
  context: {
    lastUserSpeech: string;
    lastAvatarSpeech: string;
    pendingObjection?: Objection;
    currentEmotion: AvatarEmotion;
  };
  suggestion: {
    text: string;
    audioUrl?: string;  // TTS da sugestao
  };
}

// Ao pausar:
// 1. Audio do avatar para
// 2. Timer congela
// 3. Modal abre com contexto
// 4. Mostra sugestao de resposta
// 5. Opcao de ouvir sugestao em audio
// 6. Botao "Continuar" retoma sessao
```

### RF-04: Methodology Tracker

```typescript
// Metodologias suportadas inicialmente
type Methodology = 'SPIN' | 'MEDDIC' | 'BANT' | 'Challenger' | 'custom';

interface MethodologyStep {
  id: string;
  name: string;
  description: string;
  keywords: string[];  // Para deteccao automatica
  required: boolean;
  order: number;
}

// SPIN Selling
const SPIN_STEPS: MethodologyStep[] = [
  { id: 'situation', name: 'Situacao', description: 'Entender contexto atual', keywords: ['atualmente', 'hoje', 'como funciona'], required: true, order: 1 },
  { id: 'problem', name: 'Problema', description: 'Identificar dores', keywords: ['dificuldade', 'desafio', 'problema'], required: true, order: 2 },
  { id: 'implication', name: 'Implicacao', description: 'Explorar consequencias', keywords: ['impacto', 'consequencia', 'afeta'], required: true, order: 3 },
  { id: 'need_payoff', name: 'Necessidade', description: 'Mostrar valor da solucao', keywords: ['beneficio', 'solucao', 'resolver'], required: true, order: 4 }
];

// MEDDIC
const MEDDIC_STEPS: MethodologyStep[] = [
  { id: 'metrics', name: 'Metrics', description: 'Metricas de sucesso', keywords: ['meta', 'kpi', 'resultado'], required: true, order: 1 },
  { id: 'economic_buyer', name: 'Economic Buyer', description: 'Decisor economico', keywords: ['decide', 'aprova', 'orcamento'], required: true, order: 2 },
  { id: 'decision_criteria', name: 'Decision Criteria', description: 'Criterios de decisao', keywords: ['criterio', 'importante', 'requisito'], required: true, order: 3 },
  { id: 'decision_process', name: 'Decision Process', description: 'Processo de decisao', keywords: ['processo', 'etapa', 'timeline'], required: true, order: 4 },
  { id: 'identify_pain', name: 'Identify Pain', description: 'Dor principal', keywords: ['problema', 'dor', 'frustracao'], required: true, order: 5 },
  { id: 'champion', name: 'Champion', description: 'Defensor interno', keywords: ['defensor', 'apoio', 'aliado'], required: false, order: 6 }
];
```

### RF-05: Compliance Checker

```typescript
interface ComplianceRule {
  id: string;
  phrase: string;           // Frase ou keywords obrigatorias
  matchType: 'exact' | 'contains' | 'semantic';
  mustSayBefore: number;    // Timestamp maximo (ms) ou -1 para fim
  warningAt: number;        // Quando alertar se ainda nao disse
  severity: 'warning' | 'critical';
}

// Exemplo para cenario de seguro
const insuranceCompliance: ComplianceRule[] = [
  {
    id: 'disclosure',
    phrase: 'Este produto pode nao ser adequado para todos os perfis',
    matchType: 'semantic',
    mustSayBefore: -1,  // Antes de encerrar
    warningAt: 120000,  // Avisar aos 2 min
    severity: 'critical'
  },
  {
    id: 'cooling_off',
    phrase: 'prazo de arrependimento de 7 dias',
    matchType: 'contains',
    mustSayBefore: -1,
    warningAt: 150000,
    severity: 'warning'
  }
];
```

### RF-06: Configuracao de Regras

```sql
-- Tabela de regras de coaching
CREATE TABLE coaching_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID REFERENCES scenarios(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL,
    hint_type VARCHAR(50) NOT NULL,
    hint_message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemplos de trigger_config
-- Talk ratio: {"threshold": 0.7}
-- Objection pending: {"threshold_ms": 30000}
-- Compliance: {"phrase": "...", "match_type": "semantic"}
-- Methodology: {"step_id": "situation", "methodology": "SPIN"}
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Latencia
- Avaliacao de regras em <100ms
- Hint aparece em <500ms apos trigger
- Pausa responde em <200ms

### RNF-02: Nao-Intrusivo
- Hints nao devem bloquear interacao
- Maximo 1 hint visivel por vez
- Cooldown minimo entre hints: 15s
- Usuario pode desativar hints

### RNF-03: Precisao
- Deteccao de metodologia com accuracy > 70%
- Compliance check com recall > 90%
- Falsos positivos < 10%

---

## 6. Especificacao Tecnica

### 6.1 Arquitetura

```
+------------------+     +------------------+     +------------------+
|    Frontend      |     |      Agent       |     |    Supabase      |
|                  |     |                  |     |                  |
| CoachingOverlay  |<--->| CoachingEngine   |<--->| coaching_rules   |
| MethodologyPanel |     | evaluate()       |     | scenarios        |
| PauseModal       |     | check_compliance |     |                  |
+------------------+     +------------------+     +------------------+
        ^                        |
        |                        v
        +---- Data Channel ------+
             (hints em real-time)
```

### 6.2 Modulo coaching.py

```python
# agent/coaching.py
from dataclasses import dataclass
from typing import Optional
import re

@dataclass
class Hint:
    type: str
    message: str
    priority: str
    duration_ms: int
    rule_id: str

@dataclass
class CoachingRule:
    id: str
    trigger_type: str
    trigger_config: dict
    hint_type: str
    hint_message: str
    priority: str

class CoachingEngine:
    def __init__(self, rules: list[CoachingRule]):
        self.rules = rules
        self.hint_history = []
        self.cooldowns = {}  # type -> last_shown_ms

    async def evaluate(self, context: dict) -> Optional[Hint]:
        """Avalia regras e retorna hint se aplicavel"""
        current_time = context.get('current_time_ms', 0)

        for rule in sorted(self.rules, key=lambda r: r.priority, reverse=True):
            # Check cooldown
            last_shown = self.cooldowns.get(rule.hint_type, 0)
            if current_time - last_shown < 15000:  # 15s cooldown
                continue

            # Evaluate trigger
            if self._evaluate_trigger(rule, context):
                hint = Hint(
                    type=rule.hint_type,
                    message=self._format_message(rule.hint_message, context),
                    priority=rule.priority,
                    duration_ms=5000,
                    rule_id=rule.id
                )
                self.cooldowns[rule.hint_type] = current_time
                self.hint_history.append({
                    'hint': hint,
                    'timestamp': current_time
                })
                return hint

        return None

    def _evaluate_trigger(self, rule: CoachingRule, context: dict) -> bool:
        trigger = rule.trigger_type
        config = rule.trigger_config

        if trigger == 'talk_ratio_high':
            ratio = context.get('talk_ratio', 0)
            return ratio > config.get('threshold', 0.7)

        if trigger == 'objection_pending':
            pending = context.get('pending_objection')
            if pending:
                elapsed = context['current_time_ms'] - pending['timestamp_ms']
                return elapsed > config.get('threshold_ms', 30000)

        if trigger == 'hesitation_detected':
            count = context.get('hesitation_count', 0)
            return count >= config.get('threshold', 3)

        if trigger == 'compliance_missing':
            transcript = context.get('transcript', '')
            phrase = config.get('phrase', '')
            return not self._phrase_in_transcript(phrase, transcript, config.get('match_type', 'contains'))

        if trigger == 'methodology_step_missing':
            completed_steps = context.get('methodology_steps_completed', [])
            required_step = config.get('step_id')
            time_threshold = config.get('time_threshold_ms', 60000)
            return (required_step not in completed_steps and
                    context['current_time_ms'] > time_threshold)

        return False

    def _phrase_in_transcript(self, phrase: str, transcript: str, match_type: str) -> bool:
        transcript_lower = transcript.lower()
        phrase_lower = phrase.lower()

        if match_type == 'exact':
            return phrase_lower in transcript_lower

        if match_type == 'contains':
            words = phrase_lower.split()
            return all(word in transcript_lower for word in words)

        if match_type == 'semantic':
            # Simplificado: verifica palavras-chave
            keywords = phrase_lower.split()
            matches = sum(1 for kw in keywords if kw in transcript_lower)
            return matches >= len(keywords) * 0.6

        return False

    def _format_message(self, template: str, context: dict) -> str:
        """Substitui placeholders no template"""
        message = template
        if '{objection}' in message and context.get('pending_objection'):
            message = message.replace('{objection}', context['pending_objection']['text'][:50])
        if '{time}' in message:
            time_sec = context['current_time_ms'] // 1000
            message = message.replace('{time}', f"{time_sec}s")
        return message
```

### 6.3 Integracao no Agent Principal

```python
# agent/main.py - adicoes

from coaching import CoachingEngine, CoachingRule

class RoleplayAgent:
    def __init__(self, ...):
        # ... inicializacao existente ...
        self.coaching_engine = None

    async def setup_coaching(self, scenario_id: str):
        """Carrega regras de coaching do cenario"""
        rules_data = await self.fetch_coaching_rules(scenario_id)
        rules = [CoachingRule(**r) for r in rules_data]
        self.coaching_engine = CoachingEngine(rules)

    async def on_user_speech_end(self, text: str, duration_ms: int):
        # ... logica existente ...

        # Avaliar coaching
        if self.coaching_engine:
            context = self._build_coaching_context()
            hint = await self.coaching_engine.evaluate(context)

            if hint:
                await self.send_data_channel({
                    'type': 'coaching_hint',
                    'hint': {
                        'type': hint.type,
                        'message': hint.message,
                        'priority': hint.priority,
                        'duration_ms': hint.duration_ms
                    }
                })

    def _build_coaching_context(self) -> dict:
        return {
            'current_time_ms': self.session_elapsed_ms,
            'talk_ratio': self.metrics.talk_ratio.ratio,
            'pending_objection': self.pending_objection,
            'hesitation_count': self.metrics.response_latency.hesitation_count,
            'transcript': self.full_transcript,
            'methodology_steps_completed': self.completed_methodology_steps,
            'avatar_emotion': self.current_avatar_emotion
        }
```

### 6.4 Componentes Frontend

```typescript
// components/session/CoachingOverlay.tsx
import { motion, AnimatePresence } from 'framer-motion';

interface CoachingOverlayProps {
  hint: Hint | null;
  onDismiss: () => void;
}

const hintStyles = {
  encouragement: { bg: 'bg-green-100', border: 'border-green-500', icon: '👍' },
  warning: { bg: 'bg-yellow-100', border: 'border-yellow-500', icon: '⚠️' },
  suggestion: { bg: 'bg-blue-100', border: 'border-blue-500', icon: '💡' },
  reminder: { bg: 'bg-purple-100', border: 'border-purple-500', icon: '🔔' },
  compliance: { bg: 'bg-red-100', border: 'border-red-500', icon: '📋' }
};

export function CoachingOverlay({ hint, onDismiss }: CoachingOverlayProps) {
  useEffect(() => {
    if (hint) {
      const timer = setTimeout(onDismiss, hint.duration_ms);
      return () => clearTimeout(timer);
    }
  }, [hint, onDismiss]);

  return (
    <AnimatePresence>
      {hint && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className={`fixed bottom-24 left-1/2 transform -translate-x-1/2
                      px-4 py-3 rounded-lg shadow-lg border-l-4 max-w-md
                      ${hintStyles[hint.type].bg} ${hintStyles[hint.type].border}`}
          onClick={onDismiss}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl">{hintStyles[hint.type].icon}</span>
            <p className="text-sm text-gray-800">{hint.message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

```typescript
// components/session/MethodologyPanel.tsx
interface MethodologyPanelProps {
  methodology: Methodology;
  completedSteps: string[];
  currentStep?: string;
}

export function MethodologyPanel({ methodology, completedSteps, currentStep }: MethodologyPanelProps) {
  const steps = METHODOLOGY_CONFIGS[methodology];

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <h3 className="font-semibold text-sm mb-3">{methodology}</h3>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-2 text-sm
              ${completedSteps.includes(step.id) ? 'text-green-600' : ''}
              ${currentStep === step.id ? 'font-semibold bg-blue-50 -mx-2 px-2 py-1 rounded' : ''}`}
          >
            {completedSteps.includes(step.id) ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <CircleIcon className="w-4 h-4 text-gray-300" />
            )}
            {step.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```typescript
// components/session/PauseModal.tsx
interface PauseModalProps {
  isOpen: boolean;
  context: PauseContext;
  onResume: () => void;
}

export function PauseModal({ isOpen, context, onResume }: PauseModalProps) {
  const [isPlayingSuggestion, setIsPlayingSuggestion] = useState(false);

  return (
    <Modal isOpen={isOpen} onClose={onResume}>
      <div className="p-6 max-w-lg">
        <h2 className="text-xl font-bold mb-4">Momento de Reflexao</h2>

        <div className="mb-4">
          <h3 className="font-semibold text-sm text-gray-500 mb-1">Cliente disse:</h3>
          <p className="bg-gray-100 p-3 rounded italic">"{context.lastAvatarSpeech}"</p>
        </div>

        {context.pendingObjection && (
          <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <p className="text-sm font-semibold">Objecao pendente:</p>
            <p className="text-sm">{context.pendingObjection.description}</p>
          </div>
        )}

        <div className="mb-6">
          <h3 className="font-semibold text-sm text-gray-500 mb-1">Sugestao de resposta:</h3>
          <p className="bg-blue-50 p-3 rounded">{context.suggestion.text}</p>

          {context.suggestion.audioUrl && (
            <button
              onClick={() => playAudio(context.suggestion.audioUrl)}
              className="mt-2 text-sm text-blue-600 flex items-center gap-1"
            >
              <PlayIcon className="w-4 h-4" />
              Ouvir sugestao
            </button>
          )}
        </div>

        <button
          onClick={onResume}
          className="w-full bg-black text-white py-3 rounded-lg font-semibold"
        >
          Continuar Sessao
        </button>
      </div>
    </Modal>
  );
}
```

---

## 7. UI/UX

### Wireframe: Sessao com Coaching

```
+------------------------------------------------------------------+
|                                                                   |
|                                                                   |
|                    [AVATAR VIDEO]                                 |
|                                                                   |
|                                                                   |
|  +----------------+                          +------------------+ |
|  | SPIN Selling   |                          |  Cliente: 😊     | |
|  | [x] Situacao   |                          |  Receptivo       | |
|  | [x] Problema   |                          +------------------+ |
|  | [ ] Implicacao |                                              |
|  | [ ] Necessidade|                                              |
|  +----------------+                                              |
|                                                                   |
|  +--------------------------------------------------------------+|
|  | 💡 Bom momento para explorar as consequencias do problema.   ||
|  +--------------------------------------------------------------+|
|                                                                   |
+------------------------------------------------------------------+
|  [🎤 Mic]    [⏸️ Pausar]    [🛑 Encerrar]           02:15 / 03:00 |
+------------------------------------------------------------------+
```

### Wireframe: Modal de Pausa

```
+------------------------------------------+
|                                          |
|       MOMENTO DE REFLEXAO      [X]       |
|                                          |
|  Cliente disse:                          |
|  +------------------------------------+  |
|  | "Nao sei se isso cabe no meu       |  |
|  |  orcamento atual..."               |  |
|  +------------------------------------+  |
|                                          |
|  ⚠️ Objecao pendente:                    |
|  +------------------------------------+  |
|  | Preocupacao com preco/orcamento    |  |
|  +------------------------------------+  |
|                                          |
|  Sugestao de resposta:                   |
|  +------------------------------------+  |
|  | "Entendo sua preocupacao com o     |  |
|  |  investimento. Muitos clientes     |  |
|  |  tinham essa mesma duvida. Posso   |  |
|  |  perguntar: qual seria o impacto   |  |
|  |  financeiro de NAO resolver esse   |  |
|  |  problema?"                        |  |
|  +------------------------------------+  |
|                                          |
|  [▶️ Ouvir sugestao]                      |
|                                          |
|  [      CONTINUAR SESSAO      ]          |
|                                          |
+------------------------------------------+
```

---

## 8. Metricas de Sucesso

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Tempo ate proficiencia | 10 sessoes | 7 sessoes | Sessoes ate score > 80 consistente |
| Melhoria D7 | +15% | +25% | Cohort analysis |
| Interacao com hints | N/A | 70% | % hints nao dismissados < 2s |
| Uso do pause | N/A | 30% | % sessoes com pelo menos 1 pause |
| NPS coaching | N/A | 4.2/5 | Survey pos-sessao |
| Compliance rate | N/A | 95% | % sessoes com todas frases obrigatorias |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Hints muito intrusivos | Alta | Alto | Opcao de desativar, cooldown longo |
| Falsos positivos frequentes | Media | Alto | ML para melhorar deteccao |
| Latencia perceptivel | Media | Medio | Processar localmente quando possivel |
| Usuarios ignoram hints | Media | Medio | Gamificar (badge por seguir hints) |
| Compliance muito rigido | Baixa | Medio | Permitir match semantico |

---

## 10. Criterios de Aceite (DoD)

- [ ] CoachingEngine implementado com 5 tipos de trigger
- [ ] Regras configuraveis por cenario
- [ ] CoachingOverlay com animacoes
- [ ] MethodologyPanel com SPIN e MEDDIC
- [ ] PauseModal funcional com sugestoes
- [ ] Compliance checker com 3 tipos de match
- [ ] Cooldown entre hints funcionando
- [ ] Opcao de desativar coaching
- [ ] Testes unitarios para CoachingEngine
- [ ] Testes E2E para fluxo completo
- [ ] Analytics de interacao com hints

---

## 11. Plano de Rollout

### Semana 1-2
- CoachingEngine basico (talk ratio, objection pending)
- CoachingOverlay no frontend
- Integracao com agent

### Semana 3-4
- MethodologyPanel (SPIN, MEDDIC)
- Deteccao automatica de steps
- Regras configuraveis no banco

### Semana 5-6
- PauseModal com sugestoes
- Compliance checker
- Admin UI para criar regras

### Semana 7-8
- Testes E2E
- Beta com 10% usuarios
- Ajustes baseado em feedback
- Rollout gradual

---

## 12. Apendice

### A. Metodologias de Venda Suportadas

**SPIN Selling** (Neil Rackham)
- Situation: Entender contexto atual
- Problem: Identificar problemas/dores
- Implication: Explorar consequencias
- Need-payoff: Mostrar valor da solucao

**MEDDIC** (Jack Napoli)
- Metrics: Metricas de sucesso quantificaveis
- Economic Buyer: Quem aprova orcamento
- Decision Criteria: O que importa na decisao
- Decision Process: Como decidem
- Identify Pain: Dor principal
- Champion: Defensor interno

**BANT** (IBM)
- Budget: Tem orcamento?
- Authority: E o decisor?
- Need: Tem necessidade real?
- Timeline: Quando pretende resolver?

### B. Exemplos de Regras de Coaching

```json
[
  {
    "name": "Talk Ratio Alto",
    "trigger_type": "talk_ratio_high",
    "trigger_config": {"threshold": 0.7},
    "hint_type": "warning",
    "hint_message": "Voce esta falando muito. Faca uma pergunta aberta para ouvir o cliente."
  },
  {
    "name": "Objecao Pendente",
    "trigger_type": "objection_pending",
    "trigger_config": {"threshold_ms": 30000},
    "hint_type": "reminder",
    "hint_message": "O cliente mencionou \"{objection}\". Voce ainda nao abordou isso."
  },
  {
    "name": "Compliance Disclosure",
    "trigger_type": "compliance_missing",
    "trigger_config": {"phrase": "produto pode nao ser adequado", "match_type": "semantic"},
    "hint_type": "compliance",
    "hint_message": "Lembre-se de mencionar que o produto pode nao ser adequado para todos os perfis."
  }
]
```

### C. Referencias

- [Gong Real-time Guidance](https://www.gong.io/real-time-guidance/)
- [Outreach Kaia](https://www.outreach.io/product/kaia)
- [SPIN Selling Book](https://www.amazon.com/SPIN-Selling-Neil-Rackham/dp/0070511136)
- [MEDDIC Sales Methodology](https://meddicc.com/)
