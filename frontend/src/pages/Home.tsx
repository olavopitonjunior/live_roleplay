import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScenarios } from '../hooks/useScenarios';
import { useDifficultyProfile } from '../hooks/useDifficultyProfile';
import { ScenarioList, ModeSelectionModal } from '../components/Scenarios';
import type { Scenario, SessionMode, CoachIntensity } from '../types';

export function Home() {
  const navigate = useNavigate();
  const { accessCode, logout, isAdmin } = useAuth();
  const { scenarios, loading, error } = useScenarios();
  const { profile: difficultyProfile } = useDifficultyProfile();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
  };

  const handleModeStart = (mode: SessionMode, coachIntensity?: CoachIntensity) => {
    if (selectedScenario) {
      // Navigate with mode parameters via state
      navigate(`/session/${selectedScenario.id}`, {
        state: { sessionMode: mode, coachIntensity }
      });
    }
  };

  const handleModalCancel = () => {
    setSelectedScenario(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div>
              <h1 className="text-xl font-bold text-black">Agent Roleplay</h1>
              <p className="text-xs text-gray-500">
                {accessCode?.code} • {isAdmin ? 'Admin' : 'Usuario'}
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                Meu Perfil
              </button>
              <button
                onClick={() => navigate('/history')}
                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
              >
                Historico
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/admin/scenarios')}
                    className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                  >
                    Cenarios
                  </button>
                  <button
                    onClick={() => navigate('/admin/api-dashboard')}
                    className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                  >
                    API Usage
                  </button>
                </>
              )}

              <button
                onClick={handleLogout}
                className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                Sair
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-black mb-2">Escolha seu desafio</h2>
          <p className="text-gray-600">
            Pratique cenarios reais de vendas e receba feedback instantaneo
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <ScenarioList
          scenarios={scenarios}
          loading={loading}
          onScenarioClick={handleScenarioClick}
        />
      </main>

      {/* Mode Selection Modal */}
      {selectedScenario && (
        <ModeSelectionModal
          scenario={selectedScenario}
          onStart={handleModeStart}
          onCancel={handleModalCancel}
          difficultyLevel={difficultyProfile?.current_level}
        />
      )}
    </div>
  );
}
