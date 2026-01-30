import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDifficultyProfile } from '../hooks/useDifficultyProfile';
import { useLearningProfile } from '../hooks/useLearningProfile';

// Helper function to get difficulty label and color
function getDifficultyInfo(level: number): { label: string; color: string; bgColor: string } {
  if (level <= 3) {
    return { label: 'Facil', color: 'text-green-700', bgColor: 'bg-green-100' };
  } else if (level <= 6) {
    return { label: 'Medio', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  } else {
    return { label: 'Dificil', color: 'text-red-700', bgColor: 'bg-red-100' };
  }
}

// Helper function to format SPIN step name
function formatSpinStep(step: string): string {
  const names: Record<string, string> = {
    situation: 'Situacao',
    problem: 'Problema',
    implication: 'Implicacao',
    need_payoff: 'Necessidade',
  };
  return names[step] || step;
}

// Helper function to format outcome name
function formatOutcome(outcome: string): string {
  const names: Record<string, string> = {
    sale_closed: 'Venda Fechada',
    meeting_scheduled: 'Reuniao Agendada',
    proposal_requested: 'Proposta Solicitada',
    needs_follow_up: 'Follow-up Necessario',
    rejected: 'Rejeitado',
  };
  return names[outcome] || outcome;
}

export function Profile() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { profile: difficultyProfile, loading: difficultyLoading } = useDifficultyProfile();
  const { profile: learningProfile, loading: learningLoading } = useLearningProfile();

  const loading = difficultyLoading || learningLoading;

  // Calculate SPIN average
  const spinAverage = learningProfile?.spin_proficiency
    ? Math.round(
        (learningProfile.spin_proficiency.situation +
          learningProfile.spin_proficiency.problem +
          learningProfile.spin_proficiency.implication +
          learningProfile.spin_proficiency.need_payoff) /
          4 *
          100
      )
    : 0;

  // Get total outcomes
  const totalOutcomes = learningProfile?.outcomes_history
    ? Object.values(learningProfile.outcomes_history).reduce((a, b) => a + b, 0)
    : 0;

  // Get positive outcomes
  const positiveOutcomes = learningProfile?.outcomes_history
    ? (learningProfile.outcomes_history.sale_closed || 0) +
      (learningProfile.outcomes_history.meeting_scheduled || 0) +
      (learningProfile.outcomes_history.proposal_requested || 0)
    : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="text-gray-600 hover:text-black transition-colors"
            >
              ← Voltar
            </button>
            <h1 className="text-xl font-bold text-black">Meu Perfil</h1>
          </div>
          <span className="text-sm text-gray-500">{accessCode?.code}</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-lg h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="bg-black rounded-lg p-6 text-white">
              <h3 className="font-semibold mb-4">Visao Geral</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-3xl font-bold text-yellow-400">
                    {learningProfile?.total_sessions || 0}
                  </p>
                  <p className="text-white/70 text-sm">Sessoes</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-400">
                    {Math.round(learningProfile?.average_score || 0)}
                  </p>
                  <p className="text-white/70 text-sm">Media</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-400">
                    {Math.round(learningProfile?.best_score || 0)}
                  </p>
                  <p className="text-white/70 text-sm">Melhor</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-400">
                    {difficultyProfile?.current_level || 3}
                  </p>
                  <p className="text-white/70 text-sm">Nivel</p>
                </div>
              </div>
            </div>

            {/* Difficulty Level */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h3 className="font-semibold text-black mb-4">Nivel de Dificuldade</h3>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold text-black">
                    {difficultyProfile?.current_level || 3}
                  </span>
                  <span className="text-gray-400 text-2xl">/10</span>
                  <span
                    className={`text-sm px-3 py-1 rounded-full ${getDifficultyInfo(difficultyProfile?.current_level || 3).bgColor} ${getDifficultyInfo(difficultyProfile?.current_level || 3).color}`}
                  >
                    {getDifficultyInfo(difficultyProfile?.current_level || 3).label}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => {
                  const level = difficultyProfile?.current_level || 3;
                  const color =
                    level <= 3 ? 'bg-green-400' : level <= 6 ? 'bg-yellow-400' : 'bg-red-400';
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-3 rounded ${i < level ? color : 'bg-gray-200'}`}
                    />
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-3">
                {difficultyProfile?.consecutive_high_scores
                  ? `${difficultyProfile.consecutive_high_scores} sessao(oes) consecutiva(s) com score alto`
                  : difficultyProfile?.consecutive_low_scores
                    ? `${difficultyProfile.consecutive_low_scores} sessao(oes) consecutiva(s) com score baixo`
                    : 'Continue treinando para ajustar seu nivel'}
              </p>
            </div>

            {/* SPIN Proficiency */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-black">Proficiencia SPIN</h3>
                <span className="text-sm text-gray-500">Media: {spinAverage}%</span>
              </div>
              <div className="space-y-4">
                {learningProfile?.spin_proficiency &&
                  Object.entries(learningProfile.spin_proficiency).map(([step, value]) => {
                    const percentage = Math.round(value * 100);
                    const barColor =
                      percentage >= 70
                        ? 'bg-green-400'
                        : percentage >= 40
                          ? 'bg-yellow-400'
                          : 'bg-red-400';
                    return (
                      <div key={step}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {formatSpinStep(step)}
                          </span>
                          <span className="text-sm text-gray-500">{percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full">
                          <div
                            className={`h-2 rounded-full ${barColor}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-2 gap-4">
              {/* Strengths */}
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <span className="text-green-500">✓</span> Pontos Fortes
                </h3>
                {learningProfile?.recurring_strengths &&
                learningProfile.recurring_strengths.length > 0 ? (
                  <ul className="space-y-2">
                    {learningProfile.recurring_strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">
                    Complete mais sessoes para identificar seus pontos fortes
                  </p>
                )}
              </div>

              {/* Weaknesses */}
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
                  <span className="text-red-500">!</span> Areas a Melhorar
                </h3>
                {learningProfile?.recurring_weaknesses &&
                learningProfile.recurring_weaknesses.length > 0 ? (
                  <ul className="space-y-2">
                    {learningProfile.recurring_weaknesses.map((weakness, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        {weakness}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">
                    Complete mais sessoes para identificar areas de melhoria
                  </p>
                )}
              </div>
            </div>

            {/* Outcomes History */}
            {totalOutcomes > 0 && (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black">Resultados das Sessoes</h3>
                  <span className="text-sm text-gray-500">
                    {positiveOutcomes}/{totalOutcomes} positivos
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {learningProfile?.outcomes_history &&
                    Object.entries(learningProfile.outcomes_history)
                      .filter(([, count]) => count > 0)
                      .map(([outcome, count]) => {
                        const isPositive = ['sale_closed', 'meeting_scheduled', 'proposal_requested'].includes(outcome);
                        return (
                          <div
                            key={outcome}
                            className={`p-3 rounded-lg text-center ${isPositive ? 'bg-green-50' : 'bg-gray-50'}`}
                          >
                            <p className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-gray-600'}`}>
                              {count}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{formatOutcome(outcome)}</p>
                          </div>
                        );
                      })}
                </div>
              </div>
            )}

            {/* Objection Handling */}
            {learningProfile?.objection_handling &&
              Object.keys(learningProfile.objection_handling).length > 0 && (
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold text-black mb-4">Tratamento de Objecoes</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(learningProfile.objection_handling).map(([type, data]) => {
                      const successRate = Math.round((data.success_rate || 0) * 100);
                      const barColor =
                        successRate >= 70
                          ? 'bg-green-400'
                          : successRate >= 40
                            ? 'bg-yellow-400'
                            : 'bg-red-400';
                      return (
                        <div key={type} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {type}
                            </span>
                            <span className="text-sm text-gray-500">{successRate}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full">
                            <div
                              className={`h-2 rounded-full ${barColor}`}
                              style={{ width: `${successRate}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {data.count || 0} ocorrencia(s)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* AI Summary */}
            {learningProfile?.ai_summary && (
              <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
                <h3 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="text-yellow-500">💡</span> Analise do Coach
                </h3>
                <p className="text-gray-700">{learningProfile.ai_summary}</p>
              </div>
            )}

            {/* Empty State */}
            {(!learningProfile || learningProfile.total_sessions === 0) && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-black mb-2">
                  Comece seu treinamento!
                </h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Complete sessoes de treinamento para ver sua evolucao, pontos fortes e areas a
                  melhorar.
                </p>
                <button
                  onClick={() => navigate('/home')}
                  className="px-6 py-3 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-500 transition-colors"
                >
                  Iniciar Treinamento
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
