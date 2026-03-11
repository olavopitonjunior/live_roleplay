import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function Contact() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) return;
    setSending(true);

    await supabase.from('signup_leads').insert({
      email: form.email.trim(),
      full_name: form.name.trim(),
      company_name: form.company.trim() || null,
      phone: form.phone.trim() || null,
      status: 'demo_requested',
      demo_notes: form.message.trim() || null,
      source: 'contact_page',
    });

    setSending(false);
    setSent(true);
  };

  const update = (field: string, value: string) => setForm({ ...form, [field]: value });

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b-2 border-black sticky top-0 bg-white z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/landing')} className="text-xl font-bold text-black uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Live Roleplay
          </button>
          <button onClick={() => navigate('/')} className="text-sm font-bold text-black uppercase tracking-wider hover:text-yellow-600">
            Entrar
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Fale conosco</h1>
        <p className="text-gray-700 mb-8">Agende uma demo ou tire suas duvidas. Respondemos em ate 24h.</p>

        {sent ? (
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 text-center">
            <h2 className="text-lg font-bold text-black mb-2 uppercase tracking-wider">Mensagem enviada!</h2>
            <p className="text-gray-700 text-sm">Entraremos em contato em breve.</p>
            <button
              onClick={() => navigate('/landing')}
              className="mt-4 text-sm text-black font-bold uppercase tracking-wider hover:text-yellow-600"
            >
              Voltar ao inicio
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 border-2 border-black shadow-[4px_4px_0px_#000] p-6 bg-white">
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Nome *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Empresa</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Telefone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Mensagem</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                placeholder="Conte sobre sua necessidade..."
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            >
              {sending ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default Contact;
