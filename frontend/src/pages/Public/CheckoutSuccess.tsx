import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    async function completeCheckout() {
      const { error } = await supabase.functions.invoke('complete-signup', {
        body: { stripe_checkout_session_id: sessionId },
      });

      setStatus(error ? 'error' : 'success');
    }

    completeCheckout();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin h-12 w-12 border-4 border-yellow-400 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-700 font-bold">Finalizando sua assinatura...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Pagamento confirmado!</h1>
            <p className="text-gray-700 mb-6">Sua conta esta pronta. Faca login para comecar a usar.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Ir para login
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 border-2 border-black flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Algo deu errado</h1>
            <p className="text-gray-700 mb-6">Nao conseguimos confirmar seu pagamento. Entre em contato conosco.</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/contact')}
                className="px-6 py-2 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Falar conosco
              </button>
              <button
                onClick={() => navigate('/landing')}
                className="px-6 py-2 bg-white text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Voltar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CheckoutSuccess;
