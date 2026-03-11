import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function PlatformLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError('Credenciais invalidas.');
      setLoading(false);
      return;
    }

    // Verify platform_users membership
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('id, role')
      .eq('email', email.trim())
      .eq('is_active', true)
      .single();

    if (!platformUser) {
      await supabase.auth.signOut();
      setError('Voce nao tem acesso ao painel da plataforma.');
      setLoading(false);
      return;
    }

    navigate('/platform/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Live Roleplay</h1>
          <p className="text-gray-400 text-sm mt-1 uppercase tracking-wider">Platform Admin</p>
        </div>

        <div className="bg-[#111] border-2 border-[#333] p-6 shadow-[4px_4px_0px_#333]">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1 uppercase tracking-wider">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-950 border-2 border-[#333] text-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1 uppercase tracking-wider">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-gray-950 border-2 border-[#333] text-white focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-yellow-400 text-black font-bold uppercase tracking-wider hover:bg-yellow-300 disabled:opacity-50 transition-colors shadow-[4px_4px_0px_#333]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PlatformLogin;
