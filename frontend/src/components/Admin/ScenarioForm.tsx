import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui';
import type { Scenario, Objection, EvaluationCriterion, GeminiVoice, GeneratedScenario, AvatarProvider } from '../../types';

// Available Gemini voices with descriptions
const GEMINI_VOICES: { value: GeminiVoice; label: string; description: string }[] = [
  { value: 'Puck', label: 'Puck', description: 'Masculina, amigavel (padrao)' },
  { value: 'Charon', label: 'Charon', description: 'Masculina, grave e seria' },
  { value: 'Kore', label: 'Kore', description: 'Feminina, suave' },
  { value: 'Fenrir', label: 'Fenrir', description: 'Masculina, assertiva' },
  { value: 'Aoede', label: 'Aoede', description: 'Feminina, expressiva' },
];

const AVATAR_PROVIDERS: { value: AvatarProvider; label: string; description: string }[] = [
  { value: 'simli', label: 'Simli', description: 'Avatar padrao com lip-sync' },
  { value: 'liveavatar', label: 'HeyGen (LiveAvatar)', description: 'Avatar mais expressivo' },
  { value: 'hedra', label: 'Hedra', description: 'Avatar expressivo alternativo' },
];

interface ScenarioFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScenarioFormData) => Promise<void>;
  scenario?: Scenario | null;
  mode: 'create' | 'edit' | 'duplicate';
  generatedData?: GeneratedScenario | null;
}

export interface ScenarioFormData {
  title: string;
  context: string;
  avatar_profile: string;
  objections: Objection[];
  evaluation_criteria: EvaluationCriterion[];
  ideal_outcome: string;
  simli_face_id: string;
  gemini_voice: GeminiVoice;
  avatar_provider: AvatarProvider | null;
  avatar_id: string;
  is_active: boolean;
}

const emptyFormData: ScenarioFormData = {
  title: '',
  context: '',
  avatar_profile: '',
  objections: [{ id: 'obj_1', description: '' }],
  evaluation_criteria: [{ id: 'crit_1', description: '' }],
  ideal_outcome: '',
  simli_face_id: '',
  gemini_voice: 'Puck',
  avatar_provider: 'simli',
  avatar_id: '',
  is_active: true,
};

export function ScenarioForm({ isOpen, onClose, onSubmit, scenario, mode, generatedData }: ScenarioFormProps) {
  const [formData, setFormData] = useState<ScenarioFormData>(emptyFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // If we have generated data from AI, use it
      if (generatedData) {
        setFormData({
          title: generatedData.title,
          context: generatedData.context,
          avatar_profile: generatedData.avatar_profile,
          objections: generatedData.objections,
          evaluation_criteria: generatedData.evaluation_criteria,
          ideal_outcome: generatedData.ideal_outcome,
          simli_face_id: '',
          gemini_voice: generatedData.suggested_voice || 'Puck',
          avatar_provider: 'simli',
          avatar_id: '',
          is_active: true,
        });
      } else if (scenario && (mode === 'edit' || mode === 'duplicate')) {
        setFormData({
          title: mode === 'duplicate' ? `${scenario.title} (Copia)` : scenario.title,
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
          gemini_voice: scenario.gemini_voice || 'Puck',
          avatar_provider: scenario.avatar_provider || 'simli',
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
        </div>

        {/* Avatar Profile */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Perfil do Avatar *
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
              value={formData.avatar_provider || 'simli'}
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
              value={formData.gemini_voice}
              onChange={(e) => setFormData(prev => ({ ...prev, gemini_voice: e.target.value as GeminiVoice }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                         focus:border-black focus:ring-0 transition-colors outline-none bg-white"
            >
              {GEMINI_VOICES.map((voice) => (
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
            <label className="block text-sm font-medium text-gray-700">
              Objecoes do Cliente *
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
            <label className="block text-sm font-medium text-gray-700">
              Criterios de Avaliacao *
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resultado Ideal Esperado
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
