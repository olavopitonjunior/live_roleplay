# PRD 05: Analytics Dashboard

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Planejado |
| **Fase** | 4A - Enterprise |
| **Prioridade** | P2 (Media) |
| **Dependencias** | PRD-01, PRD-03 (metricas e gamificacao) |
| **Estimativa** | 4-5 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
Gestores de vendas nao tem **visibilidade** sobre a performance e evolucao de sua equipe no Live Roleplay. Nao conseguem identificar gaps de skill, comparar vendedores, ou provar ROI do treinamento.

### Oportunidade
Dashboard de analytics e o **principal driver de compra B2B**. Empresas precisam de dados para justificar investimento em treinamento. Sem isso, nao conseguimos escalar para enterprise.

### Hipotese
> "Gestores que tem acesso a dashboard de analytics tem 3x mais probabilidade de renovar e expandir o uso da plataforma."

---

## 2. Objetivos (OKRs)

### Objetivo
Fornecer visibilidade completa da performance da equipe para gestores, com insights acionaveis e comprovacao de ROI.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | 80% dos gestores acessam dashboard semanalmente | Mes 2 |
| KR2 | NPS de gestores > 50 | Mes 2 |
| KR3 | 3 pilots enterprise fechados | Mes 3 |
| KR4 | Tempo medio no dashboard > 5 min | Mes 2 |

---

## 3. User Stories

### US-01: Ver Visao Geral da Equipe
**Como** gestor de vendas
**Quero** ver um resumo da performance da minha equipe
**Para** ter visibilidade rapida do estado atual

**Criterios de Aceite**:
- [ ] Cards com metricas principais (usuarios ativos, sessoes, media score)
- [ ] Comparativo com periodo anterior
- [ ] Indicadores de tendencia (subindo/descendo)

### US-02: Comparar Vendedores
**Como** gestor de vendas
**Quero** comparar performance entre membros da equipe
**Para** identificar quem precisa de mais suporte

**Criterios de Aceite**:
- [ ] Tabela com todos vendedores
- [ ] Ordenacao por qualquer metrica
- [ ] Filtro por periodo
- [ ] Destaque para outliers (top/bottom performers)

### US-03: Identificar Gaps de Skill
**Como** gestor de vendas
**Quero** ver heatmap de competencias da equipe
**Para** focar treinamento onde mais precisa

**Criterios de Aceite**:
- [ ] Matriz vendedor x competencia
- [ ] Cores indicando nivel (verde/amarelo/vermelho)
- [ ] Competencias: talk ratio, objecoes, tempo resposta, etc
- [ ] Drill-down para detalhes

### US-04: Acompanhar Evolucao
**Como** gestor de vendas
**Quero** ver tendencias de performance ao longo do tempo
**Para** verificar se treinamento esta funcionando

**Criterios de Aceite**:
- [ ] Grafico de linha com evolucao de score medio
- [ ] Filtro por vendedor, cenario, periodo
- [ ] Comparativo antes/depois de intervencoes

### US-05: Exportar Relatorios
**Como** gestor de vendas
**Quero** exportar dados para apresentar a stakeholders
**Para** justificar investimento em treinamento

**Criterios de Aceite**:
- [ ] Export para PDF com graficos
- [ ] Export para CSV com dados brutos
- [ ] Relatorio mensal automatico (opcional)
- [ ] Personalizacao de metricas no relatorio

### US-06: Ver Detalhes de Sessao
**Como** gestor de vendas
**Quero** ver detalhes de sessoes especificas
**Para** fazer coaching individual com vendedor

**Criterios de Aceite**:
- [ ] Lista de sessoes com filtros
- [ ] Visualizar transcript completo
- [ ] Ver metricas e feedback da sessao
- [ ] Adicionar notas/comentarios

---

## 4. Requisitos Funcionais

### RF-01: Overview Cards

