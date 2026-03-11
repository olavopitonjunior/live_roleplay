import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface PlanVersion {
  id: string;
  version_number: number;
  status: string;
  base_fee_cents: number;
  currency: string;
  billing_interval: string;
  included_sessions: number;
  included_tokens: number;
  overage_per_session_cents: number;
  features: Record<string, any>;
  changelog: string | null;
  published_at: string | null;
  created_at: string;
}

interface PlanInfo {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
}

export function PlatformPlanEditor() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;

    async function fetch() {
      const [{ data: planData }, { data: versionData }] = await Promise.all([
        supabase.from('plans').select('id, slug, display_name, description').eq('id', planId!).single(),
        supabase.from('plan_versions').select('*').eq('plan_id', planId!).order('version_number', { ascending: false }),
      ]);

      if (planData) setPlan(planData as PlanInfo);
      setVersions((versionData || []) as PlanVersion[]);
      setLoading(false);
    }

    fetch();
  }, [planId]);

  const formatCurrency = (cents: number, currency = 'brl') =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

  const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-[#111] text-gray-300 border border-[#333]',
    published: 'bg-green-900/50 text-green-400 border border-[#333]',
    sunset: 'bg-yellow-900/50 text-yellow-400 border border-[#333]',
    archived: 'bg-red-900/50 text-red-400 border border-[#333]',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider">{plan?.display_name || 'Plano'}</h1>
            <p className="text-xs text-gray-400 font-mono">{plan?.slug}</p>
          </div>
          <button onClick={() => navigate('/platform/plans')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {versions.map((v) => (
          <div key={v.id} className="bg-[#111] border-2 border-[#333] p-5 shadow-[4px_4px_0px_#333]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-bold font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>v{v.version_number}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] || 'bg-[#111] border border-[#333]'}`}>
                  {v.status}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{new Date(v.created_at).toLocaleDateString('pt-BR')}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Preco base</p>
                <p className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(v.base_fee_cents, v.currency)}/{v.billing_interval}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Sessoes inclusas</p>
                <p className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{v.included_sessions || 'Ilimitado'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Excedente/sessao</p>
                <p className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatCurrency(v.overage_per_session_cents, v.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Tokens inclusos</p>
                <p className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{v.included_tokens || 'Ilimitado'}</p>
              </div>
            </div>

            {v.features && Object.keys(v.features).length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-yellow-400 uppercase tracking-wider">Features JSON</summary>
                <pre className="text-xs text-gray-300 bg-gray-950 p-3 border border-[#333] mt-2 overflow-auto max-h-32 font-mono">
                  {JSON.stringify(v.features, null, 2)}
                </pre>
              </details>
            )}

            {v.changelog && (
              <p className="text-xs text-gray-400 mt-2">Changelog: {v.changelog}</p>
            )}
          </div>
        ))}

        {versions.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhuma versao encontrada</p>
        )}
      </main>
    </div>
  );
}

export default PlatformPlanEditor;
