import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  user_count?: number;
  session_count_30d?: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900/50 text-green-400 border border-[#333]',
  trialing: 'bg-blue-900/50 text-blue-400 border border-[#333]',
  grace_period: 'bg-yellow-900/50 text-yellow-400 border border-[#333]',
  suspended: 'bg-red-900/50 text-red-400 border border-[#333]',
  deletion_pending: 'bg-[#111] text-gray-400 border border-[#333]',
};

export function PlatformTenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function fetchTenants() {
      // Try health view
      const { data: healthData } = await supabase
        .from('mv_tenant_health')
        .select('*')
        .order('created_at', { ascending: false });

      if (healthData && healthData.length > 0) {
        setTenants(healthData as TenantRow[]);
      } else {
        // Fallback
        const { data } = await supabase
          .from('organizations')
          .select('id, name, slug, status, created_at')
          .order('created_at', { ascending: false });

        setTenants((data || []) as TenantRow[]);
      }
      setLoading(false);
    }

    fetchTenants();
  }, []);

  const filtered = tenants.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    }
    return true;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Tenants</h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou slug..."
            className="flex-1 px-3 py-2 bg-[#111] border-2 border-[#333] text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#111] border-2 border-[#333] text-white"
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="trialing">Trial</option>
            <option value="suspended">Suspenso</option>
            <option value="grace_period">Grace Period</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          <div className="bg-[#111] border-2 border-[#333] overflow-hidden shadow-[4px_4px_0px_#333]">
            <table className="w-full">
              <thead className="border-b-2 border-[#333]">
                <tr>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Organizacao</th>
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Usuarios</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Sessoes (30d)</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]/50">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-yellow-400/5 cursor-pointer"
                    onClick={() => navigate(`/platform/tenants/${t.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] || 'bg-[#111] text-gray-400 border border-[#333]'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{t.user_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{t.session_count_30d ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhum tenant encontrado</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformTenants;
