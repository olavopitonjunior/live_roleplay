import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useScenarios } from '../../hooks/useScenarios';
import { Button, Card } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Modal';
import { ScenarioForm, type ScenarioFormData } from '../../components/Admin';
import { ScenarioGenerator } from '../../components/Admin/ScenarioGenerator';
import type { Scenario, GeneratedScenario } from '../../types';

type ModalMode = 'create' | 'edit' | 'duplicate';

export function AdminScenarios() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { scenarios, loading, createScenario, updateScenario, deleteScenario, generateScenario, isGenerating } = useScenarios();
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ModalMode>('create');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Generator modal
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedScenario | null>(null);

  // Delete confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filteredScenarios = scenarios.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.context.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenForm = (mode: ModalMode, scenario?: Scenario) => {
    setFormMode(mode);
    setSelectedScenario(scenario || null);
    setGeneratedData(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedScenario(null);
    setGeneratedData(null);
  };

  const handleGenerated = (generated: GeneratedScenario) => {
    setGeneratedData(generated);
    setFormMode('create');
    setSelectedScenario(null);
    setIsFormOpen(true);
  };

  const handleGenerateRequest = async (request: { description: string; industry?: string; difficulty?: 'easy' | 'medium' | 'hard' }) => {
    if (!accessCode?.code) {
      return { data: null, error: { message: 'Codigo de acesso nao encontrado' } };
    }
    return generateScenario(accessCode.code, request);
  };

  const handleSubmitForm = async (data: ScenarioFormData) => {
    if (!accessCode?.code) {
      throw new Error('Codigo de acesso nao encontrado');
    }

    if (formMode === 'edit' && selectedScenario) {
      const { error } = await updateScenario(accessCode.code, selectedScenario.id, data);
      if (error) throw new Error(error.message);
    } else {
      // create or duplicate
      const { error } = await createScenario(accessCode.code, data);
      if (error) throw new Error(error.message);
    }
  };

  const handleDeleteClick = (scenario: Scenario) => {
    setScenarioToDelete(scenario);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!scenarioToDelete || !accessCode?.code) return;

    setDeleteLoading(true);
    try {
      const { error } = await deleteScenario(accessCode.code, scenarioToDelete.id);
      if (error) throw new Error(error.message);
      setIsDeleteOpen(false);
      setScenarioToDelete(null);
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="text-gray-600 hover:text-black transition-colors"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-xl font-bold text-black">Admin - Cenarios</h1>
                <p className="text-sm text-gray-500">Gerencie os cenarios de treinamento</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          {/* Search */}
          <input
            type="text"
            placeholder="Buscar cenarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 px-4 py-2.5 bg-white border border-gray-300 rounded-lg
                       text-black placeholder:text-gray-400
                       focus:border-black focus:ring-0 transition-colors outline-none"
          />

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {filteredScenarios.length} cenario{filteredScenarios.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="outline"
              onClick={() => setIsGeneratorOpen(true)}
            >
              Gerar com IA
            </Button>
            <Button
              variant="primary"
              onClick={() => handleOpenForm('create')}
            >
              + Novo Cenario
            </Button>
          </div>
        </div>

        {/* Scenarios List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredScenarios.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-bold text-black mb-2">
              {searchQuery ? 'Nenhum cenario encontrado' : 'Nenhum cenario ainda'}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {searchQuery
                ? `Nao encontramos cenarios com "${searchQuery}"`
                : 'Crie seu primeiro cenario de treinamento para comecar.'}
            </p>
            {!searchQuery && (
              <Button
                variant="primary"
                onClick={() => handleOpenForm('create')}
              >
                + Criar Cenario
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredScenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-white rounded-lg p-5 border border-gray-200 hover:border-yellow-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-black">
                        {scenario.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        scenario.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {scenario.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {scenario.context}
                    </p>

                    {/* Meta */}
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span className="px-2 py-0.5 bg-yellow-100 text-black rounded">
                        {scenario.objections.length} objecoes
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {scenario.evaluation_criteria.length} criterios
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-3 text-sm">
                    <button
                      onClick={() => handleOpenForm('edit', scenario)}
                      className="text-gray-500 hover:text-black transition-colors"
                    >
                      Editar
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleOpenForm('duplicate', scenario)}
                      className="text-gray-500 hover:text-black transition-colors"
                    >
                      Duplicar
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleDeleteClick(scenario)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Scenario Form Modal */}
      <ScenarioForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        scenario={selectedScenario}
        mode={formMode}
        generatedData={generatedData}
      />

      {/* Scenario Generator Modal */}
      <ScenarioGenerator
        isOpen={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onGenerated={handleGenerated}
        generateScenario={handleGenerateRequest}
        isGenerating={isGenerating}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Cenario"
        message={`Tem certeza que deseja excluir "${scenarioToDelete?.title}"? Esta acao nao pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
