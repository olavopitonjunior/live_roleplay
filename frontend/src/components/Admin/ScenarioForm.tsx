import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui';
import { supabase } from '../../lib/supabase';
import type { Scenario, Objection, EvaluationCriterion, AiVoice, GeneratedScenario, AvatarProvider, SuggestedScenarioFields } from '../../types';

// Available AI voices (OpenAI Realtime)
const AI_VOICES: { value: AiVoice; label: string; description: string }[] = [
  { value: 'echo', label: 'Echo', description: 'Masculina, amigavel (padrao)' },
  { value: 'ash', label: 'Ash', description: 'Masculina, grave e seria' },
  { value: 'shimmer', label: 'Shimmer', description: 'Feminina, suave' },
  { value: 'sage', label: 'Sage', description: 'Masculina, assertiva' },
  { value: 'coral', label: 'Coral', description: 'Feminina, expressiva' },
];

const AVATAR_PROVIDERS: { value: AvatarProvider; label: string; description: string }[] = [
  { value: 'hedra', label: 'Hedra', description: 'Avatar padrao com lip-sync (Character-3)' },
  { value: 'simli', label: 'Simli', description: 'Avatar legacy' },
  { value: 'liveavatar', label: 'HeyGen (LiveAvatar)', description: 'Avatar legacy' },
];

interface ScenarioFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScenarioFormData) => Promise<void>;
  scenario?: Scenario | null;
  mode: 'create' | 'edit' | 'duplicate';
  generatedData?: GeneratedScenario | null;
  accessCode?: string;
}

export interface ScenarioFormData {
  title: string;
  category: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  simli_face_id: string;
  ai_voice: AiVoice;
  avatar_provider: AvatarProvider | null;
  avatar_id: string;
  is_active: boolean;
}

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
  avatar_provider: 'hedra',
  avatar_id: '',
  is_active: true,
};

// Field types that can be generated individually
type FieldType = 'avatar_profile' | 'objections' | 'evaluation_criteria' | 'ideal_outcome' | 'all';

