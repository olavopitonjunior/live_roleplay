import { useState } from 'react';
import type { CriteriaScore, RubricLevel } from '../../types';

interface RubricScoreCardProps {
  score: CriteriaScore;
  onEvidenceClick?: (startIndex: number, endIndex: number) => void;
}

const LEVEL_CONFIG: Record<RubricLevel, { label: string; color: string; bgColor: string; barColor: string }> = {
  1: { label: 'Fraco', color: 'text-red-700', bgColor: 'bg-red-50', barColor: 'bg-red-500' },
  2: { label: 'Parcial', color: 'text-orange-700', bgColor: 'bg-orange-50', barColor: 'bg-orange-500' },
  3: { label: 'Bom', color: 'text-blue-700', bgColor: 'bg-blue-50', barColor: 'bg-blue-500' },
  4: { label: 'Excelente', color: 'text-green-700', bgColor: 'bg-green-50', barColor: 'bg-green-500' },
};

export function RubricScoreCard({ score, onEvidenceClick }: RubricScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = LEVEL_CONFIG[score.level];
  const criterionScore = score.level * 25; // 1=25, 2=50, 3=75, 4=100

  const handleEvidenceClick = () => {
    if (score.evidence_excerpt && onEvidenceClick &&
        score.evidence_start_index !== undefined &&
        score.evidence_end_index !== undefined) {
      onEvidenceClick(score.evidence_start_index, score.evidence_end_index);
    }
  };

  return (
    <div className={`border-2 border-black shadow-[4px_4px_0px_#000] overflow-hidden ${config.bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-black/5 transition-colors"
      >
        {/* Score indicator */}
        <div className="flex flex-col items-center gap-1 min-w-[60px]">
          <div className={`text-2xl font-bold font-mono ${config.color}`}>
            {criterionScore}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
            {config.label}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-black">{score.criterion_name}</h4>
            <span className="text-xs text-gray-500 flex-shrink-0">
              Peso: {score.weight}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${config.barColor} transition-all duration-500`}
              style={{ width: `${criterionScore}%` }}
            />
          </div>

          {/* Observation preview */}
          <p className={`mt-2 text-sm text-gray-600 ${!isExpanded ? 'line-clamp-2' : ''}`}>
            {score.observation}
          </p>
        </div>

        {/* Expand icon */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && score.evidence_excerpt && (
        <div className="px-4 pb-4 border-t-2 border-black bg-white">
          <div className="pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Evidencia na transcricao
            </p>
            <button
              onClick={handleEvidenceClick}
              className="w-full text-left p-3 bg-yellow-50 border-2 border-black hover:bg-yellow-100 transition-colors group"
            >
              <p className="text-sm text-gray-700 italic">
                "{score.evidence_excerpt}"
              </p>
              <p className="mt-2 text-xs text-yellow-700 group-hover:text-yellow-800 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Clique para ver no contexto
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
