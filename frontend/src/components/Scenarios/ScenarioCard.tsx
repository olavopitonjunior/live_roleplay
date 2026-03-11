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
      className="group w-full text-left bg-white p-6 border-2 border-black
                 shadow-[4px_4px_0px_#000] hover:shadow-[4px_4px_0px_#FACC15]
                 transition-all duration-200 cursor-pointer"
    >
      {/* Title + Session Type */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-xl font-bold text-black">
          {scenario.title}
        </h3>
        {scenario.session_type && SESSION_TYPE_LABELS[scenario.session_type] && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 bg-yellow-400 text-black font-bold border border-black uppercase tracking-wider mt-1">
            {SESSION_TYPE_LABELS[scenario.session_type]}
          </span>
        )}
      </div>

      {/* Character */}
      {scenario.character_name && (
        <p className="text-sm text-black mb-2">
          <span className="font-medium">{scenario.character_name}</span>
          {scenario.character_role && (
            <span className="text-black"> — {scenario.character_role}</span>
          )}
        </p>
      )}

      {/* Description */}
      <p className="text-black text-sm mb-4 line-clamp-2">
        {scenario.context}
      </p>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-3 py-1 bg-yellow-400 text-black text-xs font-bold border border-black uppercase tracking-wider">
          {scenario.objections.length} objecoes
        </span>
        <span className="px-3 py-1 bg-white text-black text-xs font-bold border border-black uppercase tracking-wider">
          {scenario.evaluation_criteria.length} criterios
        </span>
        {durationMin && (
          <span className="px-3 py-1 bg-white text-black text-xs font-bold border border-black uppercase tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>
            {durationMin} min
          </span>
        )}
      </div>

      {/* CTA */}
      <div className="text-black font-bold group-hover:text-yellow-600 transition-colors uppercase tracking-wider">
        Comecar treino →
      </div>
    </button>
  );
}
