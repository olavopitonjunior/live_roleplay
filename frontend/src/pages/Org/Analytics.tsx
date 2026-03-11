import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface ScenarioStat {
  scenario_id: string;
  scenario_title: string;
  session_count: number;
  avg_score: number | null;
  completion_rate: number;
}

interface PeriodStats {
  total_sessions: number;
  avg_score: number | null;
  unique_users: number;
  total_duration_minutes: number;
}

export function OrgAnalytics() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [scenarioStats, setScenarioStats] = useState<ScenarioStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    async function fetchAnalytics() {
      setLoading(true);
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      // Aggregate session stats
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, started_at, duration_seconds, access_code_id, user_profile_id')
        .eq('org_id', orgId)
        .gte('started_at', since)
        .in('status', ['completed', 'ended']);

      const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('session_id, overall_score')
        .eq('org_id', orgId)
        .gte('created_at', since);

      const scoreMap = new Map<string, number>();
      (feedbacks || []).forEach((f: any) => {
        if (f.overall_score != null) scoreMap.set(f.session_id, f.overall_score);
      });

      const allSessions = sessions || [];
      const scores = allSessions.map(s => scoreMap.get(s.id)).filter((s): s is number => s != null);
      const userIds = new Set(allSessions.map(s => s.user_profile_id || s.access_code_id).filter(Boolean));
      const totalDur = allSessions.reduce((sum, s) => sum + ((s as any).duration_seconds || 0), 0);

      setStats({
        total_sessions: allSessions.length,
        avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        unique_users: userIds.size,
        total_duration_minutes: Math.round(totalDur / 60),
      });

      // Per-scenario breakdown
      const { data: scenarioSessions } = await supabase
        .from('sessions')
        .select('id, scenario_id, status, scenarios(title)')
        .eq('org_id', orgId)
        .gte('started_at', since);

      const scenarioMap = new Map<string, { title: string; total: number; completed: number; scores: number[] }>();

      (scenarioSessions || []).forEach((s: any) => {
        const sid = s.scenario_id;
        if (!sid) return;
        if (!scenarioMap.has(sid)) {
          scenarioMap.set(sid, {
            title: s.scenarios?.title || 'Sem titulo',
            total: 0,
            completed: 0,
            scores: [],
          });
        }
        const entry = scenarioMap.get(sid)!;
        entry.total++;
        if (s.status === 'completed' || s.status === 'ended') entry.completed++;
        const score = scoreMap.get(s.id);
        if (score != null) entry.scores.push(score);
      });

      const scenarioList: ScenarioStat[] = Array.from(scenarioMap.entries())
        .map(([id, d]) => ({
          scenario_id: id,
          scenario_title: d.title,
          session_count: d.total,
          avg_score: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : null,
          completion_rate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        }))
        .sort((a, b) => b.session_count - a.session_count);

      setScenarioStats(scenarioList);
      setLoading(false);
    }

    fetchAnalytics();
  }, [orgId, period]);

  const statCards = stats ? [
    { label: 'Sessoes', value: stats.total_sessions },
    { label: 'Score medio', value: stats.avg_score != null ? `${stats.avg_score}%` : '—' },
    { label: 'Usuarios ativos', value: stats.unique_users },
    { label: 'Tempo total', value: `${stats.total_duration_minutes}min` },
  ] : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Analytics</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border-2 border-black overflow-hidden">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    period === p ? 'bg-yellow-400 text-black' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => (
                <div key={card.label} className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                  <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Scenario breakdown */}
            <div className="bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000]">
              <h2 className="font-semibold text-black mb-4 uppercase tracking-wider">Desempenho por cenario</h2>
              {scenarioStats.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma sessao no periodo</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {scenarioStats.map((s) => (
                    <div key={s.scenario_id} className="py-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-black truncate">{s.scenario_title}</p>
                        <p className="text-xs text-gray-400">{s.session_count} sessao{s.session_count !== 1 ? 'es' : ''}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-gray-700" style={{ fontFamily: "'Space Mono', monospace" }}>{s.avg_score != null ? `${s.avg_score}%` : '—'}</p>
                          <p className="text-xs text-gray-400">score</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-700" style={{ fontFamily: "'Space Mono', monospace" }}>{s.completion_rate}%</p>
                          <p className="text-xs text-gray-400">conclusao</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default OrgAnalytics;
