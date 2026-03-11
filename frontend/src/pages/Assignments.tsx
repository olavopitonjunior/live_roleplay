import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui';

interface MyAssignment {
  id: string;
  scenario_id: string;
  scenario_title: string;
  due_date: string | null;
  target_score: number | null;
  target_mode: string;
  status: string;
  completed_at: string | null;
  assigned_by_name: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluida',
  overdue: 'Atrasada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

export function Assignments() {
  const navigate = useNavigate();
  const { user, orgId } = useAuth();
  const profileId = user?.id;
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId || !orgId) return;

    async function fetch() {
      const { data } = await supabase
        .from('scenario_assignments')
        .select(`
          id, scenario_id, due_date, target_score, target_mode, status, completed_at, created_at,
          scenarios(title),
          assigner:user_profiles!scenario_assignments_assigned_by_fkey(full_name)
        `)
        .eq('assigned_to', profileId!)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false });

      setAssignments((data || []).map((a: any) => ({
        id: a.id,
        scenario_id: a.scenario_id,
        scenario_title: a.scenarios?.title || 'Sem titulo',
        due_date: a.due_date,
        target_score: a.target_score,
        target_mode: a.target_mode,
        status: a.status,
        completed_at: a.completed_at,
        assigned_by_name: a.assigner?.full_name || '',
        created_at: a.created_at,
      })));
      setLoading(false);
    }

    fetch();
  }, [profileId, orgId]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  const pending = assignments.filter(a => a.status === 'pending' || a.status === 'overdue');
  const completed = assignments.filter(a => a.status === 'completed');

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-black">Minhas Tarefas</h1>
          <Button variant="secondary" size="sm" onClick={() => navigate('/home')}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <p className="text-gray-500">Nenhuma tarefa atribuida</p>
          </div>
        ) : (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-black mb-3 uppercase tracking-wider">Pendentes ({pending.length})</h2>
                <div className="space-y-3">
                  {pending.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white border-2 border-black p-4 cursor-pointer hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_#000]"
                      onClick={() => navigate(`/session/${a.scenario_id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-black">{a.scenario_title}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status]}`}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        {a.due_date && (
                          <span className={new Date(a.due_date) < new Date() ? 'text-red-500' : ''}>
                            Prazo: {formatDate(a.due_date)}
                          </span>
                        )}
                        {a.target_score && <span style={{ fontFamily: "'Space Mono', monospace" }}>Score alvo: {a.target_score}%</span>}
                        <span>Por: {a.assigned_by_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-black mb-3 uppercase tracking-wider">Concluidas ({completed.length})</h2>
                <div className="space-y-2">
                  {completed.map((a) => (
                    <div key={a.id} className="bg-white border-2 border-black p-4 opacity-70 shadow-[4px_4px_0px_#000]">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-black">{a.scenario_title}</p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                          Concluida
                        </span>
                      </div>
                      {a.completed_at && (
                        <p className="text-xs text-gray-400 mt-1">Concluida em {formatDate(a.completed_at)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Assignments;
