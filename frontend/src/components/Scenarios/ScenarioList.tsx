import type { Scenario } from '../../types';
import { ScenarioCard } from './ScenarioCard';

interface ScenarioListProps {
  scenarios: Scenario[];
  loading: boolean;
  onScenarioClick: (scenario: Scenario) => void;
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl p-6 border-2 border-neutral-100 animate-pulse"
        >
          <div className="flex gap-4 mb-4">
            <div className="w-14 h-14 bg-neutral-200 rounded-xl" />
          </div>
          <div className="h-6 bg-neutral-200 rounded-lg w-3/4 mb-3" />
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-neutral-200 rounded-lg w-full" />
            <div className="h-4 bg-neutral-200 rounded-lg w-5/6" />
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-6 bg-neutral-200 rounded-full w-24" />
            <div className="h-6 bg-neutral-200 rounded-full w-20" />
          </div>
          <div className="h-5 bg-neutral-200 rounded-lg w-1/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20
                      bg-gradient-to-br from-neutral-100 to-neutral-200
                      rounded-2xl mb-6">
        <svg
          className="w-10 h-10 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-neutral-800 mb-2">
        Nenhum cenario disponivel
      </h3>
      <p className="text-neutral-500 max-w-sm mx-auto">
        Os cenarios de treinamento aparecerao aqui quando forem adicionados pelo administrador.
      </p>
    </div>
  );
}

export function ScenarioList({ scenarios, loading, onScenarioClick }: ScenarioListProps) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (scenarios.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {scenarios.map((scenario) => (
        <ScenarioCard
          key={scenario.id}
          scenario={scenario}
          onClick={() => onScenarioClick(scenario)}
        />
      ))}
    </div>
  );
}
