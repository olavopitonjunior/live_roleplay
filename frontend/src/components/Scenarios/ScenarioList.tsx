import { useState } from 'react';
import type { Scenario } from '../../types';
import { ScenarioCard } from './ScenarioCard';

interface ScenarioListProps {
  scenarios: Scenario[];
  loading: boolean;
  onScenarioClick: (scenario: Scenario) => void;
}

function groupByCategory(scenarios: Scenario[]): Record<string, Scenario[]> {
  const groups: Record<string, Scenario[]> = {};
  for (const s of scenarios) {
    const cat = s.category || 'Geral';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(s);
  }
  return groups;
}

// Categories that start collapsed by default
const COLLAPSED_CATEGORIES = new Set(['Testes']);

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white p-6 border-2 border-black animate-pulse"
        >
          <div className="flex gap-4 mb-4">
            <div className="w-14 h-14 bg-neutral-200 border border-black" />
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
                      bg-yellow-400 border-2 border-black
                      mb-6">
        <svg
          className="w-10 h-10 text-black"
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
      <h3 className="text-xl font-bold text-black mb-2 uppercase tracking-tight">
        Nenhum cenario disponivel
      </h3>
      <p className="text-black font-mono max-w-sm mx-auto">
        Os cenarios de treinamento aparecerao aqui quando forem adicionados pelo administrador.
      </p>
    </div>
  );
}

export function ScenarioList({ scenarios, loading, onScenarioClick }: ScenarioListProps) {
  const grouped = groupByCategory(scenarios);
  const categories = Object.keys(grouped);

  // Initialize collapsed state — some categories start collapsed
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const cat of categories) {
      init[cat] = COLLAPSED_CATEGORIES.has(cat);
    }
    return init;
  });

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (scenarios.length === 0) {
    return <EmptyState />;
  }

  // If only one category, render flat grid (no headers)
  if (categories.length <= 1) {
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

  // Sort categories: non-collapsed first, "Testes" last
  const sortedCategories = [...categories].sort((a, b) => {
    if (a === 'Testes') return 1;
    if (b === 'Testes') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      {sortedCategories.map((category) => {
        const categoryScenarios = grouped[category];
        const isCollapsed = collapsed[category] ?? false;

        return (
          <div key={category}>
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 mb-4 group cursor-pointer"
            >
              <svg
                className={`w-4 h-4 text-black transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <h2 className="text-lg font-bold text-black uppercase tracking-wider group-hover:text-yellow-600 transition-colors">
                {category}
              </h2>
              <span className="text-sm text-black font-mono">
                ({categoryScenarios.length})
              </span>
            </button>

            {!isCollapsed && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryScenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onClick={() => onScenarioClick(scenario)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
