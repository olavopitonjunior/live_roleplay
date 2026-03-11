import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface AuditEntry {
  id: string;
  platform_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  tenant_id: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: string;
}

export function PlatformAudit() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('platform_audit_logs')
        .select('id, platform_user_id, action, resource_type, resource_id, tenant_id, old_value, new_value, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      setEntries((data || []) as AuditEntry[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Audit Log (Staff)</h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-[#111] border-2 border-[#333] p-8 text-center shadow-[4px_4px_0px_#333]">
            <p className="text-gray-500">Nenhum registro de auditoria</p>
          </div>
        ) : (
          <div className="bg-[#111] border-2 border-[#333] divide-y divide-[#333]/50 shadow-[4px_4px_0px_#333]">
            {entries.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-yellow-400/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{e.action}</span>
                    <span className="text-xs bg-[#111] text-gray-300 px-2 py-0.5 border border-[#333]">{e.resource_type}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatTime(e.created_at)}</span>
                </div>
                {(e.old_value || e.new_value) && (
                  <div className="text-xs font-mono bg-gray-950 p-2 border border-[#333] mt-1 max-h-20 overflow-auto">
                    {e.old_value && <div className="text-red-400">- {JSON.stringify(e.old_value)}</div>}
                    {e.new_value && <div className="text-green-400">+ {JSON.stringify(e.new_value)}</div>}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {e.resource_id && <span>Resource: {e.resource_id.substring(0, 8)}</span>}
                  {e.tenant_id && <span>Tenant: {e.tenant_id.substring(0, 8)}</span>}
                  <span>Staff: {e.platform_user_id.substring(0, 8)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformAudit;
