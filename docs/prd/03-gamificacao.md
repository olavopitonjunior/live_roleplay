# PRD 03: Gamificacao

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Planejado |
| **Fase** | 2 - Engagement |
| **Prioridade** | P1 (Alta) |
| **Dependencias** | PRD-01 (metricas para calcular XP) |
| **Estimativa** | 4-5 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
Usuarios completam algumas sessoes de roleplay mas **nao desenvolvem habito** de treino regular. Sem motivacao extrinseca, a frequencia de uso cai drasticamente apos a primeira semana.

### Oportunidade
Gamificacao e comprovadamente eficaz em treinamento corporativo:
- SAP Roadwarrior: +12% sales performance
- Deloitte Leadership Academy: +47% engagement
- Cisco Training: +24% completion rates

### Hipotese
> "Sistema de XP, badges e leaderboard aumenta frequencia de treino em 50% e retencao D30 em 30%."

---

## 2. Objetivos (OKRs)

### Objetivo
Criar sistema de gamificacao que incentive pratica regular e progressao continua.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | Sessoes/semana/usuario de 2 para 3 | Semana 4 |
| KR2 | D7 Retention de 30% para 45% | Semana 4 |
| KR3 | 60% dos usuarios ativos com badges | Semana 3 |
| KR4 | 80% dos usuarios visualizam leaderboard | Semana 4 |

---

## 3. User Stories

### US-01: Ganhar XP
**Como** vendedor em treinamento
**Quero** ganhar pontos de experiencia ao completar sessoes
**Para** sentir que estou progredindo

**Criterios de Aceite**:
- [ ] XP concedido ao finalizar sessao
- [ ] Popup animado mostra XP ganho
- [ ] Breakdown de como XP foi calculado
- [ ] XP total visivel no perfil

### US-02: Subir de Nivel
**Como** vendedor em treinamento
**Quero** subir de nivel conforme acumulo XP
**Para** ter senso de progressao e desbloqueios

**Criterios de Aceite**:
- [ ] 8 niveis com titulos distintos
- [ ] Barra de progresso ate proximo nivel
- [ ] Animacao especial ao subir de nivel
- [ ] Niveis desbloqueiam features/cenarios

### US-03: Conquistar Badges
**Como** vendedor em treinamento
**Quero** conquistar badges por achievements
**Para** mostrar minhas habilidades

**Criterios de Aceite**:
- [ ] 11 badges conquistaveis
- [ ] Notificacao ao conquistar badge
- [ ] Badges exibidos no perfil
- [ ] Badges travados visiveis (incentivo)

### US-04: Manter Streak
**Como** vendedor em treinamento
**Quero** manter um streak diario de treinos
**Para** criar habito de pratica

**Criterios de Aceite**:
- [ ] Streak incrementa com sessao diaria
- [ ] Streak visivel em destaque
- [ ] Alerta se streak em risco de perder
- [ ] Bonus XP por streak longo

### US-05: Ver Leaderboard
**Como** vendedor em treinamento
**Quero** ver minha posicao no ranking
**Para** me motivar competindo com colegas

**Criterios de Aceite**:
- [ ] Ranking semanal por XP
- [ ] Top 5 em destaque
- [ ] Minha posicao sempre visivel
- [ ] Filtro por equipe (quando aplicavel)

### US-06: Ver Perfil Completo
**Como** vendedor em treinamento
**Quero** ver meu perfil com todas conquistas
**Para** acompanhar meu progresso geral

**Criterios de Aceite**:
- [ ] Nivel e XP atual
- [ ] Badges conquistados
- [ ] Streak atual e recorde
- [ ] Estatisticas gerais (total sessoes, media score)

---

## 4. Requisitos Funcionais

### RF-01: Sistema de XP

#### Tabela de XP

| Acao | XP Base | Condicao | Limite |
|------|---------|----------|--------|
| Completar sessao | 50 | Sempre | - |
| Score 70-84% | +25 | Por sessao | - |
| Score 85-100% | +50 | Por sessao | - |
| Melhoria vs ultima sessao (mesmo cenario) | +20 | Delta > 5 pontos | - |
| Tratar todas objecoes | +30 | 100% addressed | - |
| Talk ratio ideal (40-60%) | +15 | Por sessao | - |
| Tempo resposta < 2s media | +10 | Por sessao | - |
| Streak diario | +10 * dias | Consecutivo | Max 70 (7 dias) |
| Primeiro cenario de um tipo | +100 | Uma vez | Por cenario |
| Primeira sessao do dia | +20 | Uma vez | Por dia |

