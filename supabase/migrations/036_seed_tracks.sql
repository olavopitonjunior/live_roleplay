-- Migration 036: Seed initial training tracks
-- Creates two tracks using existing RE/MAX scenarios from migration 020:
--   1. "Recrutamento de Corretores" — Interview + cold call recruitment scenarios
--   2. "Captacao de Imoveis" — FSBO cold call + property negotiation scenarios

-- ============================================================
-- TRACK 1: Recrutamento de Corretores
-- ============================================================

DO $$
DECLARE
  v_track_id UUID;
  v_scenario_id UUID;
BEGIN
  INSERT INTO training_tracks (title, slug, description, category, display_order)
  VALUES (
    'Recrutamento de Corretores',
    'recrutamento-corretores',
    'Domine as tecnicas de recrutamento de corretores para sua equipe RE/MAX. Comece com entrevistas por competencias e avance para cold calls de recrutamento ativo.',
    'RE/MAX',
    1
  )
  RETURNING id INTO v_track_id;

  -- Position 1: Entrevista — Vendedor de Varejo Estrela (easiest, structured interview)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Vendedor de Varejo Estrela%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 1, true,
      '["Rapport em entrevista", "Perguntas por competencia", "SPIN Situation"]'::jsonb,
      '["Rapport em entrevista", "Perguntas por competencia"]'::jsonb);
  END IF;

  -- Position 2: Entrevista — Corretora Lobo Solitario (medium, resistant candidate)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Corretora Lobo Solitario%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 2, true,
      '["Tratamento de objecoes em entrevista", "SPIN Problem"]'::jsonb,
      '["Rapport em entrevista", "Perguntas por competencia", "Tratamento de objecoes em entrevista"]'::jsonb);
  END IF;

  -- Position 3: Entrevista — Empreendedor em Transicao (hard, career change concerns)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Empreendedor em Transicao%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 3, true,
      '["SPIN Implication", "Apresentacao de proposta de valor"]'::jsonb,
      '["Rapport em entrevista", "Tratamento de objecoes em entrevista", "SPIN Implication"]'::jsonb);
  END IF;

  -- Position 4: Cold Call — Recrutamento de Corretor Tradicional (hardest, cold outreach)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Cold Call — Recrutamento%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 4, true,
      '["Cold call de recrutamento", "Abertura consultiva", "SPIN Need-Payoff"]'::jsonb,
      '["Rapport", "Tratamento de objecoes", "SPIN completo", "Cold call de recrutamento"]'::jsonb);
  END IF;

  RAISE NOTICE 'Track "Recrutamento de Corretores" created: %', v_track_id;
END $$;

-- ============================================================
-- TRACK 2: Captacao de Imoveis
-- ============================================================

DO $$
DECLARE
  v_track_id UUID;
  v_scenario_id UUID;
BEGIN
  INSERT INTO training_tracks (title, slug, description, category, display_order)
  VALUES (
    'Captacao de Imoveis',
    'captacao-imoveis',
    'Aprenda a captar imoveis para sua carteira. Pratique desde cold calls com proprietarios FSBO ate negociacoes de preco com vendedores.',
    'RE/MAX',
    2
  )
  RETURNING id INTO v_track_id;

  -- Position 1: Cold Call — Captacao de Proprietario FSBO (core skill)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Cold Call — Captacao%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 1, true,
      '["Cold call de captacao", "Abordagem FSBO", "SPIN Situation", "Quebra de resistencia inicial"]'::jsonb,
      '["Cold call de captacao", "Abordagem FSBO"]'::jsonb);
  END IF;

  -- Position 2: Negociacao — Proposta 15% Abaixo (advanced negotiation)
  SELECT id INTO v_scenario_id FROM scenarios
    WHERE title LIKE 'Negociacao — Proposta%' AND is_active = true LIMIT 1;
  IF v_scenario_id IS NOT NULL THEN
    INSERT INTO track_scenarios (track_id, scenario_id, position, is_required, skills_introduced, skills_expected)
    VALUES (v_track_id, v_scenario_id, 2, true,
      '["Negociacao de preco", "Uso de ACM/dados de mercado", "SPIN Implication", "SPIN Need-Payoff"]'::jsonb,
      '["Cold call de captacao", "Negociacao de preco", "SPIN completo", "Uso de dados de mercado"]'::jsonb);
  END IF;

  RAISE NOTICE 'Track "Captacao de Imoveis" created: %', v_track_id;
END $$;
