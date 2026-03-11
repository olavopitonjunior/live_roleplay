import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await resetPassword(email);
    setLoading(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setError(result.error || 'Erro ao enviar email de recuperacao');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8 text-center">
          <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Email enviado</h2>
          <p className="text-gray-700 mb-6">
            Se existe uma conta com <strong>{email}</strong>, voce recebera um link para redefinir sua senha.
          </p>
          <Link to="/" className="text-black font-bold uppercase tracking-wider hover:text-yellow-600">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8">
        <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Esqueceu sua senha?</h2>
        <p className="text-gray-700 mb-6">
          Informe seu email e enviaremos um link para redefinir sua senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
              placeholder="seu@email.com"
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
            {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-700 hover:text-black font-bold">
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