#### Calculo de XP

```python
def calculate_session_xp(session: Session, feedback: Feedback, user: User) -> XPResult:
    xp = 50  # Base por completar
    breakdown = [{"reason": "Sessao completada", "xp": 50}]

    # Bonus por score
    if feedback.score >= 85:
        xp += 50
        breakdown.append({"reason": "Score excelente (85%+)", "xp": 50})
    elif feedback.score >= 70:
        xp += 25
        breakdown.append({"reason": "Bom score (70%+)", "xp": 25})

    # Bonus por melhoria
    last_session = get_last_session_same_scenario(user, session.scenario_id)
    if last_session and feedback.score > last_session.feedback.score + 5:
        xp += 20
        breakdown.append({"reason": "Melhoria vs anterior", "xp": 20})

    # Bonus por objecoes
    metrics = session.metrics
    if metrics.objections.raised and len(metrics.objections.ignored) == 0:
        xp += 30
        breakdown.append({"reason": "Todas objecoes tratadas", "xp": 30})

    # Bonus por talk ratio
    ratio = metrics.talk_ratio.ratio
    if 0.4 <= ratio <= 0.6:
        xp += 15
        breakdown.append({"reason": "Talk ratio ideal", "xp": 15})

    # Bonus por tempo resposta
    if metrics.response_latency.avg_ms < 2000:
        xp += 10
        breakdown.append({"reason": "Respostas rapidas", "xp": 10})

    # Bonus por streak
    streak = user.progress.current_streak + 1  # Inclui esta sessao
    streak_bonus = min(streak * 10, 70)
    if streak_bonus > 0:
        xp += streak_bonus
        breakdown.append({"reason": f"Streak de {streak} dias", "xp": streak_bonus})

    # Bonus primeira sessao do dia
    if not has_session_today(user, session):
        xp += 20
        breakdown.append({"reason": "Primeira do dia", "xp": 20})

    # Bonus primeiro cenario
    if is_first_scenario_type(user, session.scenario_id):
        xp += 100
        breakdown.append({"reason": "Novo tipo de cenario!", "xp": 100})

    return XPResult(total=xp, breakdown=breakdown)
```

### RF-02: Sistema de Niveis

| Nivel | XP Necessario | Titulo | Unlock |
|-------|---------------|--------|--------|
| 1 | 0 | Novato | Cenarios basicos (3) |
| 2 | 200 | Aprendiz | Badge "Primeiro Passo" |
| 3 | 500 | Praticante | Cenarios intermediarios (2) |
| 4 | 1.000 | Vendedor | Coaching hints na sessao |
| 5 | 2.000 | Negociador | Cenarios avancados (2) |
| 6 | 4.000 | Expert | Metricas detalhadas |
| 7 | 7.000 | Mestre | Criar cenarios custom (futuro) |
| 8 | 10.000 | Lenda | Badge especial, avatar exclusivo |

### RF-03: Sistema de Badges

#### Badges de Progresso

| Badge | ID | Criterio | XP Bonus |
|-------|-----|----------|----------|
| Primeira Vitoria | `first_win` | Completar 1a sessao | 50 |
| Em Chamas | `on_fire` | 7 dias de streak | 100 |
| Incansavel | `unstoppable` | 30 dias de streak | 500 |
| Perfeccionista | `perfectionist` | Score 100% em qualquer cenario | 200 |
| Evolucao | `evolution` | Melhorar 20+ pts em um cenario | 75 |

#### Badges de Skill

| Badge | ID | Criterio | XP Bonus |
|-------|-----|----------|----------|
| Mestre das Objecoes | `objection_master` | Tratar todas objecoes em 5 cenarios | 150 |
| Escuta Ativa | `active_listener` | Talk ratio < 50% em 3 sessoes | 100 |
| Resposta Rapida | `quick_response` | Media < 1s em sessao completa | 75 |
| Encantador | `charmer` | Avatar happy 70%+ em 3 sessoes | 150 |

#### Badges Raros

| Badge | ID | Criterio | XP Bonus |
|-------|-----|----------|----------|
| Campeao Semanal | `weekly_champion` | #1 no leaderboard semanal | 300 |
| Consistencia | `consistency` | 30 dias de streak | 500 |

