import type { MetricsFilters as Filters, Scenario } from '../../types';

interface Props {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  scenarios: Scenario[];
}

export function MetricsFilters({ filters, onFiltersChange, scenarios }: Props) {
  // Get default date range (last 30 days)
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Date Range */}
      <div className="flex gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data Inicio</label>
          <input
            type="date"
            value={filters.startDate || thirtyDaysAgo}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:border-black focus:ring-0 transition-colors outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
          <input
            type="date"
            value={filters.endDate || today}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value || null })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                       focus:border-black focus:ring-0 transition-colors outline-none"
          />
        </div>
      </div>

      {/* Scenario Filter */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cenario</label>
        <select
          value={filters.scenarioId || ''}
          onChange={(e) => onFiltersChange({ ...filters, scenarioId: e.target.value || null })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]
                     focus:border-black focus:ring-0 transition-colors outline-none"
        >
          <option value="">Todos os cenarios</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Date Presets */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            onFiltersChange({ ...filters, startDate: last7, endDate: today });
          }}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50
                     transition-colors"
        >
          7 dias
        </button>
        <button
          onClick={() => {
            onFiltersChange({ ...filters, startDate: thirtyDaysAgo, endDate: today });
          }}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50
                     transition-colors"
        >
          30 dias
        </button>
        <button
          onClick={() => {
            const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            onFiltersChange({ ...filters, startDate: last90, endDate: today });
          }}
          className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50
                     transition-colors"
        >
          90 dias
        </button>
      </div>

      {/* Clear Filters */}
      {(filters.startDate || filters.endDate || filters.scenarioId) && (
        <button
          onClick={() => onFiltersChange({ startDate: null, endDate: null, scenarioId: null })}
          className="px-3 py-2 text-xs text-red-600 hover:text-red-700 transition-colors"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
