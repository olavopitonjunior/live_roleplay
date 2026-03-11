import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface Team {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  manager_name?: string;
  member_count: number;
  is_active: boolean;
  created_at: string;
}

export function OrgTeams() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTeams = useCallback(async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('teams')
      .select(`
        id, name, description, manager_id, is_active, created_at,
        manager:user_profiles!teams_manager_id_fkey(full_name),
        team_memberships(count)
      `)
      .eq('org_id', orgId)
      .order('name');

    const mapped = (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      manager_id: t.manager_id,
      manager_name: t.manager?.full_name || null,
      member_count: t.team_memberships?.[0]?.count || 0,
      is_active: t.is_active,
      created_at: t.created_at,
    }));

    setTeams(mapped);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleCreate = async () => {
    if (!newName.trim() || !orgId) return;
    setCreating(true);

    const { error } = await supabase.from('teams').insert({
      org_id: orgId,
      name: newName.trim(),
      description: newDesc.trim() || null,
    });

    if (!error) {
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      fetchTeams();
    }
    setCreating(false);
  };

  const handleDelete = async (teamId: string, teamName: string) => {
    if (!confirm(`Excluir time "${teamName}"? Os membros nao serao removidos da organizacao.`)) return;

    const { error } = await supabase.from('teams').delete().eq('id', teamId);
    if (!error) fetchTeams();
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Times</h1>
            <p className="text-sm text-gray-500">{teams.length} time{teams.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
              Criar time
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {showCreate && (
          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
            <h3 className="font-medium text-black mb-3 uppercase tracking-wider">Novo time</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nome</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Vendas SP"
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Descricao (opcional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Descricao do time"
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <Button variant="primary" size="sm" loading={creating} onClick={handleCreate}>
                Criar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <p className="text-gray-500 mb-2">Nenhum time criado</p>
            <p className="text-sm text-gray-400">Crie times para organizar seus usuarios e acompanhar desempenho por grupo.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className={`bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] ${!team.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-black">{team.name}</h3>
                  <button
                    onClick={() => handleDelete(team.id, team.name)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Excluir
                  </button>
                </div>
                {team.description && (
                  <p className="text-sm text-gray-500 mb-3">{team.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span style={{ fontFamily: "'Space Mono', monospace" }}>{team.member_count} membro{team.member_count !== 1 ? 's' : ''}</span>
                  {team.manager_name && <span>Gerente: {team.manager_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default OrgTeams;
