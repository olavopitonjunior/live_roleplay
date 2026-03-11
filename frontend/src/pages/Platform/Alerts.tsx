import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  details: Record<string, any> | null;
  is_acknowledged: boolean;
  created_at: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-900/50 text-blue-400 border-2 border-blue-800',
  warning: 'bg-yellow-900/50 text-yellow-400 border-2 border-yellow-800',
  critical: 'bg-red-900/50 text-red-400 border-2 border-red-800',
};

export function PlatformAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAcked, setShowAcked] = useState(false);

  useEffect(() => {
    async function fetch() {
      let query = supabase
        .from('platform_alerts')
        .select('id, alert_type, severity, title, details, is_acknowledged, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!showAcked) query = query.eq('is_acknowledged', false);

      const { data } = await query;
      setAlerts((data || []) as Alert[]);
      setLoading(false);
    }
    fetch();
  }, [showAcked]);

  const handleAck = async (id: string) => {
    const { error } = await supabase
      .from('platform_alerts')
      .update({ is_acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) setAlerts(alerts.filter(a => a.id !== id));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Alertas</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={showAcked}
                onChange={(e) => setShowAcked(e.target.checked)}
                className="border-[#333] bg-[#111]"
              />
              Mostrar confirmados
            </label>
            <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
              Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-[#111] border-2 border-[#333] p-8 text-center shadow-[4px_4px_0px_#333]">
            <p className="text-gray-500">Nenhum alerta {showAcked ? '' : 'pendente'}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 shadow-[4px_4px_0px_#333] ${SEVERITY_COLORS[alert.severity] || 'bg-[#111] border-2 border-[#333]'}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono uppercase tracking-wider">{alert.alert_type}</span>
                    <span className="text-xs opacity-70 uppercase tracking-wider">{alert.severity}</span>
                  </div>
                  <p className="text-sm font-bold">{alert.title}</p>
                  {alert.details && (
                    <pre className="text-xs opacity-60 mt-1 max-w-lg truncate font-mono">
                      {JSON.stringify(alert.details)}
                    </pre>
                  )}
                  <p className="text-xs opacity-50 mt-1 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatTime(alert.created_at)}</p>
                </div>
                {!alert.is_acknowledged && (
                  <button
                    onClick={() => handleAck(alert.id)}
                    className="text-xs px-3 py-1 bg-yellow-400 text-black font-bold uppercase tracking-wider hover:bg-yellow-300 flex-shrink-0 shadow-[2px_2px_0px_#333]"
                  >
                    Confirmar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default PlatformAlerts;
