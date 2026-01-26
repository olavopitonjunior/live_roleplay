import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFeedback } from '../hooks/useFeedback';
import { FeedbackView } from '../components/Feedback';
import { Button } from '../components/ui';

export function Feedback() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { feedback, scenario, loading, generating, error, fetchFeedback } =
    useFeedback();

  useEffect(() => {
    if (sessionId) {
      fetchFeedback(sessionId);
    }
  }, [sessionId, fetchFeedback]);

  // Loading state
  if (loading || generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="text-center">
          {/* Loading spinner */}
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-full border-4 border-gray-200 border-t-yellow-400 animate-spin" />
          </div>

          <h2 className="text-2xl font-bold text-black mb-2">
            {generating ? 'Analisando sua sessao...' : 'Carregando feedback...'}
          </h2>
          <p className="text-gray-500 mb-6">
            {generating
              ? 'A IA esta avaliando sua performance'
              : 'Buscando resultados'}
          </p>

          {/* Animated dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-black mb-2">
            Erro ao carregar feedback
          </h2>
          <p className="text-gray-500 mb-8">{error}</p>
          <Button onClick={() => navigate('/home')} variant="primary" size="lg">
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

  // No data state
  if (!feedback || !scenario) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold text-black mb-2">
            Feedback nao encontrado
          </h2>
          <p className="text-gray-500 mb-8">
            Nao foi possivel encontrar o feedback desta sessao.
          </p>
          <Button onClick={() => navigate('/home')} variant="primary" size="lg">
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

  // Success - show feedback
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-black">Resultado</h1>
          <button
            onClick={() => navigate('/home')}
            className="text-gray-500 hover:text-black transition-colors"
          >
            Fechar
          </button>
        </div>
      </header>

      {/* Feedback Content */}
      <main className="pb-32">
        <FeedbackView feedback={feedback} scenario={scenario} />
      </main>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto flex gap-4">
          <Button
            onClick={() => navigate('/home')}
            variant="primary"
            size="lg"
            fullWidth
          >
            Novo Treino
          </Button>
          <Button
            onClick={() => navigate('/history')}
            variant="outline"
            size="lg"
            fullWidth
          >
            Ver Historico
          </Button>
        </div>
      </div>
    </div>
  );
}
