import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui';
import { supabase } from '../../lib/supabase';
import type {
  Scenario, AiVoice, GeneratedScenario,
  AvatarProvider, SuggestedScenarioFields, ScenarioFormData,
  GenerateScenarioRequest, CharacterGender,
} from '../../types';

// --- Constants ---

const AI_VOICES: { value: AiVoice; label: string; description: string }[] = [
  { value: 'echo', label: 'Echo', description: 'Masculina, amigavel (padrao)' },
  { value: 'ash', label: 'Ash', description: 'Masculina, grave e seria' },
  { value: 'shimmer', label: 'Shimmer', description: 'Feminina, suave' },
  { value: 'sage', label: 'Sage', description: 'Masculina, assertiva' },
  { value: 'coral', label: 'Coral', description: 'Feminina, expressiva' },
];

const AVATAR_PROVIDERS: { value: AvatarProvider; label: string; description: string }[] = [
  { value: 'none', label: 'Nenhum', description: 'Somente audio (avatar suspenso)' },
  { value: 'hedra', label: 'Hedra', description: 'Avatar com lip-sync (suspenso)' },
  { value: 'simli', label: 'Simli', description: 'Avatar legacy' },
  { value: 'liveavatar', label: 'HeyGen (LiveAvatar)', description: 'Avatar legacy' },
];

