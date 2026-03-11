import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface MemberDetail {
  id: string;
  full_name: string;
  email: string;
  role: string;
  last_seen_at: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  scenario_title: string;
  started_at: string;
  status: string;
  duration_seconds: number | null;
  overall_score: number | null;
}

export function TeamMemberDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !orgId) return;

    async function fetchMember() {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, last_seen_at, created_at')
        .eq('id', userId!)
        .eq('org_id', orgId!)
        .single();

      if (profile) setMember(profile as MemberDetail);

      // Fetch recent sessions
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, started_at, status, duration_seconds, scenarios(title)')
        .eq('user_profile_id', userId!)
        .eq('org_id', orgId!)
        .order('started_at', { ascending: false })
        .limit(30);

      const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('session_id, overall_score')
        .in('session_id', (sessionData || []).map((s: any) => s.id).length > 0
          ? (sessionData || []).map((s: any) => s.id) : ['none']);

      const scoreMap = new Map<string, number>();
      (feedbacks || []).forEach((f: any) => {
        if (f.overall_score != null) scoreMap.set(f.session_id, f.overall_score);
      });

      setSessions((sessionData || []).map((s: any) => ({
        id: s.id,
        scenario_title: s.scenarios?.title || 'Sem titulo',
        started_at: s.started_at,
        status: s.status,
        duration_seconds: s.duration_seconds,
        overall_score: scoreMap.get(s.id) ?? null,
      })));

      setLoading(false);
    }

    fetchMember();
  }, [userId, orgId]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const avgScore = (() => {
    const scores = sessions.map(s => s.overall_score).filter((s): s is number => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  })();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">{member?.full_name || 'Membro'}</h1>
            <p className="text-sm text-gray-500">{member?.email}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/team/dashboard')}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Sessoes recentes</p>
                <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{sessions.length}</p>
              </div>
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Score medio</p>
                <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{avgScore != null ? `${avgScore}%` : '—'}</p>
              </div>
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Membro desde</p>
                <p className="text-lg font-bold text-black">{member ? formatDate(member.created_at) : '—'}</p>
              </div>
            </div>

            {/* Session history */}
            <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
              <h2 className="font-semibold text-black px-4 py-3 border-b-2 border-black uppercase tracking-wider">Sessoes recentes</h2>
              {sessions.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">Nenhuma sessao encontrada</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                      onClick={() => navigate(`/feedback/${s.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium text-black">{s.scenario_title}</p>
                        <p className="text-xs text-gray-400">
                          {formatDate(s.started_at)}
                          {s.duration_seconds ? ` · ${formatDuration(s.duration_seconds)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.overall_score != null && (
                          <span className={`text-sm font-bold ${
                            s.overall_score >= 70 ? 'text-green-600' : s.overall_score >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                            {s.overall_score}%
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === 'completed' || s.status === 'ended' ? 'bg-green-100 text-green-800' :
                          s.status === 'active' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {s.status === 'completed' || s.status === 'ended' ? 'Concluida' :
                           s.status === 'active' ? 'Ativa' : s.status}
                        </span>
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

export default TeamMemberDetail;
