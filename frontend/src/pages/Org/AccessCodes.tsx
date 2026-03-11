import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface AccessCodeRow {
  id: string;
  code: string;
  label: string | null;
  is_active: boolean;
  current_uses: number;
  max_uses: number | null;
  max_unique_users: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export function OrgAccessCodes() {
  const navigate = useNavigate();
  const { orgId } = useAuth();
  const [codes, setCodes] = useState<AccessCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpDays, setNewExpDays] = useState('14');
  const [creating, setCreating] = useState(false);

  const fetchCodes = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('access_codes')
      .select('id, code, label, is_active, current_uses, max_uses, max_unique_users, expires_at, revoked_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    setCodes((data as AccessCodeRow[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreate = async () => {
    if (!orgId) return;
    setCreating(true);

    const code = generateCode();
    const expiresAt = newExpDays
      ? new Date(Date.now() + parseInt(newExpDays) * 86400000).toISOString()
      : null;

    const { error } = await supabase.from('access_codes').insert({
      org_id: orgId,
      code,
      label: newLabel.trim() || null,
      is_active: true,
      is_admin: false,
      max_uses: newMaxUses ? parseInt(newMaxUses) : null,
      expires_at: expiresAt,
    });

    if (!error) {
      setNewLabel('');
      setNewMaxUses('');
      setNewExpDays('14');
      setShowCreate(false);
      fetchCodes();
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar este codigo? Usuarios atuais nao serao afetados.')) return;
    const { error } = await supabase
      .from('access_codes')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) fetchCodes();
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  const isExpired = (code: AccessCodeRow) => {
    if (!code.expires_at) return false;
    return new Date(code.expires_at) < new Date();
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Codigos de Acesso</h1>
            <p className="text-sm text-gray-500">{codes.filter(c => c.is_active).length} ativo{codes.filter(c => c.is_active).length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => setShowCreate(!showCreate)}>
              Novo codigo
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {showCreate && (
          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
            <h3 className="font-medium text-black mb-3 uppercase tracking-wider">Criar codigo de acesso</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Label (opcional)</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ex: Turma Marco"
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Limite de usos</label>
                <input
                  type="number"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                  placeholder="Ilimitado"
                  min={1}
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Expira em (dias)</label>
                <input
                  type="number"
                  value={newExpDays}
                  onChange={(e) => setNewExpDays(e.target.value)}
                  placeholder="14"
                  min={1}
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="mt-3">
              <Button variant="primary" size="sm" loading={creating} onClick={handleCreate}>
                Gerar codigo
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : codes.length === 0 ? (
          <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_#000]">
            <p className="text-gray-500">Nenhum codigo de acesso criado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => {
              const expired = isExpired(code);
              const active = code.is_active && !expired;
              return (
                <div
                  key={code.id}
                  className={`bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] ${!active ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <code className="text-lg font-mono font-bold text-black bg-white px-3 py-1 border-2 border-black">
                        {code.code}
                      </code>
                      {code.label && (
                        <span className="text-sm text-gray-500">{code.label}</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        active ? 'bg-green-100 text-green-800' :
                        expired ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {active ? 'Ativo' : expired ? 'Expirado' : 'Revogado'}
                      </span>
                    </div>
                    {active && (
                      <button
                        onClick={() => handleRevoke(code.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Revogar
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span style={{ fontFamily: "'Space Mono', monospace" }}>Usos: {code.current_uses}{code.max_uses ? `/${code.max_uses}` : ''}</span>
                    {code.expires_at && <span>Expira: {formatDate(code.expires_at)}</span>}
                    <span>Criado: {formatDate(code.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default OrgAccessCodes;
