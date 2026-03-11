import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';

interface OrgUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietario',
  admin: 'Administrador',
  manager: 'Gerente',
  trainer: 'Treinador',
  trainee: 'Treinando',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  trainer: 'bg-yellow-100 text-yellow-800',
  trainee: 'bg-gray-100 text-gray-600',
};

export function OrgUsers() {
  const navigate = useNavigate();
  const { orgId, userRole } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('trainee');
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, is_active, last_seen_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    setUsers((data as OrgUser[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !orgId) return;
    setInviting(true);

    const { error } = await supabase.functions.invoke('send-invite', {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });

    if (!error) {
      setInviteEmail('');
      setShowInvite(false);
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!orgId) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole, role_updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('org_id', orgId);

    if (!error) fetchUsers();
  };

  const handleDeactivate = async (userId: string, activate: boolean) => {
    if (!orgId) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({
        is_active: activate,
        deactivated_at: activate ? null : new Date().toISOString(),
      })
      .eq('id', userId)
      .eq('org_id', orgId);

    if (!error) fetchUsers();
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b-2 border-black bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-black">Usuarios</h1>
            <p className="text-sm text-gray-500">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {isOwnerOrAdmin && (
              <Button variant="primary" size="sm" onClick={() => setShowInvite(!showInvite)}>
                Convidar
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate('/org/dashboard')}>
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Invite panel */}
        {showInvite && (
          <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
            <h3 className="font-medium text-black mb-3 uppercase tracking-wider">Convidar usuario</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Papel</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="trainee">Treinando</option>
                  <option value="trainer">Treinador</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <Button variant="primary" size="sm" loading={inviting} onClick={handleInvite}>
                Enviar convite
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="flex-1 px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border-2 border-black focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">Todos os papeis</option>
            <option value="owner">Proprietario</option>
            <option value="admin">Administrador</option>
            <option value="manager">Gerente</option>
            <option value="trainer">Treinador</option>
            <option value="trainee">Treinando</option>
          </select>
        </div>

        {/* User list */}
        <div className="bg-white border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">Nenhum usuario encontrado</p>
          ) : (
            <table className="w-full">
              <thead className="bg-white border-b-2 border-black">
                <tr>
                  <th className="text-left text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Usuario</th>
                  <th className="text-left text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Papel</th>
                  <th className="text-left text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Ultimo acesso</th>
                  {isOwnerOrAdmin && (
                    <th className="text-right text-xs font-medium text-black uppercase tracking-wider px-4 py-3">Acoes</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-black">{u.full_name || '—'}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {isOwnerOrAdmin && u.role !== 'owner' ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className={`text-xs font-medium rounded-full px-2 py-0.5 border-0 ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}
                        >
                          <option value="trainee">Treinando</option>
                          <option value="trainer">Treinador</option>
                          <option value="manager">Gerente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.last_seen_at ? formatDate(u.last_seen_at) : '—'}
                    </td>
                    {isOwnerOrAdmin && (
                      <td className="px-4 py-3 text-right">
                        {u.role !== 'owner' && (
                          <button
                            onClick={() => handleDeactivate(u.id, !u.is_active)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            {u.is_active ? 'Desativar' : 'Reativar'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

export default OrgUsers;
