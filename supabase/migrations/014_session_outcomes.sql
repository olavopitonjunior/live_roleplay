-- Migration 014: Session Outcomes System
-- Multiplos finais para sessoes de roleplay

-- Outcomes possiveis por cenario
CREATE TABLE scenario_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  outcome_type VARCHAR(30) NOT NULL,
  description TEXT,
  description_en TEXT,
  is_positive BOOLEAN DEFAULT false,
  trigger_condition JSONB DEFAULT '{}',
  avatar_closing_line TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scenario_id, outcome_type)
);

-- Comentarios
COMMENT ON TABLE scenario_outcomes IS 'Possiveis finais para cada cenario de roleplay';
COMMENT ON COLUMN scenario_outcomes.outcome_type IS 'sale_closed, meeting_scheduled, proposal_requested, needs_follow_up, rejected, abandoned, timeout';
COMMENT ON COLUMN scenario_outcomes.trigger_condition IS 'Condicoes para ativar: {"min_score": 80, "objections_handled_ratio": 0.8}';
COMMENT ON COLUMN scenario_outcomes.avatar_closing_line IS 'Frase que o avatar usa para encerrar com este outcome';

-- Adicionar colunas em sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS outcome VARCHAR(30);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS outcome_determined_by VARCHAR(20);

COMMENT ON COLUMN sessions.outcome IS 'Resultado da sessao: sale_closed, meeting_scheduled, rejected, etc';
COMMENT ON COLUMN sessions.outcome_determined_by IS 'Como foi determinado: ai, timeout, user_action';

-- Index para queries
CREATE INDEX IF NOT EXISTS idx_sessions_outcome ON sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_scenario_outcomes_scenario ON scenario_outcomes(scenario_id);

-- RLS policies
ALTER TABLE scenario_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scenario outcomes visivel para todos autenticados"
ON scenario_outcomes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Scenario outcomes editavel apenas por admins"
ON scenario_outcomes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM access_codes
    WHERE id = auth.uid()::uuid
    AND role = 'admin'
  )
);

-- Seed de outcomes default para cenarios existentes
INSERT INTO scenario_outcomes (scenario_id, outcome_type, description, description_en, is_positive, trigger_condition, avatar_closing_line, display_order)
SELECT
  s.id,
  'sale_closed',
  'Cliente fechou a venda',
  'Customer closed the deal',
  true,
  '{"min_score": 80, "objections_handled_ratio": 0.8}'::jsonb,
  'Voce me convenceu. Vamos fechar. Pode me enviar o contrato?',
  1
FROM scenarios s
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_outcomes so
  WHERE so.scenario_id = s.id AND so.outcome_type = 'sale_closed'
);

INSERT INTO scenario_outcomes (scenario_id, outcome_type, description, description_en, is_positive, trigger_condition, avatar_closing_line, display_order)
SELECT
  s.id,
  'meeting_scheduled',
  'Cliente agendou proxima reuniao',
  'Customer scheduled follow-up meeting',
  true,
  '{"min_score": 70, "objections_handled_ratio": 0.6}'::jsonb,
  'Interessante. Vou precisar pensar, mas podemos marcar uma reuniao na proxima semana para continuarmos?',
  2
FROM scenarios s
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_outcomes so
  WHERE so.scenario_id = s.id AND so.outcome_type = 'meeting_scheduled'
);

INSERT INTO scenario_outcomes (scenario_id, outcome_type, description, description_en, is_positive, trigger_condition, avatar_closing_line, display_order)
SELECT
  s.id,
  'proposal_requested',
  'Cliente pediu proposta formal',
  'Customer requested formal proposal',
  true,
  '{"min_score": 60, "objections_handled_ratio": 0.5}'::jsonb,
  'Me manda uma proposta formal por email que eu analiso com calma.',
  3
FROM scenarios s
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_outcomes so
  WHERE so.scenario_id = s.id AND so.outcome_type = 'proposal_requested'
);

INSERT INTO scenario_outcomes (scenario_id, outcome_type, description, description_en, is_positive, trigger_condition, avatar_closing_line, display_order)
SELECT
  s.id,
  'needs_follow_up',
  'Precisa de acompanhamento',
  'Needs follow-up',
  false,
  '{"min_score": 50, "objections_handled_ratio": 0.3}'::jsonb,
  'Vou pensar e te dou um retorno. Me liga na proxima semana.',
  4
FROM scenarios s
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_outcomes so
  WHERE so.scenario_id = s.id AND so.outcome_type = 'needs_follow_up'
);

INSERT INTO scenario_outcomes (scenario_id, outcome_type, description, description_en, is_positive, trigger_condition, avatar_closing_line, display_order)
SELECT
  s.id,
  'rejected',
  'Cliente recusou a proposta',
  'Customer rejected the proposal',
  false,
  '{"min_score": 0, "objections_handled_ratio": 0}'::jsonb,
  'Agradeco a apresentacao, mas nao faz sentido para nos neste momento. Obrigado.',
  5
FROM scenarios s
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_outcomes so
  WHERE so.scenario_id = s.id AND so.outcome_type = 'rejected'
);
