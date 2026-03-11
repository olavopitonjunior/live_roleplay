import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  industry: string | null;
  settings: Record<string, any>;
  created_at: string;
  trial_ends_at: string | null;
}

interface TenantUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

export function PlatformTenantDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!orgId) return;

    async function fetch() {
      const [{ data: org }, { data: userList }] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', orgId!).single(),
        supabase.from('user_profiles').select('id, email, full_name, role, is_active').eq('org_id', orgId!).order('created_at'),
      ]);

      if (org) setTenant(org as TenantInfo);
      setUsers((userList || []) as TenantUser[]);
      setLoading(false);
    }

    fetch();
  }, [orgId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!orgId) return;
    const confirmMsg = newStatus === 'suspended'
      ? 'Suspender este tenant? Usuarios perderao acesso imediatamente.'
      : `Mudar status para "${newStatus}"?`;
    if (!confirm(confirmMsg)) return;

    setActionLoading(true);
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === 'suspended') updates.suspended_at = new Date().toISOString();
    if (newStatus === 'active') { updates.suspended_at = null; updates.suspension_reason = null; }

    const { error } = await supabase.from('organizations').update(updates).eq('id', orgId);
    if (!error && tenant) setTenant({ ...tenant, status: newStatus });
    setActionLoading(false);
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Tenant nao encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wider">{tenant.name}</h1>
            <p className="text-xs text-gray-400 font-mono">{tenant.slug}</p>
          </div>
          <button onClick={() => navigate('/platform/tenants')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Info */}
        <div className="bg-[#111] border-2 border-[#333] p-6 shadow-[4px_4px_0px_#333]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Status</p>
              <p className="text-sm font-medium font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{tenant.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Industria</p>
              <p className="text-sm">{tenant.industry || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Criado em</p>
              <p className="text-sm font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatDate(tenant.created_at)}</p>
            </div>
            {tenant.trial_ends_at && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Trial termina</p>
                <p className="text-sm font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatDate(tenant.trial_ends_at)}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {tenant.status !== 'suspended' && (
              <button
                onClick={() => handleStatusChange('suspended')}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-red-900/50 text-red-400 border border-[#333] hover:bg-red-900 disabled:opacity-50 font-bold uppercase tracking-wider"
              >
                Suspender
              </button>
            )}
            {tenant.status === 'suspended' && (
              <button
                onClick={() => handleStatusChange('active')}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-green-900/50 text-green-400 border border-[#333] hover:bg-green-900 disabled:opacity-50 font-bold uppercase tracking-wider"
              >
                Reativar
              </button>
            )}
          </div>
        </div>

        {/* Users */}
        <div className="bg-[#111] border-2 border-[#333] p-6 shadow-[4px_4px_0px_#333]">
          <h2 className="font-bold mb-4 uppercase tracking-wider">Usuarios ({users.length})</h2>
          <div className="divide-y divide-[#333]/50">
            {users.map((u) => (
              <div key={u.id} className={`py-2 flex items-center justify-between ${!u.is_active ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <span className="text-xs text-gray-400 border border-[#333] px-2 py-0.5">{u.role}</span>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-gray-500 py-2">Nenhum usuario</p>}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-[#111] border-2 border-[#333] p-6 shadow-[4px_4px_0px_#333]">
          <h2 className="font-bold mb-4 uppercase tracking-wider">Settings (JSON)</h2>
          <pre className="text-xs text-gray-300 bg-gray-950 p-4 border border-[#333] overflow-auto max-h-48 font-mono">
            {JSON.stringify(tenant.settings, null, 2)}
          </pre>
        </div>
      </main>
    </div>
  );
}

export default PlatformTenantDetail;
