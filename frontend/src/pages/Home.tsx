import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScenarios } from '../hooks/useScenarios';
import { useDifficultyProfile } from '../hooks/useDifficultyProfile';
import { ScenarioList, ModeSelectionModal } from '../components/Scenarios';
import type { Scenario, SessionMode, AiVoice } from '../types';

export function Home() {
  const navigate = useNavigate();
  const { accessCode, logout, isAdmin } = useAuth();
  const { scenarios, loading, error } = useScenarios();
  const { profile: difficultyProfile } = useDifficultyProfile();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
  };

  const handleModeStart = (mode: SessionMode, durationSeconds: number, voiceOverride?: AiVoice) => {
    if (selectedScenario) {
      navigate(`/session/${selectedScenario.id}`, {
        state: { sessionMode: mode, durationSeconds, voiceOverride }
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
      <header className="border-b-2 border-black sticky top-0 z-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div>
              <h1 className="text-xl font-bold text-black uppercase tracking-tight">Agent Roleplay</h1>
              <p className="text-xs text-black font-mono uppercase tracking-wider">
                {accessCode?.code} • {isAdmin ? 'Admin' : 'Usuario'}
              </p>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-4">
              <button
                onClick={() => navigate('/profile')}
                className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
              >
                Meu Perfil
              </button>
              <button
                onClick={() => navigate('/history')}
                className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
              >
                Historico
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/admin/scenarios')}
                    className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
                  >
                    Cenarios
                  </button>
                  <button
                    onClick={() => navigate('/admin/api-dashboard')}
                    className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
                  >
                    API Usage
                  </button>
                </>
              )}

              <button
                onClick={handleLogout}
                className="text-sm font-bold text-black hover:text-red-600 transition-colors uppercase tracking-wider border-2 border-black px-3 py-1 hover:bg-red-50"
              >
                Sair
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="border-b-2 border-black bg-yellow-400">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-3xl font-bold text-black mb-2 uppercase tracking-tight">Escolha seu desafio</h2>
          <p className="text-black font-mono">
            Pratique cenarios reais de vendas e receba feedback instantaneo
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-white border-2 border-black text-black font-mono">
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
