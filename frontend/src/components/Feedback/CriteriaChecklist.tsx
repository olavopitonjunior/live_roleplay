import type { CriteriaResult, EvaluationCriterion } from '../../types';

interface CriteriaChecklistProps {
  results: CriteriaResult[];
  criteria: EvaluationCriterion[];
}

export function CriteriaChecklist({ results, criteria }: CriteriaChecklistProps) {
  const getCriterionDescription = (criteriaId: string): string => {
    const criterion = criteria.find((c) => c.id === criteriaId);
    return criterion?.description || `Criterio ${criteriaId}`;
  };

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  return (
    <div className="space-y-3">
      {/* Summary Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-black uppercase tracking-wider">Criterios</h3>
        <span className="text-sm font-medium text-gray-500">
          {passedCount}/{totalCount} atendidos
        </span>
      </div>

      {/* Criteria Items */}
      {results.map((result) => (
        <div
          key={result.criteria_id}
          className={`p-4 border-2 ${
            result.passed
              ? 'bg-white border-green-500'
              : 'bg-white border-red-500'
          } shadow-[4px_4px_0px_#000]`}
        >
          <div className="flex items-start gap-3">
            {/* Pass/Fail Dot */}
            <div
              className={`flex-shrink-0 w-3 h-3 rounded-full mt-1.5 ${
                result.passed ? 'bg-green-500' : 'bg-red-500'
              }`}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium text-black">
                  {getCriterionDescription(result.criteria_id)}
                </p>
                <span
                  className={`flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                    result.passed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {result.passed ? 'Atendido' : 'Nao atendido'}
                </span>
              </div>

              {result.observation && (
                <p className="mt-2 text-sm text-gray-600">
                  {result.observation}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
