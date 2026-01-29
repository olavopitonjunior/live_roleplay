import type { ReactNode } from 'react';
import type { KeyMoment } from '../../types';

interface KeyMomentsTimelineProps {
  moments: KeyMoment[];
  onMomentClick?: (index: number) => void;
}

const MOMENT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: ReactNode }> = {
  positive: {
    label: 'Positivo',
    color: 'text-green-700',
    bgColor: 'bg-green-100 border-green-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
    ),
  },
  negative: {
    label: 'A melhorar',
    color: 'text-red-700',
    bgColor: 'bg-red-100 border-red-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
      </svg>
    ),
  },
  opportunity: {
    label: 'Oportunidade',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100 border-blue-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  objection: {
    label: 'Objecao',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100 border-orange-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  empathy: {
    label: 'Empatia',
    color: 'text-pink-700',
    bgColor: 'bg-pink-100 border-pink-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  closing: {
    label: 'Fechamento',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100 border-purple-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  risk: {
    label: 'Risco',
    color: 'text-red-700',
    bgColor: 'bg-red-100 border-red-300',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
};

export function KeyMomentsTimeline({ moments, onMomentClick }: KeyMomentsTimelineProps) {
  if (!moments || moments.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-black flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Momentos-Chave ({moments.length})
        </h3>
      </div>

      {/* Timeline */}
      <div className="p-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Moments */}
          <div className="space-y-4">
            {moments.map((moment, index) => {
              const config = MOMENT_CONFIG[moment.type] || MOMENT_CONFIG.positive;
              return (
                <div key={index} className="relative flex gap-4 pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${config.bgColor} border ${config.color}`}
                  >
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 p-3 rounded-lg border ${config.bgColor} cursor-pointer hover:shadow-sm transition-shadow`}
                    onClick={() => moment.transcript_index && onMomentClick?.(moment.transcript_index)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 italic mb-2">
                      "{moment.quote}"
                    </p>
                    <p className="text-xs text-gray-600">
                      {moment.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