```typescript
interface OverviewMetrics {
  activeUsers: {
    current: number;
    previous: number;
    change: number;  // percentual
  };
  totalSessions: {
    current: number;
    previous: number;
    change: number;
  };
  avgScore: {
    current: number;
    previous: number;
    change: number;
  };
  avgSessionsPerUser: {
    current: number;
    previous: number;
    change: number;
  };
  completionRate: {
    current: number;
    previous: number;
    change: number;
  };
}
```

### RF-02: Tabela de Vendedores

```typescript
interface SellerPerformance {
  userId: string;
  name: string;
  totalSessions: number;
  avgScore: number;
  scoreImprovement: number;  // vs primeira sessao
  lastSessionDate: Date;
  currentStreak: number;
  level: number;
  badges: number;
  metrics: {
    avgTalkRatio: number;
    avgResponseTime: number;
    objectionHandlingRate: number;
  };
}

// Colunas da tabela
const columns = [
  { key: 'name', label: 'Vendedor', sortable: true },
  { key: 'totalSessions', label: 'Sessoes', sortable: true },
  { key: 'avgScore', label: 'Score Medio', sortable: true },
  { key: 'scoreImprovement', label: 'Evolucao', sortable: true },
  { key: 'avgTalkRatio', label: 'Talk Ratio', sortable: true },
  { key: 'objectionHandlingRate', label: 'Objecoes', sortable: true },
  { key: 'currentStreak', label: 'Streak', sortable: true },
  { key: 'level', label: 'Nivel', sortable: true },
];
```

### RF-03: Heatmap de Skills

```typescript
interface SkillHeatmap {
  sellers: Array<{
    id: string;
    name: string;
  }>;
  skills: Array<{
    id: string;
    name: string;
  }>;
  data: Array<{
    sellerId: string;
    skillId: string;
    score: number;  // 0-100
    level: 'excellent' | 'good' | 'needs_improvement' | 'critical';
  }>;
}

// Skills avaliados
const skills = [
  { id: 'talk_ratio', name: 'Escuta Ativa' },
  { id: 'response_time', name: 'Agilidade' },
  { id: 'objection_handling', name: 'Objecoes' },
  { id: 'rapport', name: 'Rapport' },  // Baseado em avatar emotion
  { id: 'methodology', name: 'Metodologia' },
  { id: 'closing', name: 'Fechamento' },
];
```

### RF-04: Graficos de Tendencia

```typescript
interface TrendData {
  period: 'day' | 'week' | 'month';
  data: Array<{
    date: string;
    avgScore: number;
    totalSessions: number;
    activeUsers: number;
  }>;
  filters: {
    sellerId?: string;
    scenarioId?: string;
    dateRange: [Date, Date];
  };
}
```

### RF-05: Export de Relatorios

```typescript
interface ReportConfig {
  type: 'pdf' | 'csv';
  sections: Array<'overview' | 'sellers' | 'skills' | 'trends' | 'sessions'>;
  dateRange: [Date, Date];
  filters: {
    sellerIds?: string[];
    scenarioIds?: string[];
  };
  customTitle?: string;
  includeCharts: boolean;  // Apenas PDF
}

// Edge Function para gerar PDF
// Usa biblioteca como @react-pdf/renderer ou puppeteer
```

### RF-06: Detalhes de Sessao

