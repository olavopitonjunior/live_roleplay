import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface Lead {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  signup_started: 'Signup iniciado',
  payment_pending: 'Pagamento pendente',
  payment_completed: 'Pagamento ok',
  org_created: 'Org criada',
  onboarding: 'Onboarding',
  active: 'Ativo',
  abandoned: 'Abandonado',
  demo_requested: 'Demo solicitada',
};

const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-[#111] text-gray-300 border border-[#333]',
  signup_started: 'bg-blue-900/50 text-blue-400 border border-[#333]',
  payment_pending: 'bg-yellow-900/50 text-yellow-400 border border-[#333]',
  active: 'bg-green-900/50 text-green-400 border border-[#333]',
  abandoned: 'bg-red-900/50 text-red-400 border border-[#333]',
  demo_requested: 'bg-purple-900/50 text-purple-400 border border-[#333]',
};

export function PlatformLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('signup_leads')
        .select('id, email, full_name, company_name, status, source, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      setLeads((data || []) as Lead[]);
      setLoading(false);
    }
    fetch();
  }, []);

  const filtered = leads.filter(l => statusFilter === 'all' || l.status === statusFilter);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b-2 border-[#333] bg-gray-950 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-wider">Leads <span className="font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>({leads.length})</span></h1>
          <button onClick={() => navigate('/platform/dashboard')} className="text-xs text-gray-400 hover:text-yellow-400 uppercase tracking-wider">
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'lead', 'demo_requested', 'signup_started', 'payment_pending', 'active', 'abandoned'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold ${
                statusFilter === s ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_#333]' : 'bg-[#111] border-2 border-[#333] text-gray-400 hover:text-white hover:border-yellow-400'
              }`}
            >
              {s === 'all' ? 'Todos' : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent" />
          </div>
        ) : (
          <div className="bg-[#111] border-2 border-[#333] divide-y divide-[#333]/50 shadow-[4px_4px_0px_#333]">
            {filtered.map((lead) => (
              <div key={lead.id} className="px-4 py-3 flex items-center justify-between hover:bg-yellow-400/5">
                <div>
                  <p className="text-sm font-medium">{lead.full_name || lead.email}</p>
                  <p className="text-xs text-gray-400">
                    {lead.email} {lead.company_name ? `· ${lead.company_name}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status] || 'bg-[#111] text-gray-400 border border-[#333]'}`}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  <span className="text-xs text-gray-500 font-mono" style={{ fontFamily: "'Space Mono', monospace" }}>{formatDate(lead.created_at)}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhum lead encontrado</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default PlatformLeads;
