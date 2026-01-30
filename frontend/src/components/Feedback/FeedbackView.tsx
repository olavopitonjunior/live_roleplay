import { useState } from 'react';
import type { Feedback, Scenario, Evidence, SessionObjectionStatus } from '../../types';
import { ProgressCircle } from '../ui';
import { CriteriaChecklist } from './CriteriaChecklist';
import { RubricScoreCard } from './RubricScoreCard';
import { TranscriptViewer } from './TranscriptViewer';
import { ObjectionStatusCard } from './ObjectionStatusCard';
import { KeyMomentsTimeline } from './KeyMomentsTimeline';

// Session outcome types
type SessionOutcome =
  | 'sale_closed'
  | 'meeting_scheduled'
  | 'proposal_requested'
  | 'needs_follow_up'
  | 'rejected'
  | 'abandoned'
  | 'timeout';

// Outcome display configuration
const OUTCOME_CONFIG: Record<SessionOutcome, { label: string; emoji: string; color: string; bgColor: string }> = {
  sale_closed: {
    label: 'Venda Fechada',
    emoji: '🎉',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  meeting_scheduled: {
    label: 'Reuniao Agendada',
    emoji: '📅',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  proposal_requested: {
    label: 'Proposta Solicitada',
    emoji: '📝',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
  needs_follow_up: {
    label: 'Precisa Acompanhamento',
    emoji: '⏳',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  rejected: {
    label: 'Proposta Rejeitada',
    emoji: '❌',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
  abandoned: {
    label: 'Sessao Abandonada',
    emoji: '🚪',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  timeout: {
    label: 'Tempo Esgotado',
    emoji: '⏰',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
};

interface FeedbackViewProps {
  feedback: Feedback;
  scenario: Scenario;
  transcript?: string;
  evidences?: Evidence[];
  objectionStatuses?: SessionObjectionStatus[];
  sessionOutcome?: SessionOutcome | null;
}

export function FeedbackView({
  feedback,
  scenario,
  transcript,
  evidences = [],
  objectionStatuses = [],
  sessionOutcome,
}: FeedbackViewProps) {
  const [highlightRange, setHighlightRange] = useState<{ start: number; end: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'criteria' | 'transcript' | 'moments'>('criteria');

  // Check if we have the new rubric-based scores
  const hasRubricScores = feedback.criteria_scores && feedback.criteria_scores.length > 0;
  const displayScore = feedback.weighted_score ?? feedback.score;

  // Handle evidence click - scroll to transcript
  const handleEvidenceClick = (startIndex: number, endIndex: number) => {
    setHighlightRange({ start: startIndex, end: endIndex });
    setActiveTab('transcript');
  };

  // Handle moment click - scroll to transcript
  const handleMomentClick = (index: number) => {
    setHighlightRange({ start: index, end: index + 50 });
    setActiveTab('transcript');
  };

  // Handle objection view
  const handleViewObjection = (_objectionId: string, index: number) => {
    setHighlightRange({ start: index, end: index + 50 });
    setActiveTab('transcript');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Score Hero */}
      <div className="text-center py-8">
        <ProgressCircle value={displayScore} size="lg" animate />
        {hasRubricScores && feedback.weighted_score !== undefined && (
          <p className="mt-2 text-sm text-gray-500">
            Score ponderado baseado em rubricas
          </p>
        )}
        {feedback.confidence_level && (
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
            feedback.confidence_level === 'high'
              ? 'bg-green-100 text-green-700'
              : feedback.confidence_level === 'medium'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Confianca {feedback.confidence_level === 'high' ? 'alta' : feedback.confidence_level === 'medium' ? 'media' : 'baixa'}
          </div>
        )}
      </div>

      {/* Session Outcome Badge */}
      {sessionOutcome && OUTCOME_CONFIG[sessionOutcome] && (
        <div className={`rounded-lg p-4 border ${OUTCOME_CONFIG[sessionOutcome].bgColor} border-opacity-50`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{OUTCOME_CONFIG[sessionOutcome].emoji}</span>
            <div>
              <p className="text-sm text-gray-600">Resultado da Negociacao</p>
              <p className={`font-semibold ${OUTCOME_CONFIG[sessionOutcome].color}`}>
                {OUTCOME_CONFIG[sessionOutcome].label}
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('criteria')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'criteria'
              ? 'border-black text-black'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Criterios ({hasRubricScores ? feedback.criteria_scores!.length : feedback.criteria_results.length})
        </button>
        {transcript && (
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'transcript'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transcricao
          </button>
        )}
        {feedback.key_moments && feedback.key_moments.length > 0 && (
          <button
            onClick={() => setActiveTab('moments')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'moments'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Momentos ({feedback.key_moments.length})
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Criteria Tab */}
        {activeTab === 'criteria' && (
          <>
            {hasRubricScores ? (
              /* New rubric-based display */
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-black">Criterios de Avaliacao</h3>
                  <span className="text-sm font-medium text-gray-500">
                    Media: {Math.round(displayScore)}%
                  </span>
                </div>
                {feedback.criteria_scores!.map((score) => (
                  <RubricScoreCard
                    key={score.criterion_id}
                    score={score}
                    onEvidenceClick={handleEvidenceClick}
                  />
                ))}
              </div>
            ) : (
              /* Legacy pass/fail display */
              <CriteriaChecklist
                results={feedback.criteria_results}
                criteria={scenario.evaluation_criteria}
              />
            )}

            {/* Objection Status */}
            {objectionStatuses.length > 0 && (
              <ObjectionStatusCard
                statuses={objectionStatuses}
                onViewEvidence={handleViewObjection}
              />
            )}
          </>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && transcript && (
          <TranscriptViewer
            transcript={transcript}
            evidences={evidences}
            highlightRange={highlightRange}
            onClearHighlight={() => setHighlightRange(null)}
          />
        )}

        {/* Key Moments Tab */}
        {activeTab === 'moments' && feedback.key_moments && (
          <KeyMomentsTimeline
            moments={feedback.key_moments}
            onMomentClick={handleMomentClick}
          />
        )}
      </div>

      {/* Transcript Coverage indicator */}
      {feedback.transcript_coverage !== undefined && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Cobertura da transcricao</span>
            <span className="text-sm text-gray-600">{Math.round(feedback.transcript_coverage * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                feedback.transcript_coverage >= 0.8
                  ? 'bg-green-500'
                  : feedback.transcript_coverage >= 0.6
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${feedback.transcript_coverage * 100}%` }}
            />
          </div>
          {feedback.transcript_coverage < 0.8 && (
            <p className="mt-2 text-xs text-amber-600">
              A transcricao pode estar incompleta, afetando a precisao da avaliacao.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
