import type { MetricsTotals } from '../../types';
import { Card } from '../ui';

interface Props {
  totals: MetricsTotals | null;
  loading: boolean;
}

export function MetricsOverview({ totals, loading }: Props) {
  const stats = [
    {
      label: 'Total de Sessoes',
      value: totals?.total_sessions ?? 0,
      format: (v: number) => v.toLocaleString('pt-BR'),
      color: 'bg-yellow-100 text-yellow-800',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Custo Estimado',
      value: totals?.estimated_cost_usd ?? 0,
      format: (v: number) => `$${v.toFixed(2)}`,
      color: 'bg-green-100 text-green-800',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Tokens Realtime',
      value: totals?.realtime_tokens ?? 0,
      format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(),
      color: 'bg-blue-100 text-blue-800',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      label: 'Tokens Claude',
      value: totals?.claude_tokens ?? 0,
      format: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString(),
      color: 'bg-purple-100 text-purple-800',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      label: 'Minutos Avatar',
      value: totals?.avatar_minutes ?? 0,
      format: (v: number) => `${v.toFixed(1)} min`,
      color: 'bg-pink-100 text-pink-800',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((_, i) => (
          <Card key={i} padding="sm">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mx-auto mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16 mx-auto" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} padding="sm" className="hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className={`p-2 rounded-full ${stat.color} mb-2`}>
              {stat.icon}
            </div>
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900">
              {stat.format(stat.value)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
