import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-900/50 text-red-400 border border-[#333]',
  admin: 'bg-blue-900/50 text-blue-400 border border-[#333]',
  support: 'bg-green-900/50 text-green-400 border border-[#333]',
  finance: 'bg-yellow-900/50 text-yellow-400 border border-[#333]',
  viewer: 'bg-[#111] text-gray-300 border border-[#333]',
};

export function PlatformStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('platform_users')
        .select('id, email, full_name, role, is_active, last_login_at, created_at')
        .order('role')
        .order('full_name');

      setStaff((data || []) as StaffMember[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Staff <span className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>({staff.length})</span></h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          <div className="bg-[#111] border-2 border-[#333] divide-y divide-[#333]/50 shadow-[4px_4px_0px_#333]">
            {staff.map((s) => (
              <div key={s.id} className={`px-4 py-3 flex items-center justify-between hover:bg-yellow-400/5 ${!s.is_active ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm font-medium">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[s.role] || 'bg-[#111] text-gray-300 border border-[#333]'}`}>
                    {s.role}
                  </span>
                  <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {s.last_login_at ? formatDate(s.last_login_at) : 'Nunca'}
                  </span>
                </div>
              </div>
            ))}
            {staff.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhum membro da plataforma</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformStaff;
