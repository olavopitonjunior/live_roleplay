import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get('plan') || 'starter';

  const [form, setForm] = useState({ name: '', email: '', company: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }

    setLoading(true);

    // 1. Track lead
    await supabase.from('signup_leads').insert({
      email: form.email.trim(),
      full_name: form.name.trim(),
      company_name: form.company.trim() || null,
      status: 'signup_started',
      source: 'signup_page',
    });

    // 2. Create Supabase Auth user
    const { error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.name.trim(),
          company_name: form.company.trim(),
          plan: planSlug,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // 3. Complete signup (create org, profile, etc.)
    const { error: signupError } = await supabase.functions.invoke('complete-signup', {
      body: {
        email: form.email.trim(),
        full_name: form.name.trim(),
        company_name: form.company.trim(),
        plan_slug: planSlug,
      },
    });

    setLoading(false);

    if (signupError) {
      setError('Erro ao criar sua conta. Tente novamente.');
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Conta criada!</h1>
          <p className="text-gray-700 mb-6">
            Verifique seu email para confirmar sua conta. Depois, faca login para comecar.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/landing')} className="text-xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Live Roleplay
          </button>
          <p className="text-gray-700">Crie sua conta — 14 dias gratis</p>
        </div>

        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Nome completo *</label>
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
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Nome da empresa</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => update('company', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Senha *</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Minimo 8 caracteres"
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Confirmar senha *</label>
              <input
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
                style={{ fontFamily: 'Space Mono, monospace' }}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 border-2 border-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
            >
              {loading ? 'Criando conta...' : 'Criar conta gratis'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-700">
              Ja tem conta?{' '}
              <button onClick={() => navigate('/')} className="text-black font-bold hover:text-yellow-600">
                Entrar
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
