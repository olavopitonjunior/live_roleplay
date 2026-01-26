import { useState } from 'react';
import type { ApiMetric } from '../../types';

interface Props {
  metrics: ApiMetric[];
  loading: boolean;
}

export function MetricsTable({ metrics, loading }: Props) {
  const [sortField, setSortField] = useState<keyof ApiMetric>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Cenario</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Tokens</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Custo</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Duracao</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse" /></td>
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-32 animate-pulse" /></td>
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse" /></td>
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse" /></td>
                <td className="py-3 px-4"><div className="h-4 bg-gray-200 rounded w-16 ml-auto animate-pulse" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>Nenhuma metrica encontrada</p>
      </div>
    );
  }

  const handleSort = (field: keyof ApiMetric) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedMetrics = [...metrics].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ field }: { field: keyof ApiMetric }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th
              className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              onClick={() => handleSort('created_at')}
            >
              Data <SortIcon field="created_at" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
              Cenario
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              onClick={() => handleSort('gemini_live_input_tokens')}
            >
              Gemini <SortIcon field="gemini_live_input_tokens" />
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              onClick={() => handleSort('claude_input_tokens')}
            >
              Claude <SortIcon field="claude_input_tokens" />
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              onClick={() => handleSort('estimated_cost_cents')}
            >
              Custo <SortIcon field="estimated_cost_cents" />
            </th>
            <th
              className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
              onClick={() => handleSort('simli_duration_seconds')}
            >
              Duracao <SortIcon field="simli_duration_seconds" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMetrics.map((metric) => {
            const totalGeminiTokens =
              (metric.gemini_live_input_tokens || 0) +
              (metric.gemini_live_output_tokens || 0);
            const totalClaudeTokens =
              (metric.claude_input_tokens || 0) +
              (metric.claude_output_tokens || 0);
            const costUsd = (metric.estimated_cost_cents || 0) / 100;
            const durationMin = (metric.simli_duration_seconds || 0) / 60;

            return (
              <tr key={metric.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">
                  {new Date(metric.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {metric.sessions?.scenarios?.title || '-'}
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900">
                  {totalGeminiTokens >= 1000
                    ? `${(totalGeminiTokens / 1000).toFixed(1)}K`
                    : totalGeminiTokens}
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-900">
                  {totalClaudeTokens >= 1000
                    ? `${(totalClaudeTokens / 1000).toFixed(1)}K`
                    : totalClaudeTokens}
                </td>
                <td className="py-3 px-4 text-sm text-right font-medium text-green-600">
                  ${costUsd.toFixed(3)}
                </td>
                <td className="py-3 px-4 text-sm text-right text-gray-600">
                  {durationMin.toFixed(1)} min
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
