-- Migration: Add coaching_objectives to scenarios table
-- Purpose: Allow defining custom objectives for each scenario that users can complete during sessions

-- Add coaching_objectives column to scenarios table
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS coaching_objectives JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN scenarios.coaching_objectives IS 'Array of coaching objectives for the session. Each objective: {id: string, description: string, spin_step?: string}';

-- Example objectives format:
-- [
--   {"id": "obj1", "description": "Identificar a dor principal do cliente", "spin_step": "problem"},
--   {"id": "obj2", "description": "Fazer pergunta de implicacao", "spin_step": "implication"},
--   {"id": "obj3", "description": "Apresentar proposta de valor", "spin_step": "need_payoff"}
-- ]

-- Update existing scenarios with default objectives based on scenario type
-- This is optional and can be customized per scenario later
UPDATE scenarios
SET coaching_objectives = '[
  {"id": "obj_situation", "description": "Entender a situacao atual do cliente", "spin_step": "situation"},
  {"id": "obj_problem", "description": "Identificar um problema ou desafio", "spin_step": "problem"},
  {"id": "obj_implication", "description": "Explorar as consequencias do problema", "spin_step": "implication"},
  {"id": "obj_need", "description": "Fazer o cliente visualizar o valor da solucao", "spin_step": "need_payoff"}
]'::jsonb
WHERE coaching_objectives = '[]'::jsonb OR coaching_objectives IS NULL;
