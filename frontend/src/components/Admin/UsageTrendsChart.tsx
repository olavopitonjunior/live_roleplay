import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { DailyAggregate } from '../../types';

interface Props {
  data: DailyAggregate[];
  loading: boolean;
}

export function UsageTrendsChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>Nenhum dado disponivel</p>
        </div>
      </div>
    );
  }

  // Reverse to show oldest first (left to right)
  const chartData = [...data].reverse().map((d) => ({
    ...d,
    date: d.date,
    displayDate: new Date(d.date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    }),
    cost_usd: d.total_cost_cents / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="displayDate"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          labelFormatter={(_, payload) => {
            if (payload?.[0]?.payload?.date) {
              return new Date(payload[0].payload.date).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
              });
            }
            return '';
          }}
          formatter={(value, name) => {
            const numValue = Number(value);
            if (name === 'Custo (USD)') return [`$${numValue.toFixed(2)}`, name];
            return [numValue.toLocaleString('pt-BR'), String(name)];
          }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '8px 12px',
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="session_count"
          name="Sessoes"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={{ fill: '#f59e0b', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cost_usd"
          name="Custo (USD)"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