```typescript
interface SessionDetails {
  id: string;
  seller: { id: string; name: string };
  scenario: { id: string; title: string };
  startedAt: Date;
  duration: number;
  score: number;
  transcript: string;
  metrics: SessionMetrics;
  feedback: {
    summary: string;
    criteriaResults: CriteriaResult[];
  };
  managerNotes?: string;
}
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Performance
- Dashboard carrega em <3s
- Graficos renderizam em <500ms
- Export PDF gera em <10s

### RNF-02: Escalabilidade
- Suportar 1000+ usuarios por empresa
- Queries otimizadas para grandes volumes

### RNF-03: Seguranca
- Gestores so veem dados de sua equipe
- Logs de acesso a dados sensiveis
- Export requer autorizacao

---

## 6. Especificacao Tecnica

### 6.1 Arquitetura

```
+------------------+     +------------------+     +------------------+
|    Frontend      |     |   Edge Functions |     |    Supabase      |
|                  |     |                  |     |                  |
| /admin/analytics |---->| analytics-query  |---->| Materialized     |
| Charts (Recharts)|     | export-report    |     | Views            |
| DataTable        |     |                  |     | RLS Policies     |
+------------------+     +------------------+     +------------------+
```

### 6.2 Schema e Views

```sql
-- View materializada para performance por usuario
CREATE MATERIALIZED VIEW user_performance AS
SELECT
    ac.id as user_id,
    ac.code as user_code,
    COUNT(s.id) as total_sessions,
    AVG(f.score) as avg_score,
    MAX(f.score) - MIN(f.score) as score_range,
    AVG((s.metrics->>'talk_ratio')::float) as avg_talk_ratio,
    AVG((s.metrics->'response_latency'->>'avg_ms')::float) as avg_response_time,
    COUNT(CASE WHEN f.score >= 80 THEN 1 END)::float / NULLIF(COUNT(s.id), 0) as high_score_rate,
    MAX(s.started_at) as last_session,
    up.current_level,
    up.current_streak,
    (SELECT COUNT(*) FROM user_badges ub WHERE ub.access_code_id = ac.id) as badge_count
FROM access_codes ac
LEFT JOIN sessions s ON s.access_code_id = ac.id AND s.status = 'completed'
LEFT JOIN feedbacks f ON f.session_id = s.id
LEFT JOIN user_progress up ON up.access_code_id = ac.id
WHERE ac.is_active = true
GROUP BY ac.id, ac.code, up.current_level, up.current_streak;

-- Refresh periodico (a cada hora)
CREATE OR REPLACE FUNCTION refresh_user_performance()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_performance;
END;
$$ LANGUAGE plpgsql;

-- View para tendencias diarias
CREATE MATERIALIZED VIEW daily_trends AS
SELECT
    DATE(s.started_at) as date,
    COUNT(DISTINCT s.access_code_id) as active_users,
    COUNT(s.id) as total_sessions,
    AVG(f.score) as avg_score,
    AVG((s.metrics->>'talk_ratio')::float) as avg_talk_ratio
FROM sessions s
LEFT JOIN feedbacks f ON f.session_id = s.id
WHERE s.status = 'completed'
    AND s.started_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE(s.started_at)
ORDER BY date;

-- View para heatmap de skills
CREATE MATERIALIZED VIEW skill_scores AS
SELECT
    ac.id as user_id,
    ac.code as user_code,
    -- Talk Ratio Score (ideal: 40-60%)
    AVG(CASE
        WHEN (s.metrics->>'talk_ratio')::float BETWEEN 0.4 AND 0.6 THEN 100
        WHEN (s.metrics->>'talk_ratio')::float BETWEEN 0.3 AND 0.7 THEN 70
        ELSE 40
    END) as talk_ratio_score,
    -- Response Time Score
    AVG(CASE
        WHEN (s.metrics->'response_latency'->>'avg_ms')::float < 2000 THEN 100
        WHEN (s.metrics->'response_latency'->>'avg_ms')::float < 4000 THEN 70
        ELSE 40
    END) as response_time_score,
    -- Objection Handling Score
    AVG(CASE
        WHEN (s.metrics->'objections'->>'addressed')::int =
             (s.metrics->'objections'->>'raised')::int THEN 100
        WHEN (s.metrics->'objections'->>'addressed')::int >
             (s.metrics->'objections'->>'raised')::int * 0.5 THEN 70
        ELSE 40
    END) as objection_score,
    -- Overall Score
    AVG(f.score) as overall_score
FROM access_codes ac
LEFT JOIN sessions s ON s.access_code_id = ac.id AND s.status = 'completed'
LEFT JOIN feedbacks f ON f.session_id = s.id
WHERE ac.is_active = true
GROUP BY ac.id, ac.code;
```

### 6.3 Edge Function: analytics-query

```typescript
// supabase/functions/analytics-query/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