### RF-04: Sistema de Streaks

```python
class StreakManager:
    def update_streak(self, user: User, session_date: date) -> StreakResult:
        progress = user.progress
        last_date = progress.last_session_date

        if last_date is None:
            # Primeira sessao
            progress.current_streak = 1
        elif session_date == last_date:
            # Ja treinou hoje, streak mantem
            pass
        elif session_date == last_date + timedelta(days=1):
            # Dia consecutivo, incrementa
            progress.current_streak += 1
        else:
            # Quebrou streak
            progress.current_streak = 1

        # Atualizar recorde
        if progress.current_streak > progress.longest_streak:
            progress.longest_streak = progress.current_streak

        progress.last_session_date = session_date

        return StreakResult(
            current=progress.current_streak,
            longest=progress.longest_streak,
            is_new_record=progress.current_streak == progress.longest_streak
        )
```

### RF-05: Leaderboard

```sql
-- View materializada para leaderboard semanal
CREATE MATERIALIZED VIEW weekly_leaderboard AS
SELECT
    ac.id as access_code_id,
    ac.code as user_code,
    COALESCE(SUM(
        CASE
            WHEN s.started_at >= date_trunc('week', CURRENT_DATE)
            THEN (s.metrics->>'xp_earned')::int
            ELSE 0
        END
    ), 0) as week_xp,
    up.current_streak,
    up.current_level,
    RANK() OVER (ORDER BY week_xp DESC) as rank
FROM access_codes ac
LEFT JOIN sessions s ON s.access_code_id = ac.id
LEFT JOIN user_progress up ON up.access_code_id = ac.id
WHERE ac.is_active = true
GROUP BY ac.id, ac.code, up.current_streak, up.current_level;

-- Refresh diario
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW weekly_leaderboard;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Performance
- Calculo de XP em <100ms
- Leaderboard carrega em <500ms
- Verificacao de badges em <200ms

### RNF-02: Consistencia
- XP nunca pode ser negativo
- Badges uma vez conquistados nao podem ser perdidos
- Streak reset acontece apenas em 00:00 UTC

### RNF-03: Fairness
- Mesmo usuario nao pode aparecer 2x no leaderboard
- Bots/testes excluidos do ranking
- Anti-cheat basico (sessoes muito curtas nao contam)

---

## 6. Especificacao Tecnica

### 6.1 Schema do Banco de Dados

```sql
-- Tabela de progresso do usuario
CREATE TABLE user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code_id UUID UNIQUE REFERENCES access_codes(id) ON DELETE CASCADE,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_session_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice para queries frequentes
CREATE INDEX idx_user_progress_xp ON user_progress(total_xp DESC);
CREATE INDEX idx_user_progress_streak ON user_progress(current_streak DESC);

