import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface TeamMemberStat {
  user_id: string;
  full_name: string;
  email: string;
  session_count: number;
  avg_score: number | null;
  last_session_at: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
}

export function TeamDashboard() {
  const navigate = useNavigate();
  const { orgId, user } = useAuth();
  const profileId = user?.id;
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMemberStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch teams where user is manager
  useEffect(() => {
    if (!orgId || !profileId) return;

    async function fetchTeams() {
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('org_id', orgId!)
        .eq('manager_id', profileId!)
        .eq('is_active', true);

      const teamList = (data || []) as TeamInfo[];
      setTeams(teamList);
      if (teamList.length > 0) setSelectedTeam(teamList[0].id);
      if (teamList.length === 0) setLoading(false);
    }

    fetchTeams();
  }, [orgId, profileId]);

  // Fetch members for selected team
  useEffect(() => {
    if (!selectedTeam) return;

    async function fetchMembers() {
      setLoading(true);

      const { data: memberships } = await supabase
        .from('team_memberships')
        .select('user_id, user_profiles(id, full_name, email)')
        .eq('team_id', selectedTeam!);

      const memberProfiles = (memberships || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.user_profiles?.full_name || '',
        email: m.user_profiles?.email || '',
      }));

      // Fetch session stats for each member (last 30 days)
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const userIds = memberProfiles.map(m => m.user_id);

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, user_profile_id, started_at')
        .in('user_profile_id', userIds.length > 0 ? userIds : ['none'])
        .gte('started_at', since)
        .in('status', ['completed', 'ended']);

      const { data: feedbacks } = await supabase
        .from('feedbacks')
        .select('session_id, overall_score')
        .in('session_id', (sessions || []).map((s: any) => s.id).length > 0
          ? (sessions || []).map((s: any) => s.id) : ['none']);

      const scoreMap = new Map<string, number>();
      (feedbacks || []).forEach((f: any) => {
        if (f.overall_score != null) scoreMap.set(f.session_id, f.overall_score);
      });

      const memberStats: TeamMemberStat[] = memberProfiles.map((m) => {
        const userSessions = (sessions || []).filter((s: any) => s.user_profile_id === m.user_id);
        const scores = userSessions.map((s: any) => scoreMap.get(s.id)).filter((s): s is number => s != null);
        const lastSession = userSessions.sort((a: any, b: any) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0];

        return {
          user_id: m.user_id,
          full_name: m.full_name,
          email: m.email,
          session_count: userSessions.length,
          avg_score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          last_session_at: lastSession?.started_at || null,
        };
      });

      setMembers(memberStats.sort((a, b) => b.session_count - a.session_count));
      setLoading(false);
    }

    fetchMembers();
  }, [selectedTeam]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  const teamAvgScore = (() => {
    const scores = members.map(m => m.avg_score).filter((s): s is number => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  })();

  const totalSessions = members.reduce((sum, m) => sum + m.session_count, 0);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Meu Time</h1>
            {teams.length > 1 && (
              <select
                value={selectedTeam || ''}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="mt-1 text-sm border-2 border-black px-2 py-1"
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate('/team/assignments')}>
              Tarefas
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/home')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {teams.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <p className="text-gray-500">Voce nao gerencia nenhum time.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Membros</p>
                <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{members.length}</p>
              </div>
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Sessoes (30d)</p>
                <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{totalSessions}</p>
              </div>
              <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Score medio</p>
                <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{teamAvgScore != null ? `${teamAvgScore}%` : '—'}</p>
              </div>
            </div>

            {/* Member table */}
            <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
              <table className="w-full">
                <thead className="bg-white border-b-2 border-black">
                  <tr>
                    <th className="text-left text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Membro</th>
                    <th className="text-center text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Sessoes</th>
                    <th className="text-center text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Score medio</th>
                    <th className="text-right text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Ultima sessao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((m) => (
                    <tr
                      key={m.user_id}
                      className="hover:bg-gray-100 cursor-pointer"
                      onClick={() => navigate(`/team/members/${m.user_id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-black">{m.full_name || '—'}</p>
                        <p className="text-xs text-gray-400">{m.email}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700" style={{ fontFamily: "'Space Mono', monospace" }}>{m.session_count}</td>
                      <td className="px-4 py-3 text-center">
                        {m.avg_score != null ? (
                          <span className={`text-sm font-medium ${
                            m.avg_score >= 70 ? 'text-green-600' : m.avg_score >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`} style={{ fontFamily: "'Space Mono', monospace" }}>
                            {m.avg_score}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">
                        {m.last_session_at ? formatDate(m.last_session_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default TeamDashboard;
