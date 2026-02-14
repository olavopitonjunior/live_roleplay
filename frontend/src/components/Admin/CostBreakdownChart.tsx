import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { MetricsTotals } from '../../types';

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'];

// API pricing constants (USD)
const PRICING = {
  openai_realtime_per_1k: 0.12, // Average of input ($40/1M) and output ($200/1M)
  openai_mini_per_call: 0.0004, // Rough average per call (~200 tokens)
  claude_per_1k: 0.009, // Average of input/output
  avatar_per_minute: 0.015,
  livekit_per_minute: 0.004,
};

interface Props {
  totals: MetricsTotals | null;
  loading: boolean;
}

export function CostBreakdownChart({ totals, loading }: Props) {
  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
      </div>
    );
  }

  if (!totals || totals.total_sessions === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p>Nenhum dado disponivel</p>
        </div>
      </div>
    );
  }

  // Calculate cost breakdown by API
  const data = [
    {
      name: 'OpenAI Realtime',
      value: (totals.realtime_tokens / 1000) * PRICING.openai_realtime_per_1k,
      color: COLORS[0],
    },
    {
      name: 'GPT-4o-mini',
      value: totals.text_api_calls * PRICING.openai_mini_per_call,
      color: COLORS[1],
    },
    {
      name: 'Claude',
      value: (totals.claude_tokens / 1000) * PRICING.claude_per_1k,
      color: COLORS[2],
    },
    {
      name: 'Avatar (Hedra)',
      value: totals.avatar_minutes * PRICING.avatar_per_minute,
      color: COLORS[3],
    },
    {
      name: 'LiveKit',
      value: totals.livekit_minutes * PRICING.livekit_per_minute,
      color: COLORS[4],
    },
  ].filter((item) => item.value > 0);

  const totalCost = data.reduce((sum, item) => sum + item.value, 0);

  // Custom label renderer
  const renderLabel = ({ name, value, percent }: { name?: string; value?: number; percent?: number }) => {
    if (!name || value === undefined || percent === undefined) return null;
    if (percent < 0.05) return null; // Don't show labels for tiny slices
    return `${name}: $${value.toFixed(2)}`;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            dataKey="value"
            label={renderLabel}
            labelLine={true}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Custo']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
            }}
          />
          <Legend
            formatter={(value) => {
              const item = data.find((d) => d.name === value);
              const percent = item ? ((item.value / totalCost) * 100).toFixed(1) : '0';
              return <span className="text-sm text-gray-600">{value} ({percent}%)</span>;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
