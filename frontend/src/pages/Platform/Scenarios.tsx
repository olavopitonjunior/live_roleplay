import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface PlatformScenario {
  id: string;
  title: string;
  category: string | null;
  session_type: string | null;
  is_active: boolean;
  is_template: boolean;
  created_at: string;
}

export function PlatformScenarios() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<PlatformScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('scenarios')
        .select('id, title, category, session_type, is_active, is_template, created_at')
        .is('org_id', null)
        .order('category')
        .order('title');

      setScenarios((data || []) as PlatformScenario[]);
      setLoading(false);
    }
    fetch();
  }, []);

  // Group by category
  const grouped = new Map<string, PlatformScenario[]>();
  scenarios.forEach((s) => {
    const cat = s.category || 'Sem categoria';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s);
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Cenarios da Plataforma <span className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>({scenarios.length})</span></h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          Array.from(grouped.entries()).map(([cat, items]) => (
            <section key={cat}>
              <h2 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-wider border-l-4 border-yellow-400 pl-3">{cat}</h2>
              <div className="space-y-2">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className={`bg-[#111] border-2 border-[#333] p-4 shadow-[4px_4px_0px_#333] ${!s.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {s.session_type && (
                            <span className="text-xs bg-[#111] text-gray-300 px-2 py-0.5 border border-[#333]">{s.session_type}</span>
                          )}
                          {s.is_template && (
                            <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 border border-[#333]">Template</span>
                          )}
                          {!s.is_active && (
                            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 border border-[#333]">Inativo</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{s.id.substring(0, 8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

export default PlatformScenarios;
