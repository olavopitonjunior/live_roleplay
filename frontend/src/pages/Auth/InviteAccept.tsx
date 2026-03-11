import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface InviteInfo {
  org_name: string;
  role: string;
  email: string;
}

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, signUp } = useAuth();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Link de convite invalido');
      setLoading(false);
      return;
    }

    // Validate invite token via Edge Function (to be created)
    // For now, show a placeholder that will be connected in Phase 3
    async function validateInvite() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('validate-invite', {
          body: { token },
        });

        if (fnError || !data?.valid) {
          setError(data?.error || 'Convite invalido ou expirado');
        } else {
          setInvite({
            org_name: data.org_name,
            role: data.role,
            email: data.email,
          });
        }
      } catch {
        setError('Erro ao validar convite');
      }
      setLoading(false);
    }

    validateInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas nao coincidem');
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await signUp(invite.email, password, fullName);

    if (result.success) {
      navigate('/home');
    } else {
      setError(result.error || 'Erro ao criar conta');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8 text-center">
          <div className="w-16 h-16 bg-red-100 border-2 border-black flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Convite invalido</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link to="/" className="text-black font-bold uppercase tracking-wider hover:text-yellow-600">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Already logged in — redirect to home (invite trigger already processed by DB)
    navigate('/home');
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8">
        <h2 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Aceitar convite</h2>
        <p className="text-gray-700 mb-6">
          Voce foi convidado para <strong>{invite?.org_name}</strong> como <strong>{invite?.role}</strong>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Email</label>
            <input
              type="email"
              disabled
              value={invite?.email || ''}
              className="w-full px-4 py-2.5 border-2 border-black bg-gray-50 text-gray-700"
              style={{ fontFamily: 'Space Mono, monospace' }}
            />
          </div>

          <div>
            <label htmlFor="fullName" className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Nome completo</label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-black focus:ring-2 focus:ring-yellow-400 focus:border-black"
              style={{ fontFamily: 'Space Mono, monospace' }}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold text-black mb-1 uppercase tracking-wider" style={{ fontFamily: 'Space Mono, monospace' }}>Senha</label>
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
            disabled={submitting}
            className="w-full py-2.5 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50 transition-all"
          >
            {submitting ? 'Criando conta...' : 'Criar conta e aceitar convite'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/" className="text-sm text-gray-700 hover:text-black font-bold">
            Ja tem uma conta? Faca login
          </Link>
        </div>
      </div>
    </div>
  );
}
