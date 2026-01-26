import type { Scenario } from '../../types';

interface ScenarioCardProps {
  scenario: Scenario;
  onClick: () => void;
}

export function ScenarioCard({ scenario, onClick }: ScenarioCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-lg p-6 border border-gray-200
                 hover:border-yellow-400 transition-colors duration-200 cursor-pointer"
    >
      {/* Title */}
      <h3 className="text-xl font-bold text-black mb-2">
        {scenario.title}
      </h3>

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
      </div>

      {/* CTA */}
      <div className="text-black font-semibold group-hover:text-yellow-600 transition-colors">
        Comecar treino →
      </div>
    </button>
  );
}