-- Tabela de badges conquistados
CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code_id UUID REFERENCES access_codes(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    session_id UUID REFERENCES sessions(id),  -- Sessao que triggou
    UNIQUE(access_code_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(access_code_id);

-- Tabela de historico de XP (para auditoria)
CREATE TABLE xp_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_code_id UUID REFERENCES access_codes(id),
    session_id UUID REFERENCES sessions(id),
    xp_earned INTEGER NOT NULL,
    breakdown JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar campo xp_earned na sessions
ALTER TABLE sessions ADD COLUMN xp_earned INTEGER DEFAULT 0;

-- Trigger para atualizar user_progress
CREATE OR REPLACE FUNCTION update_user_progress_on_session()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_progress (access_code_id, total_xp, current_level)
    VALUES (NEW.access_code_id, NEW.xp_earned, 1)
    ON CONFLICT (access_code_id)
    DO UPDATE SET
        total_xp = user_progress.total_xp + NEW.xp_earned,
        current_level = calculate_level(user_progress.total_xp + NEW.xp_earned),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_progress
AFTER INSERT ON sessions
FOR EACH ROW
WHEN (NEW.status = 'completed' AND NEW.xp_earned > 0)
EXECUTE FUNCTION update_user_progress_on_session();

-- Funcao para calcular nivel
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE
        WHEN xp >= 10000 THEN 8
        WHEN xp >= 7000 THEN 7
        WHEN xp >= 4000 THEN 6
        WHEN xp >= 2000 THEN 5
        WHEN xp >= 1000 THEN 4
        WHEN xp >= 500 THEN 3
        WHEN xp >= 200 THEN 2
        ELSE 1
    END;
END;
$$ LANGUAGE plpgsql;
```

### 6.2 Edge Function: calculate-xp

```typescript
// supabase/functions/calculate-xp/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

interface XPBreakdown {
  reason: string;
  xp: number;
}

serve(async (req) => {
  const { session_id } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Buscar sessao com feedback e metricas
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      feedback:feedbacks(*),
      scenario:scenarios(*)
    `)
    .eq('id', session_id)
    .single()

  if (!session || !session.feedback) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
  }

  // Calcular XP
  const breakdown: XPBreakdown[] = []
  let xp = 50
  breakdown.push({ reason: 'Sessao completada', xp: 50 })

  // ... logica de calculo conforme RF-01 ...

  // Atualizar sessao com XP
  await supabase
    .from('sessions')
    .update({ xp_earned: xp })
    .eq('id', session_id)

  // Salvar historico
  await supabase.from('xp_history').insert({
    access_code_id: session.access_code_id,
    session_id: session_id,
    xp_earned: xp,
    breakdown: breakdown
  })

  // Verificar badges
  const newBadges = await checkAndAwardBadges(supabase, session.access_code_id, session)

  return new Response(JSON.stringify({
    xp_earned: xp,
    breakdown,
    new_badges: newBadges
  }))
})
```

### 6.3 Hooks Frontend

```typescript
// hooks/useGamification.ts
export function useGamification() {
  const { accessCode } = useAuth()
  const supabase = useSupabase()

  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ['user-progress', accessCode?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_progress')
        .select('*')
        .eq('access_code_id', accessCode?.id)
        .single()
      return data
    },
    enabled: !!accessCode
  })

  const { data: badges } = useQuery({
    queryKey: ['user-badges', accessCode?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('*')
        .eq('access_code_id', accessCode?.id)
        .order('earned_at', { ascending: false })
      return data
    },
    enabled: !!accessCode
  })

  const { data: leaderboard } = useQuery({
    queryKey: ['weekly-leaderboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('weekly_leaderboard')
        .select('*')
        .order('rank', { ascending: true })
        .limit(10)
      return data
    }
  })

  const xpToNextLevel = useMemo(() => {
    if (!progress) return 0
    const levelThresholds = [0, 200, 500, 1000, 2000, 4000, 7000, 10000]
    const nextLevel = Math.min(progress.current_level + 1, 8)
    return levelThresholds[nextLevel - 1] - progress.total_xp
  }, [progress])

  return {
    progress,
    badges,
    leaderboard,
    xpToNextLevel,
    refetchProgress
  }
}
```

### 6.4 Componentes UI

```typescript
// components/gamification/XPPopup.tsx
// Popup animado que aparece ao ganhar XP

// components/gamification/LevelUpModal.tsx
// Modal de celebracao ao subir de nivel

// components/gamification/BadgeCard.tsx
// Card individual de badge (conquistado ou locked)

// components/gamification/BadgeGrid.tsx
// Grid com todos badges disponiveis

// components/gamification/LeaderboardCard.tsx
// Card com top 5 e posicao do usuario

// components/gamification/StreakIndicator.tsx
// Indicador de streak com icone de fogo

// components/gamification/ProfileHeader.tsx
// Header do perfil com nivel, XP, streak

// components/gamification/XPProgressBar.tsx
// Barra de progresso ate proximo nivel
```

---

## 7. UI/UX

### Wireframe: XP Popup

```
+----------------------------------+
|                                  |
|        +150 XP                   |
|        ⭐⭐⭐                      |
|                                  |
|  +50  Sessao completada          |
|  +50  Score excelente            |
|  +30  Todas objecoes tratadas    |
|  +20  Streak de 3 dias           |
|                                  |
|     [Ver Progresso]              |
+----------------------------------+
```

### Wireframe: Profile Header

```
+----------------------------------------------------------+
|  NIVEL 4 - VENDEDOR                                       |
|  ████████████░░░░░░  1.250 / 2.000 XP                    |
|                                                           |
|  🔥 5 dias de streak          📊 23 sessoes              |
|  🏆 #3 no ranking             ⭐ 6 badges                 |
+----------------------------------------------------------+
```

### Wireframe: Badge Grid

```
+----------------------------------------------------------+
|  SUAS CONQUISTAS                           6/11 badges    |
+----------------------------------------------------------+
|                                                           |
|  [🎯]        [🔥]        [💯]        [📈]                |
|  Primeira    Em Chamas   Perfeito   Evolucao             |
|  Vitoria     ✓           ✓          ✓                    |
|                                                           |
|  [🛡️]        [👂]        [⚡]        [😊]                |
|  Mestre      Escuta      Rapido     Encantador           |
|  Objecoes    Ativa ✓     ✓          🔒                   |
|                                                           |
|  [🏆]        [🌟]        [🎓]                            |
|  Campeao    Consistencia Mentor                          |
|  🔒         🔒           🔒                              |
+----------------------------------------------------------+
```

### Wireframe: Leaderboard

```
+----------------------------------------------------------+
|  🏆 RANKING SEMANAL                                       |
+----------------------------------------------------------+
|                                                           |
|  #1  👑 Maria S.     1,250 XP  ⬆️2   🔥14                |
|  #2     Joao P.      1,180 XP  ⬆️1   🔥7                 |
|  #3  ⭐ Voce         1,050 XP  ⬇️2   🔥5     <- Destaque |
|  #4     Ana R.         980 XP  ⬆️3   🔥5                 |
|  #5     Carlos M.      920 XP  ➡️    🔥2                 |
|                                                           |
|  ------------------------------------------------------- |
|  Sua posicao: 3º de 25 participantes                     |
|  Para subir: +200 XP ate domingo                         |
+----------------------------------------------------------+
```

---

## 8. Metricas de Sucesso

| Metrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| Sessoes/semana/usuario | 2.0 | 3.0 | AVG(sessions) per user per week |
| D7 Retention | 30% | 45% | Cohort analysis |
| D30 Retention | 15% | 25% | Cohort analysis |
| % usuarios com badge | 0% | 60% | COUNT(distinct users with badge) |
| % usuarios que veem leaderboard | 0% | 80% | Analytics frontend |
| Streak medio | 0 | 3 dias | AVG(current_streak) |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Gaming the system | Media | Alto | Anti-cheat, minimo 1min por sessao |
| Desmotivacao dos ultimos | Media | Medio | Leaderboard por tier/nivel |
| XP inflation | Baixa | Medio | Caps e rebalanceamento |
| Badges muito faceis | Media | Baixo | Ajustar criterios iterativamente |
| Badges muito dificeis | Media | Medio | Badges intermediarios |

---

## 10. Criterios de Aceite (DoD)

- [ ] Schema de banco implementado
- [ ] Edge Function de calculo XP funcional
- [ ] Trigger de atualizacao de progresso
- [ ] Verificacao automatica de badges
- [ ] Leaderboard materializado
- [ ] Hook useGamification implementado
- [ ] 8 componentes UI implementados
- [ ] Animacoes de XP e level up
- [ ] Testes unitarios para calculo XP
- [ ] Testes E2E para fluxo completo
- [ ] Metricas de analytics configuradas

---

## 11. Plano de Rollout

### Semana 1
- Schema de banco e migrations
- Edge Function calculate-xp
- Logica de niveis e streaks

### Semana 2
- Sistema de badges
- Leaderboard
- Hook useGamification

### Semana 3
- Componentes UI (sem animacao)
- Integracao com fluxo existente
- Testes unitarios

### Semana 4
- Animacoes e polish
- Testes E2E
- Beta 20% usuarios

### Semana 5
- Ajustes baseado em feedback
- Rollout 100%
- Monitoramento metricas

---

## 12. Apendice

### A. Pesquisa: Gamificacao em Treinamento

Estudos mostram que gamificacao aumenta:
- Engajamento: +48% (TalentLMS)
- Produtividade: +50% (Gartner)
- Retencao de conhecimento: +40% (eLearning Industry)

Fonte: TalentLMS Gamification Survey 2019

### B. Benchmarks de Mercado

| Plataforma | Sistema de Pontos | Leaderboard | Badges |
|------------|-------------------|-------------|--------|
| Second Nature | Sim | Sim | Sim (6) |
| Duolingo | Sim (XP) | Sim | Sim (50+) |
| Kahoot | Sim | Sim | Nao |
| LinkedIn Learning | Nao | Nao | Sim |

### C. Anti-Cheat Rules

1. Sessao minima: 60 segundos
2. Maximo sessoes/dia para XP: 10
3. Detectar padroes suspeitos (mesmo transcript)
4. Rate limit em APIs de XP
5. Auditoria manual de top 10 semanal
