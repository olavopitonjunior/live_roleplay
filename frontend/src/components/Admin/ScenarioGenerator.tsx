import { useState } from 'react';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui';
import type { GeneratedScenario, GenerateScenarioRequest } from '../../types';

interface ScenarioGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (scenario: GeneratedScenario) => void;
  generateScenario: (request: GenerateScenarioRequest) => Promise<{
    data: GeneratedScenario | null;
    error: { message: string } | null;
  }>;
  isGenerating: boolean;
}

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

export function ScenarioGenerator({
  isOpen,
  onClose,
  onGenerated,
  generateScenario,
  isGenerating,
}: ScenarioGeneratorProps) {
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Descreva o cenario que deseja criar');
      return;
    }

    setError(null);

    const result = await generateScenario({
      description: description.trim(),
      industry: industry || undefined,
      difficulty,
    });

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      onGenerated(result.data);
      // Reset form
      setDescription('');
      setIndustry('');
      setDifficulty('medium');
      onClose();
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setDescription('');
      setIndustry('');
      setDifficulty('medium');
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Gerar Cenario com IA"
      description="Descreva o cenario de treinamento que deseja criar e a IA gerara todos os campos automaticamente"
      size="lg"
      closeOnOverlayClick={!isGenerating}
    >
      <div className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descreva o cenario *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Quero treinar venda de software SaaS para um diretor de TI cetico que ja teve experiencia ruim com fornecedores. Ele precisa de uma solucao de gestao de projetos mas tem receio de mudar o sistema atual."
            rows={5}
            disabled={isGenerating}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                       focus:border-black focus:ring-0 transition-colors outline-none resize-none
                       disabled:bg-gray-50 disabled:text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Quanto mais detalhes voce fornecer, melhor sera o cenario gerado.
          </p>
        </div>

        {/* Industry and Difficulty */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Industry */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industria (opcional)
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                         focus:border-black focus:ring-0 transition-colors outline-none bg-white
                         disabled:bg-gray-50 disabled:text-gray-500"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nivel de dificuldade
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg
                         focus:border-black focus:ring-0 transition-colors outline-none bg-white
                         disabled:bg-gray-50 disabled:text-gray-500"
            >
              {DIFFICULTIES.map((diff) => (
                <option key={diff.value} value={diff.value}>
                  {diff.label} - {diff.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Dicas para um bom cenario:</h4>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>Inclua o perfil do cliente (cargo, idade, personalidade)</li>
            <li>Mencione o produto ou servico sendo vendido</li>
            <li>Descreva o contexto da negociacao (primeira reuniao, follow-up, etc.)</li>
            <li>Indique possiveis resistencias ou preocupacoes do cliente</li>
          </ul>
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={!description.trim()}
          >
            {isGenerating ? 'Gerando...' : 'Gerar com IA'}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
