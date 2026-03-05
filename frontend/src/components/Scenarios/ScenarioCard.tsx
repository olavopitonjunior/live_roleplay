import type { Scenario } from '../../types';

interface ScenarioCardProps {
  scenario: Scenario;
  onClick: () => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  cold_call: 'Cold Call',
  interview: 'Entrevista',
  entrevista: 'Entrevista',
  negotiation: 'Negociacao',
  negociacao: 'Negociacao',
  retention: 'Retencao',
  retencao: 'Retencao',
  prospeccao_consultiva: 'Prospeccao',
  apresentacao: 'Apresentacao',
};

export function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  const durationMin = scenario.target_duration_seconds
    ? Math.round(scenario.target_duration_seconds / 60)
    : null;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-lg p-6 border border-gray-200
                 hover:border-yellow-400 transition-colors duration-200 cursor-pointer"
    >
      {/* Title + Session Type */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-xl font-bold text-black">
          {scenario.title}
        </h3>
        {scenario.session_type && SESSION_TYPE_LABELS[scenario.session_type] && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium mt-1">
            {SESSION_TYPE_LABELS[scenario.session_type]}
          </span>
        )}
      </div>

      {/* Character */}
      {scenario.character_name && (
        <p className="text-sm text-gray-700 mb-2">
          <span className="font-medium">{scenario.character_name}</span>
          {scenario.character_role && (
            <span className="text-gray-400"> — {scenario.character_role}</span>
          )}
        </p>
      )}

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {scenario.context}
      </p>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-yellow-100 text-black rounded text-xs font-medium">
          {scenario.objections.length} objecoes
        </span>
        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
          {scenario.evaluation_criteria.length} criterios
        </span>
        {durationMin && (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
            {durationMin} min
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="text-black font-semibold group-hover:text-yellow-600 transition-colors">
        Comecar treino →
      </div>
    </button>
  );
}
