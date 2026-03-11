import { useNavigate } from 'react-router-dom';

export function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="w-16 h-16 bg-yellow-400 border-2 border-black flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-black mb-2 uppercase tracking-wider" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Checkout cancelado</h1>
        <p className="text-gray-700 mb-6">
          O pagamento nao foi processado. Voce pode tentar novamente quando quiser.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate('/pricing')}
            className="px-6 py-2 bg-yellow-400 text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Ver planos
          </button>
          <button
            onClick={() => navigate('/landing')}
            className="px-6 py-2 bg-white text-black font-bold uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[2px_2px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            Voltar ao inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckoutCancel;
