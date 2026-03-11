import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface Assignment {
  id: string;
  scenario_id: string;
  scenario_title: string;
  assigned_to: string;
  assignee_name: string;
  assignee_email: string;
  due_date: string | null;
  target_score: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

interface ScenarioOption {
  id: string;
  title: string;
}

interface MemberOption {
  id: string;
  full_name: string;
  email: string;
}

export function TeamAssignments() {
  const navigate = useNavigate();
  const { orgId, user } = useAuth();
  const profileId = user?.id;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [newScenario, setNewScenario] = useState('');
  const [newMember, setNewMember] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newTargetScore, setNewTargetScore] = useState('');
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchAssignments = useCallback(async () => {
    if (!orgId) return;

    const { data } = await supabase
      .from('scenario_assignments')
      .select(`
        id, scenario_id, assigned_to, due_date, target_score, status, completed_at, created_at,
        scenarios(title),
        assignee:user_profiles!scenario_assignments_assigned_to_fkey(full_name, email)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    setAssignments((data || []).map((a: any) => ({
      id: a.id,
      scenario_id: a.scenario_id,
      scenario_title: a.scenarios?.title || 'Sem titulo',
      assigned_to: a.assigned_to,
      assignee_name: a.assignee?.full_name || '',
      assignee_email: a.assignee?.email || '',
      due_date: a.due_date,
      target_score: a.target_score,
      status: a.status,
      completed_at: a.completed_at,
      created_at: a.created_at,
    })));
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // Fetch options when create panel opens
  useEffect(() => {
    if (!showCreate || !orgId) return;

    async function fetchOptions() {
      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from('scenarios').select('id, title').eq('is_active', true).or(`org_id.eq.${orgId},org_id.is.null`),
        supabase.from('user_profiles').select('id, full_name, email').eq('org_id', orgId!).eq('is_active', true),
      ]);
      setScenarios((s || []) as ScenarioOption[]);
      setMembers((m || []) as MemberOption[]);
    }

    fetchOptions();
  }, [showCreate, orgId]);

  const handleCreate = async () => {
    if (!newScenario || !newMember || !orgId || !profileId) return;
    setCreating(true);

    const { error } = await supabase.from('scenario_assignments').insert({
      org_id: orgId,
      scenario_id: newScenario,
      assigned_to: newMember,
      assigned_by: profileId,
      due_date: newDueDate || null,
      target_score: newTargetScore ? parseInt(newTargetScore) : null,
    });

    if (!error) {
      setNewScenario('');
      setNewMember('');
      setNewDueDate('');
      setNewTargetScore('');
      setShowCreate(false);
      fetchAssignments();
    }
    setCreating(false);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em andamento',
    completed: 'Concluida',
    overdue: 'Atrasada',
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
  };

  const filtered = assignments.filter(a => statusFilter === 'all' || a.status === statusFilter);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-black">Tarefas</h1>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
              Nova tarefa
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/team/dashboard')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {showCreate && (
          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
            <h3 className="font-medium text-black mb-3 uppercase tracking-wider">Atribuir cenario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cenario</label>
                <select
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black"
                >
                  <option value="">Selecionar...</option>
                  {scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Membro</label>
                <select
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black"
                >
                  <option value="">Selecionar...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Data limite (opcional)</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-black"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Score alvo (opcional)</label>
                <input
                  type="number"
                  value={newTargetScore}
                  onChange={(e) => setNewTargetScore(e.target.value)}
                  min={0}
                  max={100}
                  placeholder="Ex: 70"
                  className="w-full px-3 py-2 border-2 border-black"
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="primary" size="sm" loading={creating} onClick={handleCreate}>
                Atribuir
              </Button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          {['all', 'pending', 'in_progress', 'completed', 'overdue'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium ${
                statusFilter === s ? 'bg-yellow-400 text-black border-2 border-black shadow-[4px_4px_0px_#000]' : 'bg-white border-2 border-black text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? 'Todas' : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        {/* Assignment list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <p className="text-gray-500">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => (
              <div key={a.id} className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-black">{a.scenario_title}</p>
                    <p className="text-xs text-gray-400">{a.assignee_name || a.assignee_email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  {a.due_date && <span>Prazo: {formatDate(a.due_date)}</span>}
                  {a.target_score && <span style={{ fontFamily: "'Space Mono', monospace" }}>Score alvo: {a.target_score}%</span>}
                  <span>Criada: {formatDate(a.created_at)}</span>
                  {a.completed_at && <span>Concluida: {formatDate(a.completed_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default TeamAssignments;
