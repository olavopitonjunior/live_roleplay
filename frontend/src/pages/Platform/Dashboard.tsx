import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  sessions_24h: number;
  mrr_cents: number;
  unacked_alerts: number;
}

export function PlatformDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // Try materialized view first
      const { data } = await supabase
        .from('mv_platform_overview')
        .select('*')
        .single();

      if (data) {
        setStats(data as PlatformStats);
      } else {
        // Fallback to manual counts
        const [orgs, users, alerts] = await Promise.all([
          supabase.from('organizations').select('id, status', { count: 'exact' }),
          supabase.from('user_profiles').select('id', { count: 'exact' }).eq('is_active', true),
          supabase.from('platform_alerts').select('id', { count: 'exact' }).eq('is_acknowledged', false),
        ]);

        setStats({
          total_tenants: orgs.count || 0,
          active_tenants: orgs.count || 0,
          total_users: users.count || 0,
          sessions_24h: 0,
          mrr_cents: 0,
          unacked_alerts: alerts.count || 0,
        });
      }
      setLoading(false);
    }

    fetchStats();
  }, []);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const statCards = stats ? [
    { label: 'Tenants ativos', value: stats.active_tenants, sub: `${stats.total_tenants} total` },
    { label: 'Usuarios', value: stats.total_users },
    { label: 'Sessoes (24h)', value: stats.sessions_24h },
    { label: 'MRR', value: formatCurrency(stats.mrr_cents) },
    { label: 'Alertas', value: stats.unacked_alerts, alert: stats.unacked_alerts > 0 },
  ] : [];

  const navItems = [
    { label: 'Tenants', path: '/platform/tenants', desc: 'Gerenciar organizacoes' },
    { label: 'Planos', path: '/platform/plans', desc: 'Precos e versoes' },
    { label: 'Leads', path: '/platform/leads', desc: 'Pipeline de signup' },
    { label: 'Custos', path: '/platform/costs', desc: 'Custos por tenant' },
    { label: 'Saude', path: '/platform/health', desc: 'Metricas do sistema' },
    { label: 'Alertas', path: '/platform/alerts', desc: 'Alertas e incidentes' },
    { label: 'Cenarios', path: '/platform/scenarios', desc: 'Templates da plataforma' },
    { label: 'Audit', path: '/platform/audit', desc: 'Log de acoes staff' },
    { label: 'Staff', path: '/platform/staff', desc: 'Usuarios da plataforma' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider">Platform Admin</h1>
            <p className="text-xs text-gray-400">Live Roleplay</p>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/platform/login'); }}
            className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`bg-[#111] border-2 p-5 shadow-[4px_4px_0px_#333] ${
                  (card as any).alert ? 'border-red-500' : 'border-[#333]'
                }`}
              >
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wider">{card.label}</p>
                <p className="text-2xl font-bold font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{card.value}</p>
                {(card as any).sub && <p className="text-xs text-gray-500 mt-1">{(card as any).sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="bg-[#111] border-2 border-[#333] p-5 text-left hover:border-yellow-400 transition-colors shadow-[4px_4px_0px_#333] hover:shadow-[4px_4px_0px_#ca8a04]"
            >
              <h3 className="font-bold text-white mb-1 uppercase tracking-wider">{item.label}</h3>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export default PlatformDashboard;
