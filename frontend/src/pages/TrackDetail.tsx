import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTracks } from '../hooks/useTracks';
import { useDifficultyProfile } from '../hooks/useDifficultyProfile';
import { TrackDetail as TrackDetailComponent } from '../components/Tracks/TrackDetail';
import { ModeSelectionModal } from '../components/Scenarios';
import type { TrainingTrack, Scenario, SessionMode, AiVoice, TrackContext, PresentationData } from '../types';

export function TrackDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { fetchTrackDetail } = useTracks();
  const { profile: difficultyProfile } = useDifficultyProfile();
  const [track, setTrack] = useState<TrainingTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedTrackContext, setSelectedTrackContext] = useState<TrackContext | null>(null);

  useEffect(() => {
    if (slug) {
      setLoading(true);
      fetchTrackDetail(accessCode?.code ?? null, slug).then((data) => {
        setTrack(data);
        setLoading(false);
      });
    }
  }, [slug, accessCode?.code, fetchTrackDetail]);

  const handleStartScenario = (scenarioId: string, trackScenarioId: string, position: number) => {
    if (!track) return;
    const ts = track.track_scenarios?.find((t) => t.scenario_id === scenarioId);
    const scenario = ts?.scenarios;
    if (!scenario) return;

    setSelectedScenario(scenario);
    setSelectedTrackContext({
      trackScenarioId,
      trackId: track.id,
      trackSlug: track.slug,
      trackTitle: track.title,
      position,
      total: track.track_scenarios?.length ?? 0,
    });
  };

  const handleModeStart = (mode: SessionMode, durationSeconds: number, voiceOverride?: AiVoice, presentationData?: PresentationData) => {
    if (selectedScenario && selectedTrackContext) {
      navigate(`/session/${selectedScenario.id}`, {
        state: {
          sessionMode: mode,
          durationSeconds,
          voiceOverride,
          trackContext: selectedTrackContext,
          presentationData,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="border-2 border-black shadow-[4px_4px_0px_#000] px-6 py-4 flex items-center gap-3">
          <div className="w-3 h-3 bg-yellow-400 animate-pulse" />
          <span className="text-sm font-bold uppercase tracking-wider font-mono">Carregando esteira...</span>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="border-2 border-black shadow-[4px_4px_0px_#000] p-6 text-center">
          <p className="text-black font-bold mb-4">Esteira nao encontrada</p>
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-yellow-400 text-black font-bold border-2 border-black shadow-[4px_4px_0px_#000]
                       hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all uppercase tracking-wider"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="text-sm font-bold text-black hover:text-yellow-600 transition-colors uppercase tracking-wider"
          >
            &larr; Voltar
          </button>
          {selectedTrackContext && (
            <span className="text-xs font-mono text-gray-500">
              Cenario {selectedTrackContext.position} de {selectedTrackContext.total}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <TrackDetailComponent track={track} onStartScenario={handleStartScenario} />
      </main>

      {/* Mode Selection Modal */}
      {selectedScenario && (
        <ModeSelectionModal
          scenario={selectedScenario}
          onStart={handleModeStart}
          onCancel={() => {
            setSelectedScenario(null);
            setSelectedTrackContext(null);
          }}
          difficultyLevel={difficultyProfile?.current_level}
        />
      )}
    </div>
  );
}
