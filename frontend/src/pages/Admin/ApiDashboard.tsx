import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useApiMetrics } from '../../hooks/useApiMetrics';
import { useScenarios } from '../../hooks/useScenarios';
import {
  MetricsOverview,
  UsageTrendsChart,
  CostBreakdownChart,
  MetricsFilters,
  MetricsTable,
} from '../../components/Admin';
import type { MetricsFilters as MetricsFiltersType } from '../../types';

export function ApiDashboard() {
  const navigate = useNavigate();
  const { accessCode } = useAuth();
  const { scenarios } = useScenarios();
  const {
    metrics,
    totals,
    dailyAggregates,
    loading,
    error,
    fetchMetrics,
  } = useApiMetrics();

  // Calculate default date range (last 30 days)
  const getDefaultDateRange = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      scenarioId: null,
    };
  }, []);

  const [filters, setFilters] = useState<MetricsFiltersType>(getDefaultDateRange);

  // Fetch metrics on mount and when filters change
  useEffect(() => {
    if (accessCode?.code) {
      fetchMetrics(accessCode.code, filters);
    }
  }, [accessCode, filters, fetchMetrics]);

  const handleFilterChange = (newFilters: MetricsFiltersType) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    if (accessCode?.code) {
      fetchMetrics(accessCode.code, filters);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 sticky top-0 z-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/home')}
                className="text-gray-600 hover:text-black transition-colors"
              >
                ← Voltar
              </button>
              <div>
                <h1 className="text-xl font-bold text-black">API Usage Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Monitore o uso de APIs e custos estimados
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                         rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500">⚠</span>
              <div>
                <h3 className="font-medium text-red-800">Erro ao carregar metricas</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="text-sm text-red-700 underline mt-2 hover:text-red-800"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <MetricsFilters
          filters={filters}
          scenarios={scenarios}
          onFiltersChange={handleFilterChange}
        />

        {/* Overview Cards */}
        <MetricsOverview totals={totals} loading={loading} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UsageTrendsChart data={dailyAggregates} loading={loading} />
          <CostBreakdownChart totals={totals} loading={loading} />
        </div>

        {/* Detailed Table */}
        <MetricsTable metrics={metrics} loading={loading} />

        {/* Empty State */}
        {!loading && !error && metrics.length === 0 && (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-black mb-2">
              Nenhuma metrica encontrada
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Nao ha dados de uso de API para o periodo selecionado.
              Tente ajustar os filtros ou aguarde novas sessoes serem realizadas.
            </p>
            <button
              onClick={() => setFilters(getDefaultDateRange())}
              className="text-sm text-gray-600 underline hover:text-black"
            >
              Resetar filtros
            </button>
          </div>
        )}

        {/* Info Footer */}
        <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
          <h4 className="font-medium text-gray-700 mb-2">Sobre os custos estimados</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>OpenAI Realtime: $40/1M input tokens, $200/1M output tokens</li>
            <li>GPT-4o-mini: $0.15/1M input tokens, $0.60/1M output tokens</li>
            <li>Claude Sonnet: $3/1M input tokens, $15/1M output tokens</li>
            <li>Hedra Avatar: ~$0.015/minuto</li>
            <li>LiveKit WebRTC: ~$0.004/participante-minuto</li>
          </ul>
          <p className="mt-2 text-gray-500">
            * Custos sao estimativas baseadas em precos publicos das APIs
          </p>
        </div>
      </main>
    </div>
  );
}
