import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface AuditEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_id: string | null;
  user_email?: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Criou',
  update: 'Atualizou',
  delete: 'Excluiu',
  login: 'Login',
  logout: 'Logout',
  invite: 'Convidou',
  role_change: 'Mudou papel',
  deactivate: 'Desativou',
  activate: 'Ativou',
};

export function OrgAuditLog() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (!orgId) return;

    async function fetchLogs() {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, user_id, old_value, new_value, ip_address, created_at')
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data } = await query;
      setEntries((data as AuditEntry[]) || []);
      setLoading(false);
    }

    fetchLogs();
  }, [orgId, actionFilter, page]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-black">Audit Log</h1>
          <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
            Voltar
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          >
            <option value="all">Todas as acoes</option>
            <option value="create">Criacao</option>
            <option value="update">Atualizacao</option>
            <option value="delete">Exclusao</option>
            <option value="login">Login</option>
            <option value="role_change">Mudanca de papel</option>
            <option value="invite">Convite</option>
          </select>
        </div>

        {/* Log entries */}
        <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">Nenhum registro encontrado</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                      <span className="text-xs text-gray-400 bg-white px-2 py-0.5 border border-black">
                        {entry.resource_type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{formatTime(entry.created_at)}</span>
                  </div>

                  {(entry.old_value || entry.new_value) && (
                    <div className="mt-1 text-xs text-gray-500 font-mono bg-white p-2 border border-black max-h-20 overflow-auto">
                      {entry.old_value && (
                        <div className="text-red-500">- {JSON.stringify(entry.old_value)}</div>
                      )}
                      {entry.new_value && (
                        <div className="text-green-600">+ {JSON.stringify(entry.new_value)}</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {entry.resource_id && <span>ID: {entry.resource_id.substring(0, 8)}</span>}
                    {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-500" style={{ fontFamily: "'Space Mono', monospace" }}>Pagina {page + 1}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={entries.length < PAGE_SIZE}
            >
              Proxima
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

export default OrgAuditLog;
