import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface PlanRow {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  is_public: boolean;
  is_archived: boolean;
  sort_order: number;
  version_count?: number;
  active_subscribers?: number;
}

export function PlatformPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('plans')
        .select('id, slug, display_name, description, is_public, is_archived, sort_order')
        .order('sort_order');

      setPlans((data || []) as PlanRow[]);
      setLoading(false);
    }
    fetch();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Planos</h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-[#111] border-2 border-[#333] p-5 cursor-pointer hover:border-yellow-400 shadow-[4px_4px_0px_#333] hover:shadow-[4px_4px_0px_#ca8a04] transition-colors"
                onClick={() => navigate(`/platform/plans/${plan.id}`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold">{plan.display_name}</h3>
                    <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{plan.slug}</span>
                    {!plan.is_public && <span className="text-xs bg-[#111] text-gray-400 px-2 py-0.5 border border-[#333]">Privado</span>}
                    {plan.is_archived && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 border border-[#333]">Arquivado</span>}
                  </div>
                </div>
                {plan.description && <p className="text-sm text-gray-400">{plan.description}</p>}
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nenhum plano cadastrado</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformPlans;
