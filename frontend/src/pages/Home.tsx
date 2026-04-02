import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScenarios } from '../hooks/useScenarios';
import { useDifficultyProfile } from '../hooks/useDifficultyProfile';
import { useTracks } from '../hooks/useTracks';
import { ScenarioList, ModeSelectionModal } from '../components/Scenarios';
import { TrackCard } from '../components/Tracks/TrackCard';
import type { Scenario, SessionMode, AiVoice, PresentationData } from '../types';

export function Home() {
  const navigate = useNavigate();
  const { accessCode, logout, isAdmin } = useAuth();
  const { scenarios, loading, error } = useScenarios();
  const { tracks, loading: tracksLoading, fetchTracks } = useTracks();
  const { profile: difficultyProfile } = useDifficultyProfile();
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  useEffect(() => {
    fetchTracks(accessCode?.code ?? null);
  }, [accessCode?.code, fetchTracks]);

  const handleScenarioClick = (scenario: Scenario) => {
    setSelectedScenario(scenario);
  };

  const handleModeStart = (mode: SessionMode, durationSeconds: number, voiceOverride?: AiVoice, presentationData?: PresentationData) => {
    if (selectedScenario) {
      navigate(`/session/${selectedScenario.id}`, {
        state: { sessionMode: mode, durationSeconds, voiceOverride, presentationData }
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
                    onClick={() => navigate('/admin/tracks')}
                    className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
                  >
                    Esteiras
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

        {/* Training Tracks Section */}
        {(tracksLoading || tracks.length > 0) && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-yellow-400 border border-black" />
              Esteiras de Treinamento
            </h2>
            {tracksLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-48 bg-gray-100 border-2 border-black animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {tracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onClick={() => navigate(`/tracks/${track.slug}`)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* All Scenarios Section */}
        <section>
          {tracks.length > 0 && (
            <h2 className="text-lg font-bold text-black uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-black" />
              Todos os Cenarios
            </h2>
          )}
          <ScenarioList
            scenarios={scenarios}
            loading={loading}
            onScenarioClick={handleScenarioClick}
          />
        </section>
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
