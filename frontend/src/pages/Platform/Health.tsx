import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface HealthMetric {
  metric_name: string;
  metric_value: number;
  recorded_at: string;
}

export function PlatformHealth() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('system_health_metrics')
        .select('metric_name, metric_value, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(50);

      setMetrics((data || []) as HealthMetric[]);
      setLoading(false);
    }
    fetch();
  }, []);

  // Group by metric name, show latest value
  const latestByName = new Map<string, HealthMetric>();
  metrics.forEach((m) => {
    if (!latestByName.has(m.metric_name)) latestByName.set(m.metric_name, m);
  });

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Saude do Sistema</h1>
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
        ) : latestByName.size === 0 ? (
          <div className="bg-[#111] border-2 border-[#333] p-8 text-center shadow-[4px_4px_0px_#333]">
            <p className="text-gray-500">Nenhuma metrica de saude registrada.</p>
            <p className="text-xs text-gray-600 mt-2">Metricas serao populadas automaticamente via pg_cron.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from(latestByName.entries()).map(([name, metric]) => (
              <div key={name} className="bg-[#111] border-2 border-[#333] p-5 shadow-[4px_4px_0px_#333]">
                <p className="text-xs text-gray-400 mb-1 font-mono uppercase tracking-wider">{name}</p>
                <p className="text-2xl font-bold font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{metric.metric_value.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatTime(metric.recorded_at)}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformHealth;
