import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface CostRow {
  org_id: string;
  org_name?: string;
  snapshot_date: string;
  sessions_count: number;
  total_cost_cents: number;
  total_revenue_cents: number;
  margin_cents: number;
  openai_realtime_cost_cents: number;
  claude_cost_cents: number;
  livekit_cost_cents: number;
}

export function PlatformCosts() {
  const navigate = useNavigate();
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      // Try materialized view
      const { data } = await supabase
        .from('mv_platform_cost_breakdown')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        setCosts(data as CostRow[]);
      } else {
        // Fallback to tenant_cost_snapshots
        const { data: snaps } = await supabase
          .from('tenant_cost_snapshots')
          .select('*, organizations(name)')
          .order('snapshot_date', { ascending: false })
          .limit(100);

        setCosts((snaps || []).map((s: any) => ({
          ...s,
          org_name: s.organizations?.name,
        })));
      }
      setLoading(false);
    }
    fetch();
  }, []);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const totalCost = costs.reduce((sum, c) => sum + c.total_cost_cents, 0);
  const totalRevenue = costs.reduce((sum, c) => sum + c.total_revenue_cents, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Custos por Tenant</h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#111] border-2 border-[#333] p-5 shadow-[4px_4px_0px_#333]">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Custo total</p>
            <p className="text-xl font-bold text-red-400 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(totalCost)}</p>
          </div>
          <div className="bg-[#111] border-2 border-[#333] p-5 shadow-[4px_4px_0px_#333]">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Receita total</p>
            <p className="text-xl font-bold text-green-400 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-[#111] border-2 border-[#333] p-5 shadow-[4px_4px_0px_#333]">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Margem</p>
            <p className={`text-xl font-bold font-mono ${totalRevenue - totalCost >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Space Mono', monospace" }}>
              {formatCurrency(totalRevenue - totalCost)}
            </p>
          </div>
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
                  <th className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Tenant</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Data</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Sessoes</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">OpenAI</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Claude</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">LiveKit</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Total</th>
                  <th className="text-right text-xs font-bold text-gray-400 uppercase tracking-wider px-4 py-3">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#333]/50">
                {costs.map((c, i) => (
                  <tr key={i} className="hover:bg-yellow-400/5">
                    <td className="px-4 py-2 text-sm">{c.org_name || c.org_id.substring(0, 8)}</td>
                    <td className="px-4 py-2 text-right text-xs text-gray-400 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{c.snapshot_date}</td>
                    <td className="px-4 py-2 text-right text-sm font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{c.sessions_count}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(c.openai_realtime_cost_cents)}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(c.claude_cost_cents)}</td>
                    <td className="px-4 py-2 text-right text-xs font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(c.livekit_cost_cents)}</td>
                    <td className="px-4 py-2 text-right text-sm font-medium font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(c.total_cost_cents)}</td>
                    <td className={`px-4 py-2 text-right text-sm font-mono ${c.margin_cents >= 0 ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: "'Space Mono', monospace" }}>
                      {formatCurrency(c.margin_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {costs.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhum dado de custo encontrado</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformCosts;