interface QueryParams {
  type: 'overview' | 'sellers' | 'trends' | 'skills' | 'sessions';
  dateRange?: [string, string];
  sellerId?: string;
  scenarioId?: string;
  limit?: number;
  offset?: number;
}

serve(async (req) => {
  const params: QueryParams = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let result;

  switch (params.type) {
    case 'overview':
      result = await getOverviewMetrics(supabase, params);
      break;
    case 'sellers':
      result = await getSellerPerformance(supabase, params);
      break;
    case 'trends':
      result = await getTrendData(supabase, params);
      break;
    case 'skills':
      result = await getSkillHeatmap(supabase, params);
      break;
    case 'sessions':
      result = await getSessionsList(supabase, params);
      break;
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  })
})

async function getOverviewMetrics(supabase: any, params: QueryParams) {
  const [startDate, endDate] = params.dateRange || [
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    new Date().toISOString()
  ];

  const prevStartDate = new Date(new Date(startDate).getTime() -
    (new Date(endDate).getTime() - new Date(startDate).getTime())).toISOString();

  // Current period
  const { data: current } = await supabase
    .from('sessions')
    .select('id, access_code_id, feedback:feedbacks(score)')
    .eq('status', 'completed')
    .gte('started_at', startDate)
    .lte('started_at', endDate);

  // Previous period
  const { data: previous } = await supabase
    .from('sessions')
    .select('id, access_code_id, feedback:feedbacks(score)')
    .eq('status', 'completed')
    .gte('started_at', prevStartDate)
    .lte('started_at', startDate);

  // Calculate metrics
  const currentUsers = new Set(current?.map(s => s.access_code_id)).size;
  const previousUsers = new Set(previous?.map(s => s.access_code_id)).size;

  const currentAvgScore = current?.reduce((sum, s) =>
    sum + (s.feedback?.score || 0), 0) / (current?.length || 1);
  const previousAvgScore = previous?.reduce((sum, s) =>
    sum + (s.feedback?.score || 0), 0) / (previous?.length || 1);

  return {
    activeUsers: {
      current: currentUsers,
      previous: previousUsers,
      change: previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0
    },
    totalSessions: {
      current: current?.length || 0,
      previous: previous?.length || 0,
      change: (previous?.length || 0) > 0 ?
        (((current?.length || 0) - (previous?.length || 0)) / (previous?.length || 1)) * 100 : 0
    },
    avgScore: {
      current: Math.round(currentAvgScore),
      previous: Math.round(previousAvgScore),
      change: previousAvgScore > 0 ? ((currentAvgScore - previousAvgScore) / previousAvgScore) * 100 : 0
    }
  };
}
```

### 6.4 Componentes Frontend

```typescript
// pages/admin/analytics.tsx
import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { OverviewCards } from '@/components/analytics/OverviewCards';
import { SellerTable } from '@/components/analytics/SellerTable';
import { SkillHeatmap } from '@/components/analytics/SkillHeatmap';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ExportButton } from '@/components/analytics/ExportButton';

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    subDays(new Date(), 30),
    new Date()
  ]);
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex gap-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <ExportButton dateRange={dateRange} />
        </div>
      </div>

      <OverviewCards dateRange={dateRange} />

      <div className="grid grid-cols-2 gap-6">
        <TrendChart dateRange={dateRange} sellerId={selectedSeller} />
        <SkillHeatmap dateRange={dateRange} />
      </div>

      <SellerTable
        dateRange={dateRange}
        onSellerClick={setSelectedSeller}
      />
    </div>
  );
}
```

```typescript
// components/analytics/SkillHeatmap.tsx
import { useMemo } from 'react';

interface SkillHeatmapProps {
  data: SkillScore[];
}

const skillLabels = {
  talk_ratio_score: 'Escuta Ativa',
  response_time_score: 'Agilidade',
  objection_score: 'Objecoes',
  overall_score: 'Score Geral'
};

const getColor = (score: number) => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

