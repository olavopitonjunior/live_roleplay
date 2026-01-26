import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccessCodeForm } from '../components/Auth';

export function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, login, loading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (code: string): Promise<boolean> => {
    const success = await login(code);
    if (success) {
      navigate('/home', { replace: true });
    }
    return success;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black">
            Agent Roleplay
          </h1>
          <p className="text-gray-500 mt-2">
            Treine suas habilidades de vendas
          </p>
        </div>

        {/* Form Card */}
        <div className="border border-gray-200 rounded-lg p-8">
          <h2 className="text-lg font-semibold text-black mb-6 text-center">
            Acesse sua conta
          </h2>
          <AccessCodeForm onSubmit={handleLogin} />
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Digite seu codigo de acesso
        </p>
      </div>
    </div>
  );
}
