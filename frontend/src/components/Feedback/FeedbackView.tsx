import type { Feedback, Scenario } from '../../types';
import { ProgressCircle } from '../ui';
import { CriteriaChecklist } from './CriteriaChecklist';

interface FeedbackViewProps {
  feedback: Feedback;
  scenario: Scenario;
}

export function FeedbackView({ feedback, scenario }: FeedbackViewProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Score Hero */}
      <div className="text-center py-8">
        <ProgressCircle value={feedback.score} size="lg" animate />
      </div>

      {/* Scenario Badge */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <p className="text-sm text-gray-500 mb-1">Cenario</p>
        <p className="font-semibold text-black">{scenario.title}</p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-black mb-4">Resumo da Avaliacao</h3>
        <p className="text-gray-600 leading-relaxed">{feedback.summary}</p>
      </div>

      {/* Criteria Section */}
      <CriteriaChecklist
        results={feedback.criteria_results}
        criteria={scenario.evaluation_criteria}
      />
    </div>
  );
}
