import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccessCodeForm } from '../components/Auth';
import { Button } from '../components/ui';

type LoginTab = 'code' | 'email';

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, loginWithEmail, loading } = useAuth();
  const [tab, setTab] = useState<LoginTab>('code');

  // Email form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleCodeLogin = async (code: string): Promise<boolean> => {
    const success = await login(code);
    if (success) {
      navigate('/home', { replace: true });
    }
    return success;
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!email.trim() || !password.trim()) {
      setEmailError('Preencha todos os campos');
      return;
    }

    setEmailLoading(true);
    const result = await loginWithEmail(email, password);
    setEmailLoading(false);

    if (result.success) {
      navigate('/home', { replace: true });
    } else {
      setEmailError(result.error || 'Credenciais invalidas');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-black font-mono uppercase tracking-wider">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black uppercase tracking-tight">
            Agent Roleplay
          </h1>
          <p className="text-black mt-2 font-mono uppercase tracking-wider text-sm">
            Treine suas habilidades de vendas
          </p>
        </div>

        {/* Form Card */}
        <div className="border-2 border-black p-8 shadow-[4px_4px_0px_#000]">
          <h2 className="text-lg font-semibold text-black mb-6 text-center uppercase tracking-tight">
            Acesse sua conta
          </h2>

          {/* Tab Switcher */}
          <div className="flex border-2 border-black mb-6 overflow-hidden">
            <button
              type="button"
              onClick={() => setTab('code')}
              className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors ${
                tab === 'code'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              Codigo de Acesso
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors border-l-2 border-black ${
                tab === 'email'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              Email e Senha
            </button>
          </div>

          {/* Access Code Tab */}
          {tab === 'code' && (
            <AccessCodeForm onSubmit={handleCodeLogin} />
          )}

          {/* Email/Password Tab */}
          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="w-full space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-mono font-medium text-black mb-1 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 bg-white border-2 border-black
                             text-black placeholder:text-gray-400
                             focus:border-yellow-400 focus:ring-0 transition-colors outline-none"
                  disabled={emailLoading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-mono font-medium text-black mb-1 uppercase tracking-wider">
                  Senha
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-black
                             text-black placeholder:text-gray-400
                             focus:border-yellow-400 focus:ring-0 transition-colors outline-none"
                  disabled={emailLoading}
                  autoComplete="current-password"
                />
              </div>

              {emailError && (
                <div className="text-red-500 text-sm text-center py-1">
                  {emailError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={emailLoading}
              >
                {emailLoading ? 'Entrando...' : 'Entrar'}
              </Button>

              <div className="text-center">
                <Link to="/forgot-password" className="text-sm text-black hover:text-yellow-600 font-mono">
                  Esqueceu sua senha?
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-black font-mono mt-6">
          {tab === 'code'
            ? 'Digite seu codigo de acesso'
            : 'Use suas credenciais de acesso'}
        </p>
      </div>
    </div>
  );
}
