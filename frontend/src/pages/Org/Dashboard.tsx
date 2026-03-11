import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface OrgStats {
  total_users: number;
  active_users_30d: number;
  total_sessions_30d: number;
  total_sessions_7d: number;
  avg_score_30d: number | null;
  avg_score_7d: number | null;
  total_assignments: number;
  completed_assignments: number;
  total_cost_cents_30d: number;
}

export function OrgDashboard() {
  const navigate = useNavigate();
  const { organization } = useAuth();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization?.id) return;

    async function fetchStats() {
      // Try materialized view first, fallback to direct query
      const { data, error } = await supabase
        .from('mv_org_dashboard_stats')
        .select('*')
        .eq('org_id', organization!.id)
        .single();

      if (!error && data) {
        setStats(data as OrgStats);
      }
      setLoading(false);
    }

    fetchStats();
  }, [organization?.id]);

  const statCards = [
    { label: 'Usuarios ativos', value: stats?.active_users_30d ?? 0, sub: `${stats?.total_users ?? 0} total` },
    { label: 'Sessoes (30d)', value: stats?.total_sessions_30d ?? 0, sub: `${stats?.total_sessions_7d ?? 0} ultimos 7d` },
    { label: 'Score medio', value: stats?.avg_score_30d ? `${Math.round(stats.avg_score_30d)}%` : '—', sub: stats?.avg_score_7d ? `${Math.round(stats.avg_score_7d)}% (7d)` : '' },
    { label: 'Tarefas concluidas', value: stats?.completed_assignments ?? 0, sub: `${stats?.total_assignments ?? 0} total` },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black">{organization?.name || 'Organizacao'}</h1>
              <p className="text-sm text-gray-500">Painel do administrador</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => navigate('/home')}>
                Voltar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/org/settings')}>
                Configuracoes
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
              <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-black" style={{ fontFamily: "'Space Mono', monospace" }}>{card.value}</p>
              {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => navigate('/org/users')}
            className="bg-white border-2 border-black p-5 text-left hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_#000]"
          >
            <h3 className="font-semibold text-black mb-1">Usuarios</h3>
            <p className="text-sm text-gray-500">Gerenciar equipe, convites e papeis</p>
          </button>

          <button
            onClick={() => navigate('/org/scenarios')}
            className="bg-white border-2 border-black p-5 text-left hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_#000]"
          >
            <h3 className="font-semibold text-black mb-1">Cenarios</h3>
            <p className="text-sm text-gray-500">Criar, editar e atribuir cenarios</p>
          </button>

          <button
            onClick={() => navigate('/org/billing')}
            className="bg-white border-2 border-black p-5 text-left hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_#000]"
          >
            <h3 className="font-semibold text-black mb-1">Faturamento</h3>
            <p className="text-sm text-gray-500">Plano, uso e faturas</p>
          </button>
        </div>

        {/* Navigation Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Times', path: '/org/teams' },
            { label: 'Analytics', path: '/org/analytics' },
            { label: 'Codigos de Acesso', path: '/org/access-codes' },
            { label: 'Audit Log', path: '/org/audit-log' },
            { label: 'API Dashboard', path: '/org/api-dashboard' },
            { label: 'Configuracoes', path: '/org/settings' },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-white border-2 border-black p-4 text-sm font-medium text-black hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_#000]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export default OrgDashboard;
