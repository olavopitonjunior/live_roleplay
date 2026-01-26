import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';
import type { SessionWithRelations } from '../types';

export function History() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const [sessions, setSessions] = useState<SessionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessCode) return;

    const fetchHistory = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('sessions')
          .select(
            `
            *,
            scenario:scenarios(id, title),
            feedback:feedbacks(id, score, summary)
          `
          )
          .eq('access_code_id', accessCode.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false });

        if (fetchError) throw fetchError;

        const formattedSessions = (data || []).map((s: any) => ({
          ...s,
          feedback: s.feedback?.[0] || null,
        }));

        setSessions(formattedSessions);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar historico'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [accessCode]);

  const stats = useMemo(() => {
    const withScores = sessions.filter((s) => s.feedback?.score != null);
    const scores = withScores.map((s) => s.feedback!.score);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const best = scores.length > 0 ? Math.max(...scores) : 0;
    return { total: sessions.length, average: avg, best };
  }, [sessions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-400 bg-gray-100';
    if (score >= 70) return 'text-black bg-yellow-100';
    if (score >= 50) return 'text-gray-700 bg-gray-100';
    return 'text-red-700 bg-red-100';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="text-gray-600 hover:text-black transition-colors"
            >
              ← Voltar
            </button>
            <h1 className="text-xl font-bold text-black">Meu Historico</h1>
          </div>
          <span className="text-sm text-gray-500">{sessions.length} sessoes</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="bg-gray-100 rounded-lg h-32 animate-pulse" />

            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg p-5 border border-gray-200 animate-pulse">
                <div className="flex justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-2/3" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                  <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-bold text-black mb-2">Erro ao carregar</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Tentar novamente
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-bold text-black mb-2">
              Nenhuma sessao ainda
            </h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Suas sessoes de treinamento aparecerao aqui depois que voce completar seu primeiro treino.
            </p>
            <Button onClick={() => navigate('/home')} variant="primary" size="lg">
              Iniciar Treinamento
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Overview Card */}
            <div className="bg-black rounded-lg p-6 text-white">
              <h3 className="font-semibold mb-4">Sua evolucao</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-4xl font-bold text-yellow-400">{stats.total}</p>
                  <p className="text-white/70 text-sm">Treinos</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-yellow-400">{stats.average}</p>
                  <p className="text-white/70 text-sm">Media</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-yellow-400">{stats.best}</p>
                  <p className="text-white/70 text-sm">Melhor</p>
                </div>
              </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-3">
              {sessions.map((session) => {
                const scoreColor = getScoreColor(session.feedback?.score);
                return (
                  <button
                    key={session.id}
                    onClick={() => navigate(`/feedback/${session.id}`)}
                    className="w-full bg-white rounded-lg p-5 border border-gray-200
                               hover:border-yellow-400 transition-colors text-left"
                  >
                    <div className="flex items-start gap-4">
                      {/* Score Badge */}
                      <div className={`flex-shrink-0 w-16 h-16 rounded-lg ${scoreColor}
                                      flex items-center justify-center`}>
                        <span className="text-2xl font-bold">
                          {session.feedback?.score ?? '--'}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-black truncate">
                          {session.scenario?.title || 'Cenario desconhecido'}
                        </h3>

                        <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                          <span>{formatDate(session.started_at)}</span>
                          <span>{formatDuration(session.duration_seconds)}</span>
                        </div>

                        {session.feedback?.summary && (
                          <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                            {session.feedback.summary}
                          </p>
                        )}
                      </div>

                      <span className="text-gray-400 flex-shrink-0">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
