import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useScenarios } from '../../hooks/useScenarios';
import { Button } from '../../components/ui';
import { ConfirmDialog } from '../../components/ui/Modal';
import { ScenarioWizard } from '../../components/Admin/ScenarioWizard';
import type { Scenario, ScenarioFormData } from '../../types';

type ModalMode = 'create' | 'edit' | 'duplicate';

// Categories that start collapsed
const COLLAPSED_CATEGORIES = new Set(['Testes']);

function groupByCategory(scenarios: Scenario[]): Record<string, Scenario[]> {
  const groups: Record<string, Scenario[]> = {};
  for (const s of scenarios) {
    const cat = s.category || 'Geral';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }
  return groups;
}

export function AdminScenarios() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { scenarios, loading, createScenario, updateScenario, deleteScenario, generateScenario, isGenerating } = useScenarios();
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ModalMode>('create');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  // Delete confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Category collapse state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const cat of Object.keys(groupByCategory(scenarios))) {
      init[cat] = COLLAPSED_CATEGORIES.has(cat);
    }
    return init;
  });

  const filteredScenarios = scenarios.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.context.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = groupByCategory(filteredScenarios);
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Testes') return 1;
    if (b === 'Testes') return -1;
    return a.localeCompare(b);
  });

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleOpenForm = (mode: ModalMode, scenario?: Scenario) => {
    setFormMode(mode);
    setSelectedScenario(scenario || null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedScenario(null);
  };

  const handleSubmitForm = async (data: ScenarioFormData) => {
    if (!accessCode?.code) {
      throw new Error('Codigo de acesso nao encontrado');
    }

    if (formMode === 'edit' && selectedScenario) {
      const { error } = await updateScenario(accessCode.code, selectedScenario.id, data);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await createScenario(accessCode.code, data);
      if (error) throw new Error(error.message);
    }
  };

  const handleGenerateRequest = async (code: string, request: { description: string; industry?: string; difficulty?: 'easy' | 'medium' | 'hard' }) => {
    return generateScenario(code, request);
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
            <Button variant="primary" onClick={() => handleOpenForm('create')}>
              + Novo Cenario
            </Button>
          </div>
        </div>

        {/* Scenarios List — Grouped by Category */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg p-5 border border-gray-200 animate-pulse">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
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
              <Button variant="primary" onClick={() => handleOpenForm('create')}>
                + Criar Cenario
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedCategories.map((category) => {
              const categoryScenarios = grouped[category];
              const isCollapsed = collapsed[category] ?? false;

              return (
                <div key={category}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 mb-3 group cursor-pointer"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="currentColor" viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-sm font-semibold text-gray-600 group-hover:text-black transition-colors uppercase tracking-wide">
                      {category}
                    </h2>
                    <span className="text-xs text-gray-400">({categoryScenarios.length})</span>
                  </button>

                  {/* Scenario Cards */}
                  {!isCollapsed && (
                    <div className="space-y-3">
                      {categoryScenarios.map((scenario) => (
                        <div
                          key={scenario.id}
                          className="bg-white rounded-lg p-5 border border-gray-200 hover:border-yellow-400 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-black">{scenario.title}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  scenario.is_active
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {scenario.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{scenario.context}</p>
                              <div className="flex gap-4 text-sm text-gray-500">
                                <span className="px-2 py-0.5 bg-yellow-100 text-black rounded">
                                  {scenario.objections.length} objecoes
                                </span>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                                  {scenario.evaluation_criteria.length} criterios
                                </span>
                                {scenario.character_name && (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
                                    {scenario.character_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex-shrink-0 flex gap-3 text-sm">
                              <button onClick={() => handleOpenForm('edit', scenario)}
                                className="text-gray-500 hover:text-black transition-colors">Editar</button>
                              <span className="text-gray-300">|</span>
                              <button onClick={() => handleOpenForm('duplicate', scenario)}
                                className="text-gray-500 hover:text-black transition-colors">Duplicar</button>
                              <span className="text-gray-300">|</span>
                              <button onClick={() => handleDeleteClick(scenario)}
                                className="text-red-500 hover:text-red-600 transition-colors">Excluir</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Scenario Wizard */}
      <ScenarioWizard
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={handleSubmitForm}
        scenario={selectedScenario}
        mode={formMode}
        accessCode={accessCode?.code}
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
