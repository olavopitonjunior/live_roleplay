import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ApiMetric, MetricsTotals, DailyAggregate, MetricsFilters, MetricsResponse } from '../types';

export function useApiMetrics() {
  const [metrics, setMetrics] = useState<ApiMetric[]>([]);
  const [totals, setTotals] = useState<MetricsTotals | null>(null);
  const [dailyAggregates, setDailyAggregates] = useState<DailyAggregate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (
    accessCode: string | null,
    filters: MetricsFilters = { startDate: null, endDate: null, scenarioId: null }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.scenarioId) params.append('scenario_id', filters.scenarioId);
      params.append('limit', '500'); // Get more data for charts

      // Build headers — prefer JWT session token, fallback to access code
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        headers['Authorization'] = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`;
        if (accessCode) headers['x-access-code'] = accessCode;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-api-metrics?${params}`,
        { headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: MetricsResponse = await response.json();
      setMetrics(data.metrics);
      setTotals(data.totals);
      setDailyAggregates(data.daily_aggregates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar metricas';
      setError(message);
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMetrics = useCallback(() => {
    setMetrics([]);
    setTotals(null);
    setDailyAggregates([]);
    setError(null);
  }, []);

  return {
    metrics,
    totals,
    dailyAggregates,
    loading,
    error,
    fetchMetrics,
    clearMetrics,
  };
}
