import type { ReactNode } from 'react';
import type { SessionObjectionStatus, ObjectionStatus } from '../../types';

interface ObjectionStatusCardProps {
  statuses: SessionObjectionStatus[];
  onViewEvidence?: (objectionId: string, index: number) => void;
}

const STATUS_CONFIG: Record<ObjectionStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: ReactNode;
}> = {
  not_detected: {
    label: 'Nao detectada',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
  },
  detected: {
    label: 'Nao tratada',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  partial: {
    label: 'Parcialmente tratada',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  addressed: {
    label: 'Tratada',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
};

export function ObjectionStatusCard({ statuses, onViewEvidence }: ObjectionStatusCardProps) {
  if (!statuses || statuses.length === 0) {
    return null;
  }

  const addressedCount = statuses.filter((s) => s.status === 'addressed').length;
  const partialCount = statuses.filter((s) => s.status === 'partial').length;
  const detectedCount = statuses.filter((s) => s.status === 'detected').length;
  const totalDetected = statuses.filter((s) => s.status !== 'not_detected').length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-black flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Objecoes ({totalDetected} detectadas)
          </h3>
          <div className="flex gap-2 text-xs">
            {addressedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                {addressedCount} tratadas
              </span>
            )}
            {partialCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                {partialCount} parciais
              </span>
            )}
            {detectedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
                {detectedCount} pendentes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Objection list */}
      <div className="divide-y divide-gray-100">
        {statuses.map((status) => {
          const config = STATUS_CONFIG[status.status];
          return (
            <div key={status.objection_id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bgColor} ${config.color}`}>
                  {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {status.objection_id.replace('obj_', '').replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>

                  {/* Recommendation if not addressed */}
                  {status.recommendation && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                      <p className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Sugestao
                      </p>
                      <p className="text-amber-800">{status.recommendation}</p>
                    </div>
                  )}

                  {/* View in transcript button */}
                  {status.detected_transcript_index && status.detected_transcript_index > 0 && onViewEvidence && (
                    <button
                      onClick={() => onViewEvidence(status.objection_id, status.detected_transcript_index!)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver na transcricao
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