// AI Field Button component - small icon next to labels
function AIFieldButton({
  disabled,
  isLoading,
  onClick,
  tooltip,
}: {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      title={tooltip}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all ${
        disabled || isLoading
          ? 'text-gray-300 cursor-not-allowed'
          : 'text-purple-500 hover:text-purple-600 hover:bg-purple-50'
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

export function ScenarioForm({ isOpen, onClose, onSubmit, scenario, mode, generatedData, accessCode }: ScenarioFormProps) {
  const [formData, setFormData] = useState<ScenarioFormData>(emptyFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [generatingField, setGeneratingField] = useState<FieldType | null>(null);

  // Handler for individual field suggestion
  const handleFieldSuggestion = async (field: FieldType) => {
    if (!accessCode) {
      setError('Codigo de acesso nao encontrado');
      return;
    }
    if (!formData.title.trim()) {
      setError('Preencha o titulo antes de gerar sugestoes');
      return;
    }
    if (formData.context.trim().length < 50) {
      setError('O contexto precisa ter pelo menos 50 caracteres para gerar sugestoes');
      return;
    }

    setGeneratingField(field);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('suggest-scenario-fields', {
        body: {
          access_code: accessCode,
          title: formData.title,
          context: formData.context,
          field,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Erro ao gerar sugestao');
      }

      if (data?.fields) {
        const fields = data.fields;
        setFormData(prev => {
          const updated = { ...prev };

          if (fields.avatar_profile !== undefined) {
            updated.avatar_profile = fields.avatar_profile;
          }
          if (fields.objections !== undefined) {
            updated.objections = fields.objections;
          }
          if (fields.evaluation_criteria !== undefined) {
            updated.evaluation_criteria = fields.evaluation_criteria;
          }
          if (fields.ideal_outcome !== undefined) {
            updated.ideal_outcome = fields.ideal_outcome;
          }
          if (fields.suggested_voice !== undefined) {
            updated.ai_voice = fields.suggested_voice;
          }

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

  // Handler for AI suggestion (all fields)
  const handleAISuggestion = async () => {
    if (!accessCode) {
      setError('Codigo de acesso nao encontrado');
      return;
    }
    if (!formData.title.trim()) {
      setError('Preencha o titulo antes de gerar sugestoes');
      return;
    }
    if (formData.context.trim().length < 50) {
      setError('O contexto precisa ter pelo menos 50 caracteres para gerar sugestoes');
      return;
    }

    setIsSuggesting(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('suggest-scenario-fields', {
        body: {
          access_code: accessCode,
          title: formData.title,
          context: formData.context,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Erro ao gerar sugestoes');
      }

      if (data?.fields) {
        const fields = data.fields as SuggestedScenarioFields;
        setFormData(prev => ({
          ...prev,
          avatar_profile: fields.avatar_profile,
          objections: fields.objections,
          evaluation_criteria: fields.evaluation_criteria,
          ideal_outcome: fields.ideal_outcome,
          ai_voice: fields.suggested_voice || prev.ai_voice,
        }));
      } else {
        throw new Error('Resposta invalida do servidor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar sugestoes');
    } finally {
      setIsSuggesting(false);
    }
  };

  const canSuggest = Boolean(accessCode && formData.title.trim() && formData.context.trim().length >= 50);
  const isAnyGenerating = isSuggesting || generatingField !== null;

  useEffect(() => {
    if (isOpen) {
      // If we have generated data from AI, use it
      if (generatedData) {
        setFormData({
          title: generatedData.title,
          category: '',
          context: generatedData.context,
          avatar_profile: generatedData.avatar_profile,
          objections: generatedData.objections,
          evaluation_criteria: generatedData.evaluation_criteria,
          ideal_outcome: generatedData.ideal_outcome,
          simli_face_id: '',
          ai_voice: generatedData.suggested_voice || 'echo',
          avatar_provider: 'hedra',
          avatar_id: '',
          is_active: true,
        });
      } else if (scenario && (mode === 'edit' || mode === 'duplicate')) {
        setFormData({
          title: mode === 'duplicate' ? `${scenario.title} (Copia)` : scenario.title,
          category: scenario.category || '',
          context: scenario.context,
          avatar_profile: scenario.avatar_profile,
          objections: scenario.objections.length > 0
            ? scenario.objections
            : [{ id: 'obj_1', description: '' }],
          evaluation_criteria: scenario.evaluation_criteria.length > 0
            ? scenario.evaluation_criteria
            : [{ id: 'crit_1', description: '' }],
          ideal_outcome: scenario.ideal_outcome || '',
          simli_face_id: scenario.simli_face_id || '',
          ai_voice: scenario.ai_voice || 'echo',
          avatar_provider: scenario.avatar_provider || 'hedra',
          avatar_id: scenario.avatar_id || '',
          is_active: scenario.is_active,
        });
      } else {
        setFormData(emptyFormData);
      }
      setError(null);
    }
  }, [isOpen, scenario, mode, generatedData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Titulo e obrigatorio');
      return;
    }
    if (!formData.context.trim()) {
      setError('Contexto e obrigatorio');
      return;
    }
    if (!formData.avatar_profile.trim()) {
      setError('Perfil do avatar e obrigatorio');
      return;
    }
    if (formData.avatar_provider !== 'simli' && !formData.avatar_id.trim()) {
      setError('Avatar ID e obrigatorio para o provedor selecionado');
      return;
    }

    // Filter out empty objections and criteria
    const cleanedData: ScenarioFormData = {
      ...formData,
      objections: formData.objections.filter(o => o.description.trim()),
      evaluation_criteria: formData.evaluation_criteria.filter(c => c.description.trim()),
    };

    if (cleanedData.objections.length === 0) {
      setError('Adicione pelo menos uma objecao');
      return;
    }
    if (cleanedData.evaluation_criteria.length === 0) {
      setError('Adicione pelo menos um criterio de avaliacao');
      return;
    }

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

  const addObjection = () => {
    const newId = `obj_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      objections: [...prev.objections, { id: newId, description: '' }],
    }));
  };

  const removeObjection = (id: string) => {
    if (formData.objections.length > 1) {
      setFormData(prev => ({
        ...prev,
        objections: prev.objections.filter(o => o.id !== id),
      }));
    }
  };

  const updateObjection = (id: string, description: string) => {
    setFormData(prev => ({
      ...prev,
      objections: prev.objections.map(o =>
        o.id === id ? { ...o, description } : o
      ),
    }));
  };

  const addCriterion = () => {
    const newId = `crit_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      evaluation_criteria: [...prev.evaluation_criteria, { id: newId, description: '' }],
    }));
  };

  const removeCriterion = (id: string) => {
    if (formData.evaluation_criteria.length > 1) {
      setFormData(prev => ({
        ...prev,
        evaluation_criteria: prev.evaluation_criteria.filter(c => c.id !== id),
      }));
    }
  };

  const updateCriterion = (id: string, description: string) => {
    setFormData(prev => ({
      ...prev,
      evaluation_criteria: prev.evaluation_criteria.map(c =>
        c.id === id ? { ...c, description } : c
      ),
    }));
  };

  const title = generatedData
    ? 'Cenario Gerado por IA'
    : {
        create: 'Novo Cenario',
        edit: 'Editar Cenario',
        duplicate: 'Duplicar Cenario',
      }[mode];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={generatedData
        ? "Revise e ajuste o cenario gerado antes de salvar"
        : "Preencha os campos abaixo para configurar o cenario de treinamento"
      }
      size="full"
      closeOnOverlayClick={false}
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Titulo *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Ex: Venda de Seguro de Vida"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoria
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="Ex: RE/MAX — Entrevista por Competencias"
            list="category-suggestions"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none"
          />
          <datalist id="category-suggestions">
            <option value="Testes" />
            <option value="RE/MAX — Entrevista por Competencias" />
            <option value="RE/MAX — Cold Calls e Negociacao" />
          </datalist>
        </div>

        {/* Context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contexto da Situacao *
          </label>
          <textarea
            value={formData.context}
            onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
            placeholder="Descreva a situacao de venda, o cliente, o produto/servico..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none resize-none"
          />
          {/* AI Suggestion Button */}
          {accessCode && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAISuggestion}
                disabled={!canSuggest || isAnyGenerating}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  canSuggest && !isAnyGenerating
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-md hover:shadow-lg'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isAnyGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Gerando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                    Sugestao da I.A.
                  </>
                )}
              </button>
              {!canSuggest && formData.context.trim().length < 50 && formData.context.trim().length > 0 && (
                <span className="text-xs text-gray-500">
                  {50 - formData.context.trim().length} caracteres restantes para habilitar
                </span>
              )}
            </div>
          )}
        </div>

        {/* Avatar Profile */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            Perfil do Avatar *
            {accessCode && (
              <AIFieldButton
                disabled={!canSuggest}
                isLoading={generatingField === 'avatar_profile'}
                onClick={() => handleFieldSuggestion('avatar_profile')}
                tooltip={canSuggest ? 'Gerar perfil com I.A.' : 'Preencha titulo e contexto primeiro'}
              />
            )}
          </label>
          <textarea
            value={formData.avatar_profile}
            onChange={(e) => setFormData(prev => ({ ...prev, avatar_profile: e.target.value }))}
            placeholder="Descreva a personalidade do avatar: nome, cargo, comportamento..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none resize-none"
          />
        </div>

        {/* Voice and Avatar Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avatar Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provedor do Avatar
            </label>
            <select
              value={formData.avatar_provider || 'hedra'}
              onChange={(e) =>
                setFormData(prev => ({
                  ...prev,
                  avatar_provider: e.target.value as AvatarProvider,
                }))
              }
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                         focus:border-black focus:ring-0 transition-colors outline-none bg-white"
            >
              {AVATAR_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label} - {provider.description}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Escolha o provedor do avatar para este cenario.
            </p>
          </div>

          {/* Gemini Voice */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Voz do Avatar
            </label>
            <select
              value={formData.ai_voice}
              onChange={(e) => setFormData(prev => ({ ...prev, ai_voice: e.target.value as AiVoice }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                         focus:border-black focus:ring-0 transition-colors outline-none bg-white"
            >
              {AI_VOICES.map((voice) => (
                <option key={voice.value} value={voice.value}>
                  {voice.label} - {voice.description}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Escolha a voz que melhor combina com o perfil do avatar.
            </p>
          </div>

          {/* Simli Face ID */}
          {formData.avatar_provider === 'simli' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Face ID do Simli
              </label>
              <input
                type="text"
                value={formData.simli_face_id}
                onChange={(e) => setFormData(prev => ({ ...prev, simli_face_id: e.target.value }))}
                placeholder="Opcional - deixe vazio para usar o padrao"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                           focus:border-black focus:ring-0 transition-colors outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                ID do avatar Simli. Deixe vazio para usar o avatar padrao.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar ID do Provedor
              </label>
              <input
                type="text"
                value={formData.avatar_id}
                onChange={(e) => setFormData(prev => ({ ...prev, avatar_id: e.target.value }))}
                placeholder="Obrigatorio para HeyGen/Hedra"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                           focus:border-black focus:ring-0 transition-colors outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                ID do avatar no provedor selecionado.
              </p>
            </div>
          )}
        </div>

        {/* Objections */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Objecoes do Cliente *
              {accessCode && (
                <AIFieldButton
                  disabled={!canSuggest}
                  isLoading={generatingField === 'objections'}
                  onClick={() => handleFieldSuggestion('objections')}
                  tooltip={canSuggest ? 'Gerar objecoes com I.A.' : 'Preencha titulo e contexto primeiro'}
                />
              )}
            </label>
            <button
              type="button"
              onClick={addObjection}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {formData.objections.map((objection, index) => (
              <div key={objection.id} className="flex gap-2">
                <input
                  type="text"
                  value={objection.description}
                  onChange={(e) => updateObjection(objection.id, e.target.value)}
                  placeholder={`Objecao ${index + 1}`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg
                             focus:border-black focus:ring-0 transition-colors outline-none"
                />
                {formData.objections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeObjection(objection.id)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Evaluation Criteria */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Criterios de Avaliacao *
              {accessCode && (
                <AIFieldButton
                  disabled={!canSuggest}
                  isLoading={generatingField === 'evaluation_criteria'}
                  onClick={() => handleFieldSuggestion('evaluation_criteria')}
                  tooltip={canSuggest ? 'Gerar criterios com I.A.' : 'Preencha titulo e contexto primeiro'}
                />
              )}
            </label>
            <button
              type="button"
              onClick={addCriterion}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {formData.evaluation_criteria.map((criterion, index) => (
              <div key={criterion.id} className="flex gap-2">
                <input
                  type="text"
                  value={criterion.description}
                  onChange={(e) => updateCriterion(criterion.id, e.target.value)}
                  placeholder={`Criterio ${index + 1}`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg
                             focus:border-black focus:ring-0 transition-colors outline-none"
                />
                {formData.evaluation_criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(criterion.id)}
                    className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ideal Outcome */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            Resultado Ideal Esperado
            {accessCode && (
              <AIFieldButton
                disabled={!canSuggest}
                isLoading={generatingField === 'ideal_outcome'}
                onClick={() => handleFieldSuggestion('ideal_outcome')}
                tooltip={canSuggest ? 'Gerar resultado com I.A.' : 'Preencha titulo e contexto primeiro'}
              />
            )}
          </label>
          <textarea
            value={formData.ideal_outcome}
            onChange={(e) => setFormData(prev => ({ ...prev, ideal_outcome: e.target.value }))}
            placeholder="Descreva o que seria um resultado ideal para esta conversa de vendas..."
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none resize-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Este campo ajuda a IA a avaliar o desempenho do vendedor de forma mais precisa.
          </p>
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">
            Cenario ativo (visivel para usuarios)
          </label>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {mode === 'edit' ? 'Salvar Alteracoes' : 'Criar Cenario'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