const INDUSTRIES = [
  { value: '', label: 'Qualquer industria' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'tecnologia', label: 'Tecnologia / SaaS' },
  { value: 'imobiliario', label: 'Imobiliario' },
  { value: 'financeiro', label: 'Servicos Financeiros' },
  { value: 'varejo', label: 'Varejo' },
  { value: 'saude', label: 'Saude' },
  { value: 'educacao', label: 'Educacao' },
  { value: 'consultoria', label: 'Consultoria' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Facil', description: 'Cliente receptivo, objecoes simples' },
  { value: 'medium', label: 'Medio', description: 'Cliente neutro, objecoes realistas' },
  { value: 'hard', label: 'Dificil', description: 'Cliente resistente, objecoes complexas' },
];

const SESSION_TYPES = [
  { value: 'cold_call', label: 'Cold Call', description: 'Avatar NAO espera a ligacao' },
  { value: 'apresentacao', label: 'Apresentacao', description: 'Reuniao agendada' },
  { value: 'negociacao', label: 'Negociacao', description: 'Negociacao ativa' },
  { value: 'retencao', label: 'Retencao', description: 'Cliente quer cancelar' },
  { value: 'entrevista', label: 'Entrevista', description: 'Candidato sendo avaliado' },
  { value: 'discovery', label: 'Discovery', description: 'Reuniao exploratoria' },
];

const GENDERS: { value: CharacterGender; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
];

const FEMALE_VOICES: AiVoice[] = ['shimmer', 'coral'];
const MALE_VOICES: AiVoice[] = ['echo', 'ash', 'sage'];

function getVoicesForGender(gender: CharacterGender): typeof AI_VOICES {
  const allowed = gender === 'female' ? FEMALE_VOICES : MALE_VOICES;
  return AI_VOICES.filter(v => allowed.includes(v.value));
}

function getDefaultVoiceForGender(gender: CharacterGender): AiVoice {
  return gender === 'female' ? 'shimmer' : 'echo';
}

const DURATION_OPTIONS = [
  { value: 60, label: '1 minuto' },
  { value: 120, label: '2 minutos' },
  { value: 180, label: '3 minutos (padrao)' },
  { value: 240, label: '4 minutos' },
  { value: 300, label: '5 minutos' },
];

const emptyFormData: ScenarioFormData = {
  title: '',
  category: '',
  context: '',
  avatar_profile: '',
  objections: [{ id: 'obj_1', description: '' }],
  evaluation_criteria: [{ id: 'crit_1', description: '' }],
  ideal_outcome: '',
  simli_face_id: '',
  ai_voice: 'echo',
  avatar_provider: 'none',
  avatar_id: '',
  is_active: true,
  target_duration_seconds: 180,
  character_gender: 'male',
  character_name: '',
  character_role: '',
  personality: '',
  user_objective: '',
  opening_line: '',
  session_type: null,
};

// --- Sub-components ---

type FieldType = 'avatar_profile' | 'objections' | 'evaluation_criteria' | 'ideal_outcome';

function AIFieldButton({ disabled, isLoading, onClick, tooltip }: {
  disabled: boolean; isLoading: boolean; onClick: () => void; tooltip: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled || isLoading} title={tooltip}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all ${
        disabled || isLoading ? 'text-gray-300 cursor-not-allowed' : 'text-purple-500 hover:text-purple-600 hover:bg-purple-50'
      }`}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      )}
    </button>
  );
}

function StepIndicator({ current, maxReached }: { current: 1 | 2 | 3; maxReached: number }) {
  const steps = [
    { num: 1, label: 'Descrever' },
    { num: 2, label: 'Revisar' },
    { num: 3, label: 'Editar' },
  ] as const;

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            s.num === current
              ? 'bg-black text-white'
              : s.num <= maxReached
                ? 'bg-gray-200 text-gray-700'
                : 'bg-gray-100 text-gray-400'
          }`}>
            <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs bg-white/20">
              {s.num <= maxReached && s.num < current ? '✓' : s.num}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 ${s.num < current ? 'bg-black' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Prompt Preview ---

const SESSION_TYPE_BEHAVIORS: Record<string, string> = {
  cold_call: 'COLD CALL: NAO espera a ligacao, surpresa/desconfianca',
  apresentacao: 'APRESENTACAO: Reuniao agendada, receptivo mas exigente',
  negociacao: 'NEGOCIACAO: Defende posicao, exige contrapartidas',
  retencao: 'RETENCAO: Cliente insatisfeito querendo cancelar',
  entrevista: 'ENTREVISTA: Candidato sendo avaliado',
  discovery: 'DISCOVERY: Reuniao exploratoria, cetico',
};

function buildRolePreview(fd: ScenarioFormData): string {
  const name = fd.character_name || '[sem nome]';
  const role = fd.character_role || '[sem papel definido]';
  return `Voce e ${name}, ${role}.\nO USUARIO e quem esta vendendo/oferecendo suporte para VOCE.\n\n[+ 12 regras anti-inversao de papel]`;
}

function buildPersonalityPreview(fd: ScenarioFormData): string {
  const parts: string[] = [];
  if (fd.personality) parts.push(`Personalidade: ${fd.personality}`);
  else parts.push('[Personalidade nao definida — usando avatar_profile como fallback]');
  if (fd.communication_style) {
    const cs = fd.communication_style;
    const styleParts: string[] = [];
    if (cs.formality) styleParts.push(`formalidade ${cs.formality}`);
    if (cs.verbosity) styleParts.push(`verbosidade ${cs.verbosity}`);
    if (styleParts.length) parts.push(`Estilo: ${styleParts.join(', ')}`);
  }
  if (fd.typical_phrases?.length) {
    parts.push(`Frases tipicas: ${fd.typical_phrases.map(p => `"${p}"`).join(', ')}`);
  }
  if (fd.initial_emotion) parts.push(`Emocao inicial: ${fd.initial_emotion}`);
  if (fd.avatar_profile) parts.push(`\nPerfil: ${fd.avatar_profile.substring(0, 120)}...`);
  return parts.join('\n') || '[Nenhum campo de personalidade definido]';
}

function buildContextPreview(fd: ScenarioFormData): string {
  const parts: string[] = [];
  if (fd.character_name) parts.push(`LEMBRETE: Voce e ${fd.character_name}.`);
  parts.push(fd.context || '[Contexto vazio]');
  if (fd.session_type && SESSION_TYPE_BEHAVIORS[fd.session_type]) {
    parts.push(`\n[Comportamento: ${SESSION_TYPE_BEHAVIORS[fd.session_type]}]`);
  }
  if (fd.market_context) parts.push(`\nContexto de mercado: ${typeof fd.market_context === 'object' ? JSON.stringify(fd.market_context) : fd.market_context}`);
  if (fd.backstory) parts.push(`\nHistorico: ${fd.backstory}`);
  if (fd.user_objective) parts.push(`\nObjetivo do usuario: ${fd.user_objective}`);
  return parts.join('\n');
}

function buildInstructionsPreview(fd: ScenarioFormData): string {
  const parts: string[] = [];
  const objections = fd.objections.filter(o => o.description.trim());
  parts.push('Objecoes:');
  if (objections.length > 0) {
    objections.forEach(o => parts.push(`  - ${o.description}`));
  } else {
    parts.push('  [Nenhuma objecao configurada]');
  }
  if (fd.hidden_objective) parts.push(`\nObjetivo oculto: ${fd.hidden_objective}`);
  if (fd.knowledge_limits) parts.push(`\nLimites de conhecimento: ${typeof fd.knowledge_limits === 'object' ? JSON.stringify(fd.knowledge_limits) : fd.knowledge_limits}`);
  if (fd.opening_line) parts.push(`\nFrase de abertura: "${fd.opening_line}"`);
  return parts.join('\n');
}

function buildFlowPreview(fd: ScenarioFormData): string {
  const parts: string[] = [];
  const phases = fd.phase_flow?.phases;
  if (phases?.length) {
    parts.push('Fases da conversa:');
    phases.forEach((p, i) => {
      const dur = p.duration_pct ? ` (~${p.duration_pct}%)` : '';
      parts.push(`  ${i + 1}. ${p.name}${dur}${p.triggers?.length ? `: ${p.triggers.join(', ')}` : ''}`);
    });
  }
  const stages = fd.difficulty_escalation?.stages;
  if (stages?.length) {
    parts.push('\nEscalacao de dificuldade:');
    stages.forEach(s => {
      parts.push(`  - Quando: ${s.threshold} -> ${s.behavior_change}`);
    });
  }
  if (fd.success_condition) parts.push(`\nCondicao de sucesso: ${fd.success_condition}`);
  if (fd.end_condition) parts.push(`\nCondicao de encerramento: ${fd.end_condition}`);
  if (parts.length === 0) parts.push('[Nenhum fluxo estruturado — usando nivel de dificuldade padrao]');
  return parts.join('\n');
}

function buildSafetyPreview(fd: ScenarioFormData): string {
  const parts: string[] = [];
  parts.push('16 regras de seguranca ativas:');
  parts.push('  1-7.  Anti-inversao de papel');
  parts.push('  8.    Nao mencionar IA/sistema/prompt');
  parts.push('  9.    Portugues exclusivo');
  parts.push('  10-11. Interjeicoes + emocao variada');
  parts.push('  12.   Perguntas pessoais OK');
  parts.push('  13.   Linguagem profissional (sem palavroes)');
  parts.push('  14.   Nao se auto-responder');
  parts.push('  15.   Nao revelar info de sistema');
  parts.push('  16.   Respeitar duracao-alvo');
  parts.push('');
  if (fd.opening_line) {
    parts.push(`Abertura: "${fd.opening_line}"`);
  } else if (fd.session_type === 'cold_call') {
    parts.push('Abertura (padrao cold_call): "Alo? Quem fala?"');
  } else if (fd.session_type) {
    const defaults: Record<string, string> = {
      entrevista: 'Apresentacao breve como candidato',
      negociacao: 'Retomar contexto da negociacao',
      apresentacao: 'Cumprimentar e dizer que esperava a reuniao',
      discovery: 'Cumprimento neutro + proposito da reuniao',
      retencao: 'Dizer que quer cancelar/resolver problema',
    };
    parts.push(`Abertura (padrao ${fd.session_type}): ${defaults[fd.session_type] || 'Frase adequada ao contexto'}`);
  } else {
    parts.push('Abertura: [Frase generica de cumprimento]');
  }
  return parts.join('\n');
}

const PREVIEW_SECTIONS = [
  { id: 'role', title: 'PAPEL', build: buildRolePreview },
  { id: 'personality', title: 'PERSONALIDADE', build: buildPersonalityPreview },
  { id: 'context', title: 'CONTEXTO', build: buildContextPreview },
  { id: 'instructions', title: 'OBJECOES & FINAIS', build: buildInstructionsPreview },
  { id: 'flow', title: 'FLUXO & DIFICULDADE', build: buildFlowPreview },
  { id: 'safety', title: 'REGRAS & ABERTURA', build: buildSafetyPreview },
] as const;

function PromptPreviewPanel({ formData }: { formData: ScenarioFormData }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['role', 'safety']));

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        Visualizacao das 6 secoes do prompt que o avatar recebe. Campos vazios aparecem em destaque.
      </p>
      {PREVIEW_SECTIONS.map(section => {
        const content = section.build(formData);
        const isOpen = expanded.has(section.id);
        const hasEmpty = content.includes('[') && content.includes(']');
        return (
          <div key={section.id} className="rounded-lg overflow-hidden border border-gray-700">
            <button
              type="button"
              onClick={() => toggle(section.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                hasEmpty ? 'bg-amber-900/30 text-amber-300' : 'bg-gray-800 text-gray-300'
              }`}
            >
              <span>{section.title}{hasEmpty ? ' (campos vazios)' : ''}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <pre className="bg-gray-900 text-gray-100 font-mono text-xs p-3 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {content}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Main Component ---

interface ScenarioWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScenarioFormData) => Promise<void>;
  scenario?: Scenario | null;
  mode: 'create' | 'edit' | 'duplicate';
  accessCode?: string | null;
  generateScenario: (accessCode: string | null, request: GenerateScenarioRequest) => Promise<{
    data: GeneratedScenario | null;
    error: { message: string } | null;
  }>;
  isGenerating: boolean;
}

export function ScenarioWizard({
  isOpen, onClose, onSubmit, scenario, mode, accessCode, generateScenario, isGenerating,
}: ScenarioWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [maxReached, setMaxReached] = useState(1);
  const [formData, setFormData] = useState<ScenarioFormData>(emptyFormData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [generatingField, setGeneratingField] = useState<FieldType | null>(null);

  // Step 1 state
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Advanced mode toggle (Step 3)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize on open
  useEffect(() => {
    if (!isOpen) return;

    if (scenario && (mode === 'edit' || mode === 'duplicate')) {
      // Edit/duplicate: go straight to Step 3
      setFormData({
        title: mode === 'duplicate' ? `${scenario.title} (Copia)` : scenario.title,
        category: scenario.category || '',
        context: scenario.context,
        avatar_profile: scenario.avatar_profile,
        objections: scenario.objections.length > 0 ? scenario.objections : [{ id: 'obj_1', description: '' }],
        evaluation_criteria: scenario.evaluation_criteria.length > 0 ? scenario.evaluation_criteria : [{ id: 'crit_1', description: '' }],
        ideal_outcome: scenario.ideal_outcome || '',
        simli_face_id: scenario.simli_face_id || '',
        ai_voice: scenario.ai_voice || 'echo',
        avatar_provider: scenario.avatar_provider || 'none',
        avatar_id: scenario.avatar_id || '',
        is_active: scenario.is_active,
        target_duration_seconds: scenario.target_duration_seconds ?? 180,
        character_gender: scenario.character_gender || 'male',
        character_name: scenario.character_name || '',
        character_role: scenario.character_role || '',
        personality: scenario.personality || '',
        user_objective: scenario.user_objective || '',
        opening_line: scenario.opening_line || '',
        hidden_objective: scenario.hidden_objective,
        initial_emotion: scenario.initial_emotion,
        emotional_reactivity: scenario.emotional_reactivity,
        communication_style: scenario.communication_style,
        typical_phrases: scenario.typical_phrases,
        knowledge_limits: scenario.knowledge_limits,
        backstory: scenario.backstory,
        session_type: scenario.session_type,
        market_context: scenario.market_context,
        success_condition: scenario.success_condition,
        end_condition: scenario.end_condition,
        phase_flow: scenario.phase_flow,
        difficulty_escalation: scenario.difficulty_escalation,
        criteria_weights: scenario.criteria_weights,
        positive_indicators: scenario.positive_indicators,
        negative_indicators: scenario.negative_indicators,
      });
      setStep(3);
      setMaxReached(3);
    } else {
      // Create: start at Step 1
      setFormData(emptyFormData);
      setStep(1);
      setMaxReached(1);
    }

    setError(null);
    setDescription('');
    setIndustry('');
    setDifficulty('medium');
    setShowAdvanced(false);
  }, [isOpen, scenario, mode]);

  // --- Step 1 handlers ---

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Descreva o cenario que deseja criar');
      return;
    }
    setError(null);
    const result = await generateScenario(accessCode ?? null, {
      description: description.trim(),
      industry: industry || undefined,
      difficulty,
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      const gen = result.data;
      const genGender = gen.character_gender || 'male';
      const genVoice = gen.suggested_voice || getDefaultVoiceForGender(genGender);
      // Enforce voice-gender match
      const allowedVoices = genGender === 'female' ? FEMALE_VOICES : MALE_VOICES;
      const safeVoice = allowedVoices.includes(genVoice) ? genVoice : getDefaultVoiceForGender(genGender);
      setFormData({
        title: gen.title,
        category: gen.suggested_category || '',
        context: gen.context,
        avatar_profile: gen.avatar_profile,
        objections: gen.objections,
        evaluation_criteria: gen.evaluation_criteria,
        ideal_outcome: gen.ideal_outcome,
        simli_face_id: '',
        ai_voice: safeVoice,
        avatar_provider: 'none',
        avatar_id: '',
        is_active: true,
        target_duration_seconds: gen.target_duration_seconds ?? 180,
        character_gender: genGender,
        character_name: gen.character_name || '',
        character_role: gen.character_role || '',
        personality: gen.personality || '',
        user_objective: gen.user_objective || '',
        opening_line: gen.opening_line || '',
        hidden_objective: gen.hidden_objective,
        initial_emotion: gen.initial_emotion,
        emotional_reactivity: gen.emotional_reactivity,
        communication_style: gen.communication_style,
        typical_phrases: gen.typical_phrases,
        knowledge_limits: gen.knowledge_limits,
        backstory: gen.backstory,
        session_type: gen.session_type,
        market_context: gen.market_context,
        success_condition: gen.success_condition,
        end_condition: gen.end_condition,
        phase_flow: gen.phase_flow,
        difficulty_escalation: gen.difficulty_escalation,
        criteria_weights: gen.criteria_weights,
        positive_indicators: gen.positive_indicators,
        negative_indicators: gen.negative_indicators,
      });
      goToStep(2);
    }
  };

  // --- Step 3 handlers ---

  const handleFieldSuggestion = async (field: FieldType) => {
    if (!formData.title.trim()) { setError('Preencha o titulo antes de gerar sugestoes'); return; }
    if (formData.context.trim().length < 50) { setError('O contexto precisa ter pelo menos 50 caracteres para gerar sugestoes'); return; }

    setGeneratingField(field);
    setError(null);

    try {
      const body: Record<string, unknown> = { title: formData.title, context: formData.context, field };
      if (accessCode) body.access_code = accessCode;
      const { data, error: invokeError } = await supabase.functions.invoke('suggest-scenario-fields', {
        body,
      });
      if (invokeError) throw new Error(invokeError.message || 'Erro ao gerar sugestao');

      if (data?.fields) {
        const fields = data.fields as SuggestedScenarioFields;
        setFormData(prev => {
          const updated = { ...prev };
          if (fields.avatar_profile !== undefined) updated.avatar_profile = fields.avatar_profile;
          if (fields.objections !== undefined) updated.objections = fields.objections;
          if (fields.evaluation_criteria !== undefined) updated.evaluation_criteria = fields.evaluation_criteria;
          if (fields.ideal_outcome !== undefined) updated.ideal_outcome = fields.ideal_outcome;
          if (fields.character_gender !== undefined) updated.character_gender = fields.character_gender;
          if (fields.suggested_voice !== undefined) {
            const allowed = updated.character_gender === 'female' ? FEMALE_VOICES : MALE_VOICES;
            updated.ai_voice = allowed.includes(fields.suggested_voice) ? fields.suggested_voice : getDefaultVoiceForGender(updated.character_gender);
          }
          if (fields.character_name !== undefined) updated.character_name = fields.character_name;
          if (fields.character_role !== undefined) updated.character_role = fields.character_role;
          if (fields.personality !== undefined) updated.personality = fields.personality;
          if (fields.user_objective !== undefined) updated.user_objective = fields.user_objective;
          if (fields.opening_line !== undefined) updated.opening_line = fields.opening_line;
          if (fields.hidden_objective !== undefined) updated.hidden_objective = fields.hidden_objective;
          if (fields.initial_emotion !== undefined) updated.initial_emotion = fields.initial_emotion;
          if (fields.emotional_reactivity !== undefined) updated.emotional_reactivity = fields.emotional_reactivity;
          if (fields.communication_style !== undefined) updated.communication_style = fields.communication_style;
          if (fields.typical_phrases !== undefined) updated.typical_phrases = fields.typical_phrases;
          if (fields.knowledge_limits !== undefined) updated.knowledge_limits = fields.knowledge_limits;
          if (fields.backstory !== undefined) updated.backstory = fields.backstory;
          if (fields.session_type !== undefined) updated.session_type = fields.session_type;
          if (fields.market_context !== undefined) updated.market_context = fields.market_context;
          if (fields.target_duration_seconds !== undefined) updated.target_duration_seconds = fields.target_duration_seconds;
          if (fields.success_condition !== undefined) updated.success_condition = fields.success_condition;
          if (fields.end_condition !== undefined) updated.end_condition = fields.end_condition;
          if (fields.phase_flow !== undefined) updated.phase_flow = fields.phase_flow;
          if (fields.difficulty_escalation !== undefined) updated.difficulty_escalation = fields.difficulty_escalation;
          if (fields.criteria_weights !== undefined) updated.criteria_weights = fields.criteria_weights;
          if (fields.positive_indicators !== undefined) updated.positive_indicators = fields.positive_indicators;
          if (fields.negative_indicators !== undefined) updated.negative_indicators = fields.negative_indicators;
          return updated;
        });
      } else {
        throw new Error('Resposta invalida do servidor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar sugestao');
    } finally {
      setGeneratingField(null);
    }
  };

  const handleAISuggestionAll = async () => {
    if (!formData.title.trim()) { setError('Preencha o titulo antes de gerar sugestoes'); return; }
    if (formData.context.trim().length < 50) { setError('O contexto precisa ter pelo menos 50 caracteres'); return; }

    setIsSuggesting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { title: formData.title, context: formData.context };
      if (accessCode) body.access_code = accessCode;
      const { data, error: invokeError } = await supabase.functions.invoke('suggest-scenario-fields', {
        body,
      });
      if (invokeError) throw new Error(invokeError.message || 'Erro ao gerar sugestoes');

      if (data?.fields) {
        const fields = data.fields as SuggestedScenarioFields;
        setFormData(prev => {
          const newGender = fields.character_gender || prev.character_gender;
          const allowedV = newGender === 'female' ? FEMALE_VOICES : MALE_VOICES;
          const suggestedV = fields.suggested_voice || prev.ai_voice;
          const safeV = allowedV.includes(suggestedV) ? suggestedV : getDefaultVoiceForGender(newGender);
          return {
          ...prev,
          avatar_profile: fields.avatar_profile,
          objections: fields.objections,
          evaluation_criteria: fields.evaluation_criteria,
          ideal_outcome: fields.ideal_outcome,
          ai_voice: safeV,
          character_gender: newGender,
          character_name: fields.character_name || prev.character_name,
          character_role: fields.character_role || prev.character_role,
          personality: fields.personality || prev.personality,
          user_objective: fields.user_objective || prev.user_objective,
          opening_line: fields.opening_line || prev.opening_line,
          hidden_objective: fields.hidden_objective ?? prev.hidden_objective,
          initial_emotion: fields.initial_emotion ?? prev.initial_emotion,
          emotional_reactivity: fields.emotional_reactivity ?? prev.emotional_reactivity,
          communication_style: fields.communication_style ?? prev.communication_style,
          typical_phrases: fields.typical_phrases ?? prev.typical_phrases,
          knowledge_limits: fields.knowledge_limits ?? prev.knowledge_limits,
          backstory: fields.backstory ?? prev.backstory,
          session_type: fields.session_type ?? prev.session_type,
          market_context: fields.market_context ?? prev.market_context,
          target_duration_seconds: fields.target_duration_seconds ?? prev.target_duration_seconds,
          success_condition: fields.success_condition ?? prev.success_condition,
          end_condition: fields.end_condition ?? prev.end_condition,
          phase_flow: fields.phase_flow ?? prev.phase_flow,
          difficulty_escalation: fields.difficulty_escalation ?? prev.difficulty_escalation,
          criteria_weights: fields.criteria_weights ?? prev.criteria_weights,
          positive_indicators: fields.positive_indicators ?? prev.positive_indicators,
          negative_indicators: fields.negative_indicators ?? prev.negative_indicators,
        };});
      } else {
        throw new Error('Resposta invalida do servidor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar sugestoes');
    } finally {
      setIsSuggesting(false);
    }
  };

  const canSuggest = Boolean(formData.title.trim() && formData.context.trim().length >= 50);
  const isAnyGenerating = isSuggesting || generatingField !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) { setError('Titulo e obrigatorio'); return; }
    if (!formData.context.trim()) { setError('Contexto e obrigatorio'); return; }
    if (!formData.avatar_profile.trim()) { setError('Perfil do avatar e obrigatorio'); return; }

    const cleanedData: ScenarioFormData = {
      ...formData,
      objections: formData.objections.filter(o => o.description.trim()),
      evaluation_criteria: formData.evaluation_criteria.filter(c => c.description.trim()),
    };

    if (cleanedData.objections.length === 0) { setError('Adicione pelo menos uma objecao'); return; }
    if (cleanedData.evaluation_criteria.length === 0) { setError('Adicione pelo menos um criterio de avaliacao'); return; }

    setLoading(true);
    try {
      await onSubmit(cleanedData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cenario');
    } finally {
      setLoading(false);
    }
  };

  // Objection/criterion helpers
  const addObjection = () => setFormData(prev => ({
    ...prev, objections: [...prev.objections, { id: `obj_${Date.now()}`, description: '' }],
  }));
  const removeObjection = (id: string) => {
    if (formData.objections.length > 1) setFormData(prev => ({ ...prev, objections: prev.objections.filter(o => o.id !== id) }));
  };
  const updateObjection = (id: string, description: string) => setFormData(prev => ({
    ...prev, objections: prev.objections.map(o => o.id === id ? { ...o, description } : o),
  }));
  const addCriterion = () => setFormData(prev => ({
    ...prev, evaluation_criteria: [...prev.evaluation_criteria, { id: `crit_${Date.now()}`, description: '' }],
  }));
  const removeCriterion = (id: string) => {
    if (formData.evaluation_criteria.length > 1) setFormData(prev => ({ ...prev, evaluation_criteria: prev.evaluation_criteria.filter(c => c.id !== id) }));
  };
  const updateCriterion = (id: string, description: string) => setFormData(prev => ({
    ...prev, evaluation_criteria: prev.evaluation_criteria.map(c => c.id === id ? { ...c, description } : c),
  }));

  // Navigation
  const goToStep = (s: 1 | 2 | 3) => {
    setStep(s);
    setMaxReached(prev => Math.max(prev, s));
    setError(null);
  };

  const modalTitle = {
    1: 'Novo Cenario',
    2: 'Cenario Gerado',
    3: mode === 'edit' ? 'Editar Cenario' : mode === 'duplicate' ? 'Duplicar Cenario' : 'Novo Cenario',
  }[step];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="full" closeOnOverlayClick={false}>
      {/* Step Indicator (only in create mode) */}
      {mode === 'create' && <StepIndicator current={step} maxReached={maxReached} />}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* STEP 1: Describe */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descreva o cenario *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Quero treinar venda de software SaaS para um diretor de TI cetico que ja teve experiencia ruim com fornecedores. Ele precisa de uma solucao de gestao de projetos mas tem receio de mudar o sistema atual."
              rows={5}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Quanto mais detalhes voce fornecer, melhor sera o cenario gerado.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industria (opcional)</label>
              <select
                value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={isGenerating}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white disabled:bg-gray-50"
              >
                {INDUSTRIES.map(ind => <option key={ind.value} value={ind.value}>{ind.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de dificuldade</label>
              <select
                value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} disabled={isGenerating}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white disabled:bg-gray-50"
              >
                {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label} - {d.description}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-yellow-50 border-2 border-yellow-500 p-4">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Dicas para um bom cenario:</h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Inclua o perfil do cliente (cargo, idade, personalidade)</li>
              <li>Mencione o produto ou servico sendo vendido</li>
              <li>Descreva o contexto da negociacao (primeira reuniao, follow-up, etc.)</li>
              <li>Indique possiveis resistencias ou preocupacoes do cliente</li>
            </ul>
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={onClose} disabled={isGenerating}>Cancelar</Button>
            <Button variant="primary" onClick={handleGenerate} loading={isGenerating} disabled={!description.trim()}>
              {isGenerating ? 'Gerando...' : 'Gerar Cenario'}
            </Button>
          </ModalFooter>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="bg-white p-6 border-2 border-black shadow-[4px_4px_0px_#000]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-black">{formData.title}</h3>
                {formData.category && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full mt-1 inline-block">
                    {formData.category}
                  </span>
                )}
              </div>
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                {DURATION_OPTIONS.find(d => d.value === (formData.target_duration_seconds ?? 180))?.label || '3 min'}
              </span>
            </div>

            {/* Character */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Personagem</p>
              <p className="text-sm text-black font-medium">
                {formData.character_name || 'Sem nome'}{formData.character_role ? ` — ${formData.character_role}` : ''}
              </p>
              {formData.personality && (
                <p className="text-sm text-gray-600 mt-1">{formData.personality}</p>
              )}
            </div>

            {/* Opening line */}
            {formData.opening_line && (
              <div className="mb-4 bg-white p-3 border-2 border-black">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Fala de abertura</p>
                <p className="text-sm text-gray-700 italic">"{formData.opening_line}"</p>
              </div>
            )}

            {/* Objections & Criteria side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">
                  {formData.objections.filter(o => o.description.trim()).length} Objecoes
                </p>
                <ul className="space-y-1">
                  {formData.objections.filter(o => o.description.trim()).map((o, i) => (
                    <li key={o.id} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">{i + 1}.</span>
                      <span className="line-clamp-2">{o.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">
                  {formData.evaluation_criteria.filter(c => c.description.trim()).length} Criterios
                </p>
                <ul className="space-y-1">
                  {formData.evaluation_criteria.filter(c => c.description.trim()).map((c, i) => (
                    <li key={c.id} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5">{i + 1}.</span>
                      <span className="line-clamp-2">{c.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* User objective */}
            {formData.user_objective && (
              <div className="mt-4 pt-4 border-t-2 border-black">
                <p className="text-xs text-gray-500 uppercase font-medium mb-1">Objetivo do usuario</p>
                <p className="text-sm text-gray-700">{formData.user_objective}</p>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={() => goToStep(1)}>Regenerar</Button>
            <Button variant="primary" onClick={() => goToStep(3)}>Editar Campos</Button>
          </ModalFooter>
        </div>
      )}

      {/* STEP 3: Edit Fields */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {/* Header: Title + Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
              <input
                type="text" value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Venda de Seguro de Vida"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <input
                type="text" value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: RE/MAX — Entrevista por Competencias"
                list="category-suggestions"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
              />
              <datalist id="category-suggestions">
                <option value="Testes" />
                <option value="RE/MAX — Entrevista por Competencias" />
                <option value="RE/MAX — Cold Calls e Negociacao" />
              </datalist>
            </div>
          </div>

          {/* Section A: Exposed Fields */}
          <div className="space-y-4">
            {/* Character Name + Role */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Personagem</label>
                <input
                  type="text" value={formData.character_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, character_name: e.target.value }))}
                  placeholder="Ex: Roberto Silva"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo / Papel</label>
                <input
                  type="text" value={formData.character_role}
                  onChange={(e) => setFormData(prev => ({ ...prev, character_role: e.target.value }))}
                  placeholder="Ex: Diretor de TI"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
                />
              </div>
            </div>

            {/* Gender + Session Type + Voice */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Genero do Personagem</label>
                <div className="flex border-2 border-black overflow-hidden">
                  {GENDERS.map(g => (
                    <button
                      key={g.value} type="button"
                      onClick={() => {
                        const allowed = g.value === 'female' ? FEMALE_VOICES : MALE_VOICES;
                        setFormData(prev => ({
                          ...prev,
                          character_gender: g.value,
                          ai_voice: allowed.includes(prev.ai_voice) ? prev.ai_voice : getDefaultVoiceForGender(g.value),
                        }));
                      }}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                        formData.character_gender === g.value
                          ? 'bg-black text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Sessao</label>
                <select
                  value={formData.session_type || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, session_type: e.target.value || null }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white"
                >
                  <option value="">Nao definido</option>
                  {SESSION_TYPES.map(st => (
                    <option key={st.value} value={st.value}>{st.label} — {st.description}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voz</label>
                <select
                  value={formData.ai_voice}
                  onChange={(e) => setFormData(prev => ({ ...prev, ai_voice: e.target.value as AiVoice }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white"
                >
                  {getVoicesForGender(formData.character_gender).map(v => (
                    <option key={v.value} value={v.value}>{v.label} - {v.description}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Personality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personalidade</label>
              <textarea
                value={formData.personality}
                onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
                placeholder="2-3 frases descrevendo como o personagem se comporta e se comunica..."
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none resize-none"
              />
            </div>

            {/* Objections */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  Objecoes do Cliente *
                  {accessCode && (
                    <AIFieldButton disabled={!canSuggest} isLoading={generatingField === 'objections'}
                      onClick={() => handleFieldSuggestion('objections')}
                      tooltip={canSuggest ? 'Gerar objecoes com I.A.' : 'Preencha titulo e contexto primeiro'} />
                  )}
                </label>
                <button type="button" onClick={addObjection} className="text-sm text-blue-600 hover:text-blue-700">+ Adicionar</button>
              </div>
              <div className="space-y-2">
                {formData.objections.map((obj, i) => (
                  <div key={obj.id} className="flex gap-2">
                    <input
                      type="text" value={obj.description}
                      onChange={(e) => updateObjection(obj.id, e.target.value)}
                      placeholder={`Objecao ${i + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
                    />
                    {formData.objections.length > 1 && (
                      <button type="button" onClick={() => removeObjection(obj.id)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">X</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* User Objective */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo do Usuario</label>
              <input
                type="text" value={formData.user_objective}
                onChange={(e) => setFormData(prev => ({ ...prev, user_objective: e.target.value }))}
                placeholder="Ex: Convencer o cliente a agendar uma reuniao de demonstracao"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
              />
            </div>

            {/* Evaluation Criteria */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  Criterios de Avaliacao *
                  {accessCode && (
                    <AIFieldButton disabled={!canSuggest} isLoading={generatingField === 'evaluation_criteria'}
                      onClick={() => handleFieldSuggestion('evaluation_criteria')}
                      tooltip={canSuggest ? 'Gerar criterios com I.A.' : 'Preencha titulo e contexto primeiro'} />
                  )}
                </label>
                <button type="button" onClick={addCriterion} className="text-sm text-blue-600 hover:text-blue-700">+ Adicionar</button>
              </div>
              <div className="space-y-2">
                {formData.evaluation_criteria.map((crit, i) => (
                  <div key={crit.id} className="flex gap-2">
                    <input
                      type="text" value={crit.description}
                      onChange={(e) => updateCriterion(crit.id, e.target.value)}
                      placeholder={`Criterio ${i + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
                    />
                    {formData.evaluation_criteria.length > 1 && (
                      <button type="button" onClick={() => removeCriterion(crit.id)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">X</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Opening Line */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fala de Abertura</label>
              <input
                type="text" value={formData.opening_line}
                onChange={(e) => setFormData(prev => ({ ...prev, opening_line: e.target.value }))}
                placeholder="Ex: Ola, voce deve ser o consultor que me ligou ontem, certo?"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
              />
            </div>
          </div>

          {/* Section: Prompt Preview */}
          <div className="border-t-2 border-black pt-4">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showPreview ? 'rotate-90' : ''}`}
                fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Visualizar Prompt Compilado
            </button>

            {showPreview && (
              <div className="mt-4">
                <PromptPreviewPanel formData={formData} />
              </div>
            )}
          </div>

          {/* Section B: Advanced Mode */}
          <div className="border-t-2 border-black pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Configuracao Avancada
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-5 bg-white p-4 border-2 border-black shadow-[4px_4px_0px_#000]">
                {/* Context */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contexto da Situacao *</label>
                  <textarea
                    value={formData.context}
                    onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
                    placeholder="Descreva a situacao de venda, o cliente, o produto/servico..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none resize-none"
                  />
                  {/* AI suggestion for all fields */}
                  {accessCode && (
                    <div className="mt-2 flex items-center gap-3">
                      <button type="button" onClick={handleAISuggestionAll} disabled={!canSuggest || isAnyGenerating}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          canSuggest && !isAnyGenerating
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-md'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}>
                        {isAnyGenerating ? (
                          <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>Gerando...</>
                        ) : (
                          <><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>Regenerar todos com I.A.</>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Profile */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    Perfil do Avatar *
                    {accessCode && (
                      <AIFieldButton disabled={!canSuggest} isLoading={generatingField === 'avatar_profile'}
                        onClick={() => handleFieldSuggestion('avatar_profile')}
                        tooltip={canSuggest ? 'Gerar perfil com I.A.' : 'Preencha titulo e contexto primeiro'} />
                    )}
                  </label>
                  <textarea
                    value={formData.avatar_profile}
                    onChange={(e) => setFormData(prev => ({ ...prev, avatar_profile: e.target.value }))}
                    placeholder="Descreva a personalidade do avatar: nome, cargo, comportamento..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none resize-none"
                  />
                </div>

                {/* Ideal Outcome */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    Resultado Ideal Esperado
                    {accessCode && (
                      <AIFieldButton disabled={!canSuggest} isLoading={generatingField === 'ideal_outcome'}
                        onClick={() => handleFieldSuggestion('ideal_outcome')}
                        tooltip={canSuggest ? 'Gerar resultado com I.A.' : 'Preencha titulo e contexto primeiro'} />
                    )}
                  </label>
                  <textarea
                    value={formData.ideal_outcome}
                    onChange={(e) => setFormData(prev => ({ ...prev, ideal_outcome: e.target.value }))}
                    placeholder="Descreva o que seria um resultado ideal para esta conversa..."
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none resize-none"
                  />
                </div>

                {/* Technical Config */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duracao</label>
                    <select
                      value={formData.target_duration_seconds ?? 180}
                      onChange={(e) => setFormData(prev => ({ ...prev, target_duration_seconds: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white"
                    >
                      {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voz</label>
                    <select
                      value={formData.ai_voice}
                      onChange={(e) => setFormData(prev => ({ ...prev, ai_voice: e.target.value as AiVoice }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white"
                    >
                      {getVoicesForGender(formData.character_gender).map(v => <option key={v.value} value={v.value}>{v.label} - {v.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Avatar</label>
                    <select
                      value={formData.avatar_provider || 'none'}
                      onChange={(e) => setFormData(prev => ({ ...prev, avatar_provider: e.target.value as AvatarProvider }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none bg-white"
                    >
                      {AVATAR_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Avatar ID (conditional) */}
                {formData.avatar_provider && formData.avatar_provider !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.avatar_provider === 'simli' ? 'Face ID do Simli' : 'Avatar ID'}
                    </label>
                    <input
                      type="text"
                      value={formData.avatar_provider === 'simli' ? formData.simli_face_id : formData.avatar_id}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        ...(formData.avatar_provider === 'simli' ? { simli_face_id: e.target.value } : { avatar_id: e.target.value }),
                      }))}
                      placeholder="Opcional"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:border-black focus:ring-0 transition-colors outline-none"
                    />
                  </div>
                )}

                {/* Active Status */}
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="is_active" checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black" />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Cenario ativo (visivel para usuarios)</label>
                </div>
              </div>
            )}
          </div>

          <ModalFooter>
            {mode === 'create' && step === 3 && maxReached >= 2 && (
              <Button variant="outline" onClick={() => goToStep(2)} disabled={loading}>Voltar</Button>
            )}
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="primary" loading={loading}>
              {mode === 'edit' ? 'Salvar Alteracoes' : 'Criar Cenario'}
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
