import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/home'), 2000);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8 text-center">
          <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Senha atualizada</h2>
          <p className="text-gray-700">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8">
        <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Redefinir senha</h2>
        <p className="text-gray-700 mb-6">Escolha uma nova senha para sua conta.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Nova senha</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
              style={{ fontFamily: 'Space Mono, monospace' }}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Confirmar senha</label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
              style={{ fontFamily: 'Space Mono, monospace' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
          >
            {loading ? 'Atualizando...' : 'Redefinir senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