export function SkillHeatmap({ data }: SkillHeatmapProps) {
  const skills = Object.keys(skillLabels);

  return (
    <div className="bg-white rounded-lg p-4 shadow">
      <h3 className="font-semibold mb-4">Competencias da Equipe</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left p-2">Vendedor</th>
              {skills.map(skill => (
                <th key={skill} className="text-center p-2 text-sm">
                  {skillLabels[skill]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(seller => (
              <tr key={seller.user_id} className="border-t">
                <td className="p-2 font-medium">{seller.user_code}</td>
                {skills.map(skill => (
                  <td key={skill} className="p-2 text-center">
                    <div
                      className={`w-8 h-8 rounded mx-auto flex items-center justify-center
                                  text-white text-xs font-bold ${getColor(seller[skill])}`}
                    >
                      {Math.round(seller[skill])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-4 mt-4 text-sm">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded"></div> Excelente (80+)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-500 rounded"></div> Bom (60-79)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-orange-500 rounded"></div> Regular (40-59)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded"></div> Precisa Melhorar (&lt;40)
        </span>
      </div>
    </div>
  );
}
```

---

## 7. UI/UX

### Wireframe: Dashboard Principal

```
+------------------------------------------------------------------+
|  ANALYTICS                               [Ultimos 30 dias v] [Export]
+------------------------------------------------------------------+
|                                                                   |
|  +------------+  +------------+  +------------+  +------------+   |
|  | USUARIOS   |  | SESSOES    |  | SCORE MEDIO|  | ENGAJAMENTO|   |
|  | ATIVOS     |  |            |  |            |  |            |   |
|  |    25      |  |   342      |  |    74%     |  |   3.2/sem  |   |
|  |  +12% ↑    |  |  +8% ↑     |  |  +5% ↑     |  |  +15% ↑    |   |
|  +------------+  +------------+  +------------+  +------------+   |
|                                                                   |
|  +-----------------------------+  +-----------------------------+ |
|  | EVOLUCAO DE SCORE           |  | COMPETENCIAS DA EQUIPE      | |
|  |                             |  |                             | |
|  |    ^                        |  |      Esc  Agi  Obj  Sco     | |
|  | 80 |      ___/^^^^          |  | Ana  [85] [72] [90] [82]    | |
|  | 60 | ____/                  |  | Bob  [65] [80] [55] [68]    | |
|  | 40 |/                       |  | Car  [78] [68] [82] [76]    | |
|  |    +-------------------->   |  | Dan  [45] [55] [40] [47]    | |
|  |    Jan  Fev  Mar  Abr       |  |                             | |
|  +-----------------------------+  +-----------------------------+ |
|                                                                   |
|  PERFORMANCE POR VENDEDOR                          [Filtrar] [↓]  |
|  +--------------------------------------------------------------+ |
|  | Nome     | Sessoes | Score | Evolucao | Talk R | Objecoes | Niv|
|  |----------|---------|-------|----------|--------|----------|----| |
|  | Ana S.   |   45    |  82%  |  +18%    |  52%   |   90%    | 5  | |
|  | Carlos M.|   38    |  76%  |  +12%    |  58%   |   82%    | 4  | |
|  | Maria L. |   32    |  68%  |  +8%     |  65%   |   55%    | 3  | |
|  | Joao P.  |   28    |  47%  |  -2%     |  72%   |   40%    | 2  | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Wireframe: Detalhes de Sessao

```
+------------------------------------------------------------------+
|  < Voltar    SESSAO #abc123                                       |
+------------------------------------------------------------------+
|                                                                   |
|  Vendedor: Ana Silva           Cenario: Venda de Seguro           |
|  Data: 15/01/2026 14:32        Duracao: 2:45                      |
|                                                                   |
|  SCORE: 82%                                                       |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  +-----------------------------+  +-----------------------------+ |
|  | METRICAS                    |  | CRITERIOS                   | |
|  |                             |  |                             | |
|  | Talk Ratio: 55% ✓           |  | [✓] Identificou dor         | |
|  | Tempo Resp: 1.8s ✓          |  | [✓] Tratou objecao preco    | |
|  | Objecoes: 3/3 ✓             |  | [✓] Criou urgencia          | |
|  | Hesitacoes: 2               |  | [x] Pediu compromisso       | |
|  +-----------------------------+  +-----------------------------+ |
|                                                                   |
|  TRANSCRIPT                                                       |
|  +--------------------------------------------------------------+ |
|  | [Avatar] Boa tarde! Em que posso ajudar?                     | |
|  | [User] Oi, estou interessado em conhecer os planos de...     | |
|  | [Avatar] Claro! Antes, posso perguntar qual sua principal... | |
|  | ...                                                          | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  NOTAS DO GESTOR                                    [Editar]      |
|  +--------------------------------------------------------------+ |
|  | Ana demonstrou boa escuta ativa. Precisa trabalhar mais o    | |
|  | fechamento - nao pediu compromisso ao final.                 | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

## 8. Metricas de Sucesso

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Gestores acessando semanalmente | 0% | 80% | Analytics de acesso |
| Tempo medio no dashboard | N/A | >5 min | Analytics de sessao |
| Exports gerados/semana | N/A | 2 por gestor | Contagem de exports |
| NPS gestores | N/A | >50 | Survey trimestral |
| Pilots enterprise fechados | 0 | 3 | Pipeline de vendas |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Queries lentas com muitos dados | Alta | Alto | Views materializadas, paginacao |
| Dados sensiveis expostos | Media | Alto | RLS rigoroso, audit logs |
| Graficos confusos | Media | Medio | Testes de usabilidade |
| Export PDF pesado | Media | Baixo | Limitar paginas, compressao |

---

## 10. Criterios de Aceite (DoD)

- [ ] Overview cards com 4 metricas e comparativo
- [ ] Tabela de vendedores com ordenacao e filtros
- [ ] Heatmap de skills funcional
- [ ] Grafico de tendencias com filtros
- [ ] Export PDF e CSV
- [ ] Tela de detalhes de sessao
- [ ] Notas de gestor persistidas
- [ ] Views materializadas otimizadas
- [ ] RLS para multi-tenancy
- [ ] Testes E2E para fluxos principais
- [ ] Performance < 3s para carregar

---

## 11. Plano de Rollout

### Semana 1
- Views materializadas no Supabase
- Edge Function analytics-query
- Overview cards

### Semana 2
- Tabela de vendedores
- Heatmap de skills
- Filtros de data

### Semana 3
- Grafico de tendencias (Recharts)
- Detalhes de sessao
- Notas de gestor

### Semana 4
- Export PDF/CSV
- Otimizacoes de performance
- Testes E2E

### Semana 5
- Beta com gestores selecionados
- Ajustes de UX
- Rollout para todos gestores

---

## 12. Apendice

### A. Metricas Calculadas

| Metrica | Calculo | Fonte |
|---------|---------|-------|
| Score Medio | AVG(feedback.score) | feedbacks |
| Evolucao | (ultimo_score - primeiro_score) / primeiro_score | feedbacks |
| Talk Ratio | user_time / (user_time + avatar_time) | sessions.metrics |
| Taxa Objecoes | addressed / raised | sessions.metrics |
| Engajamento | sessoes / usuarios_ativos | sessions |

### B. Bibliotecas Recomendadas

- **Graficos**: Recharts (React-friendly, customizavel)
- **Tabelas**: TanStack Table (sorting, filtering, pagination)
- **Export PDF**: @react-pdf/renderer ou Puppeteer
- **Export CSV**: papaparse
- **Date Picker**: react-day-picker

### C. Referencias

- [Gong Analytics Dashboard](https://www.gong.io/product/analytics/)
- [Salesforce Einstein Analytics](https://www.salesforce.com/products/einstein-analytics/)
- [HubSpot Sales Analytics](https://www.hubspot.com/products/sales/analytics)
