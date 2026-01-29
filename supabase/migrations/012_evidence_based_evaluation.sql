-- PRD 08: Avaliacao Evidenciada e Calibrada V2
-- Migration para sistema de avaliacao com rubricas, evidencias e objecoes

-- ============================================
-- 1. NOVOS CAMPOS EM SCENARIOS
-- Duracao configuravel e modo de sessao
-- ============================================

ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS duration_min_seconds INTEGER DEFAULT 180,
ADD COLUMN IF NOT EXISTS duration_max_seconds INTEGER DEFAULT 360,
ADD COLUMN IF NOT EXISTS default_session_mode VARCHAR(20) DEFAULT 'training'
  CHECK (default_session_mode IN ('training', 'evaluation'));

COMMENT ON COLUMN scenarios.duration_min_seconds IS 'Duracao minima da sessao em segundos para ser considerada valida';
COMMENT ON COLUMN scenarios.duration_max_seconds IS 'Duracao maxima da sessao (sessao termina ao atingir)';
COMMENT ON COLUMN scenarios.default_session_mode IS 'Modo padrao: training (coach ativo) ou evaluation (coach silencioso)';

-- ============================================
-- 2. TABELA DE RUBRICAS POR CRITERIO
-- Define os 4 niveis de avaliacao por criterio
-- ============================================

CREATE TABLE IF NOT EXISTS criterion_rubrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  criterion_id VARCHAR(50) NOT NULL,
  criterion_name VARCHAR(100) NOT NULL,
  criterion_description TEXT NOT NULL,
  weight INTEGER DEFAULT 25 CHECK (weight >= 0 AND weight <= 100),

  -- Descritores para cada nivel (1-4)
  level_1_descriptor TEXT NOT NULL, -- Fraco
  level_2_descriptor TEXT NOT NULL, -- Parcial
  level_3_descriptor TEXT NOT NULL, -- Bom
  level_4_descriptor TEXT NOT NULL, -- Excelente

  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, criterion_id)
);

CREATE INDEX idx_criterion_rubrics_scenario ON criterion_rubrics(scenario_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER criterion_rubrics_updated_at
  BEFORE UPDATE ON criterion_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE criterion_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rubrics" ON criterion_rubrics
  FOR SELECT USING (true);

CREATE POLICY "Service role manages rubrics" ON criterion_rubrics
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 3. TABELA DE OBJECOES OBRIGATORIAS
-- Objecoes que devem ser tratadas por cenario
-- ============================================

CREATE TABLE IF NOT EXISTS scenario_objections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  objection_id VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),

  -- Gatilhos para deteccao automatica
  trigger_keywords TEXT[] DEFAULT '{}',

  -- Resposta esperada (para avaliar se foi tratada)
  expected_response_keywords TEXT[] DEFAULT '{}',

  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, objection_id)
);

CREATE INDEX idx_scenario_objections_scenario ON scenario_objections(scenario_id);

-- RLS
ALTER TABLE scenario_objections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view objections" ON scenario_objections
  FOR SELECT USING (true);

CREATE POLICY "Service role manages objections" ON scenario_objections
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 4. NOVOS CAMPOS EM SESSIONS
-- Modo de sessao e validacao
-- ============================================

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS session_mode VARCHAR(20) DEFAULT 'training'
  CHECK (session_mode IN ('training', 'evaluation')),
ADD COLUMN IF NOT EXISTS coach_intensity VARCHAR(20) DEFAULT 'medium'
  CHECK (coach_intensity IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validation_reasons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS has_avatar_fallback BOOLEAN DEFAULT false;

COMMENT ON COLUMN sessions.session_mode IS 'training = coach ativo, evaluation = coach silencioso';
COMMENT ON COLUMN sessions.coach_intensity IS 'Intensidade das dicas: low/medium/high';
COMMENT ON COLUMN sessions.is_valid IS 'Se a sessao atende criterios minimos para avaliacao';
COMMENT ON COLUMN sessions.validation_reasons IS 'Array de razoes se sessao invalida';
COMMENT ON COLUMN sessions.has_avatar_fallback IS 'Se houve fallback para modo sem avatar';

-- ============================================
-- 5. TABELA DE EVIDENCIAS
-- Trechos do transcript que justificam avaliacoes
-- ============================================

CREATE TABLE IF NOT EXISTS session_evidences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  criterion_id VARCHAR(50) NOT NULL,

  -- Referencia ao trecho do transcript
  transcript_start_index INTEGER NOT NULL,
  transcript_end_index INTEGER NOT NULL,
  transcript_excerpt TEXT NOT NULL,

  -- Timestamp aproximado no audio
  timestamp_ms INTEGER,

  -- Tipo de evidencia
  evidence_type VARCHAR(30) DEFAULT 'criterion'
    CHECK (evidence_type IN ('criterion', 'objection', 'key_moment')),

  -- Metadata
  label VARCHAR(50), -- ex: 'empatia', 'fechamento', 'objecao', 'risco'
  confidence DECIMAL(3,2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_session_evidences_session ON session_evidences(session_id);
CREATE INDEX idx_session_evidences_criterion ON session_evidences(criterion_id);

-- RLS
ALTER TABLE session_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view evidences" ON session_evidences
  FOR SELECT USING (true);

CREATE POLICY "Service role manages evidences" ON session_evidences
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. TABELA DE STATUS DE OBJECOES NA SESSAO
-- Rastreia se cada objecao foi tratada
-- ============================================

CREATE TABLE IF NOT EXISTS session_objection_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  objection_id VARCHAR(50) NOT NULL,

  -- Status: detected -> addressed/partial/not_addressed
  status VARCHAR(20) DEFAULT 'not_detected'
    CHECK (status IN ('not_detected', 'detected', 'partial', 'addressed')),

  -- Quando foi detectada no transcript
  detected_at_ms INTEGER,
  detected_transcript_index INTEGER,

  -- Quando foi tratada (se aplicavel)
  addressed_at_ms INTEGER,
  addressed_transcript_index INTEGER,

  -- Recomendacao se nao tratada
  recommendation TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, objection_id)
);

CREATE INDEX idx_session_objection_status_session ON session_objection_status(session_id);

-- Trigger para updated_at
CREATE TRIGGER session_objection_status_updated_at
  BEFORE UPDATE ON session_objection_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE session_objection_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view objection status" ON session_objection_status
  FOR SELECT USING (true);

CREATE POLICY "Service role manages objection status" ON session_objection_status
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 7. ATUALIZAR ESTRUTURA DE FEEDBACKS
-- Adicionar campos para score calibrado
-- ============================================

ALTER TABLE feedbacks
ADD COLUMN IF NOT EXISTS criteria_scores JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS weighted_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(20) DEFAULT 'high'
  CHECK (confidence_level IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS transcript_coverage DECIMAL(3,2);

COMMENT ON COLUMN feedbacks.criteria_scores IS 'Array de {criterion_id, level (1-4), weight, evidence_ids}';
COMMENT ON COLUMN feedbacks.weighted_score IS 'Score final ponderado pelos pesos dos criterios';
COMMENT ON COLUMN feedbacks.confidence_level IS 'Confianca na avaliacao baseada em transcricao e deteccao';
COMMENT ON COLUMN feedbacks.transcript_coverage IS 'Percentual do audio coberto pela transcricao';

-- ============================================
-- 8. SEED DATA - RUBRICAS PARA SEGURO DE VIDA
-- ============================================

-- Primeiro, pegar o ID do cenario Seguro de Vida
DO $$
DECLARE
  seguro_vida_id UUID;
BEGIN
  SELECT id INTO seguro_vida_id FROM scenarios WHERE title = 'Venda de Seguro de Vida' LIMIT 1;

  IF seguro_vida_id IS NOT NULL THEN
    -- Inserir rubricas para cada criterio
    INSERT INTO criterion_rubrics (
      scenario_id, criterion_id, criterion_name, criterion_description, weight,
      level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
      display_order
    ) VALUES
    (
      seguro_vida_id, 'crit_1',
      'Identificacao de Necessidades',
      'Identificou a preocupacao principal com os filhos e educacao',
      25,
      'Nao fez perguntas sobre a situacao familiar ou fez perguntas superficiais sem aprofundar',
      'Perguntou sobre familia mas nao explorou preocupacoes especificas com educacao ou futuro dos filhos',
      'Identificou preocupacoes com educacao e futuro dos filhos, fazendo perguntas de follow-up',
      'Usou metodologia SPIN completa: explorou situacao atual, identificou problemas, discutiu implicacoes e conectou com beneficios',
      1
    ),
    (
      seguro_vida_id, 'crit_2',
      'Tratamento de Objecao de Preco',
      'Respondeu adequadamente a objecao de preco com argumentos de valor',
      25,
      'Ignorou a objecao de preco ou ofereceu desconto imediatamente sem argumentar valor',
      'Reconheceu a preocupacao mas argumentou de forma generica sem conectar com necessidades do cliente',
      'Apresentou argumentos de valor conectados as necessidades do cliente (protecao, educacao)',
      'Reverteu objecao com calculo de ROI, comparacao com alternativas e apelo emocional equilibrado',
      2
    ),
    (
      seguro_vida_id, 'crit_3',
      'Apresentacao de Beneficios',
      'Destacou beneficios especificos de protecao familiar',
      25,
      'Listou beneficios genericos do produto sem personalizar para o cliente',
      'Mencionou alguns beneficios relevantes mas sem conectar diretamente com a situacao familiar',
      'Apresentou beneficios especificos de protecao para a familia e educacao dos filhos',
      'Criou narrativa personalizada conectando cada beneficio com preocupacoes especificas do cliente, usando exemplos concretos',
      3
    ),
    (
      seguro_vida_id, 'crit_4',
      'Criacao de Urgencia',
      'Criou senso de urgencia sem ser agressivo ou pressionar demais',
      25,
      'Nao criou nenhum senso de urgencia ou pressionou de forma agressiva causando desconforto',
      'Mencionou urgencia de forma vaga ("quanto antes melhor") sem argumentos concretos',
      'Criou urgencia com argumentos logicos sobre momento de vida e planejamento',
      'Equilibrou urgencia emocional (protecao da familia) com logica (custo x beneficio no tempo), respeitando ritmo do cliente',
      4
    );

    -- Inserir objecoes obrigatorias
    INSERT INTO scenario_objections (
      scenario_id, objection_id, description, severity, trigger_keywords, expected_response_keywords, display_order
    ) VALUES
    (
      seguro_vida_id, 'obj_price',
      'O preco esta muito alto para meu orcamento atual',
      'high',
      ARRAY['preco', 'caro', 'orcamento', 'custo', 'valor alto', 'nao cabe', 'pagar'],
      ARRAY['investimento', 'protecao', 'valor', 'custo-beneficio', 'parcela', 'longo prazo'],
      1
    ),
    (
      seguro_vida_id, 'obj_spouse',
      'Preciso pensar mais e conversar com minha esposa antes de decidir',
      'medium',
      ARRAY['esposa', 'pensar', 'decidir', 'conversar', 'familia', 'consultar'],
      ARRAY['entendo', 'importante', 'juntos', 'material', 'informacoes', 'apresentacao'],
      2
    ),
    (
      seguro_vida_id, 'obj_investments',
      'Ja tenho alguns investimentos que podem proteger minha familia',
      'medium',
      ARRAY['investimento', 'poupanca', 'aplicacao', 'reserva', 'ja tenho', 'protegido'],
      ARRAY['complementar', 'diferente', 'garantia', 'imediato', 'inventario', 'sucessao'],
      3
    ),
    (
      seguro_vida_id, 'obj_distrust',
      'Desconfianca de seguradora ou contrato',
      'low',
      ARRAY['desconfianca', 'letra miuda', 'nao paga', 'burocracia', 'seguradora'],
      ARRAY['transparencia', 'contrato', 'regulamentado', 'susep', 'historico'],
      4
    ),
    (
      seguro_vida_id, 'obj_no_urgency',
      'Nao vejo urgencia agora, sou saudavel',
      'medium',
      ARRAY['urgencia', 'saudavel', 'jovem', 'depois', 'agora nao', 'mais tarde'],
      ARRAY['preventivo', 'mais barato', 'idade', 'saude', 'planejamento'],
      5
    );

    -- Atualizar duracao do cenario
    UPDATE scenarios
    SET duration_min_seconds = 240, -- 4 min
        duration_max_seconds = 480  -- 8 min
    WHERE id = seguro_vida_id;

  END IF;
END $$;

-- ============================================
-- 9. SEED DATA - RUBRICAS PARA B2B
-- ============================================

DO $$
DECLARE
  b2b_id UUID;
BEGIN
  SELECT id INTO b2b_id FROM scenarios WHERE title = 'Negociacao de Contrato B2B' LIMIT 1;

  IF b2b_id IS NOT NULL THEN
    INSERT INTO criterion_rubrics (
      scenario_id, criterion_id, criterion_name, criterion_description, weight,
      level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
      display_order
    ) VALUES
    (
      b2b_id, 'crit_1',
      'Diferenciacao Valor vs Preco',
      'Diferenciou valor vs preco de forma convincente',
      30,
      'Focou apenas em preco ou ofereceu desconto sem argumentar diferenciacao',
      'Mencionou diferenciacao mas sem dados concretos ou exemplos',
      'Apresentou argumentos claros de valor agregado com exemplos relevantes',
      'Construiu caso de negocio com ROI calculado, TCO e comparacao estruturada',
      1
    ),
    (
      b2b_id, 'crit_2',
      'Uso de Cases e Dados',
      'Apresentou cases de sucesso ou dados relevantes',
      25,
      'Nao apresentou nenhum case ou dado de suporte',
      'Mencionou cases de forma vaga sem detalhes ou metricas',
      'Apresentou case relevante com resultados mensuráveis',
      'Apresentou multiplos cases do mesmo setor com metricas especificas e referencias verificaveis',
      2
    ),
    (
      b2b_id, 'crit_3',
      'Negociacao sem Desvalorizacao',
      'Negociou sem desvalorizar o produto ou servico',
      25,
      'Cedeu em preco rapidamente ou desvalorizou o servico para fechar',
      'Negociou mas fez concessoes sem obter contrapartidas',
      'Manteve posicionamento de valor e negociou com contrapartidas',
      'Negociou criativamente (escopo, prazo, servicos adicionais) mantendo margem e percepção de valor',
      3
    ),
    (
      b2b_id, 'crit_4',
      'Proximos Passos',
      'Propos proximos passos concretos e timeline',
      20,
      'Encerrou sem propor proximos passos ou deixou vago',
      'Propos follow-up generico sem datas ou responsaveis definidos',
      'Definiu proximos passos claros com timeline',
      'Criou plano de acao detalhado com marcos, responsaveis e criterios de sucesso',
      4
    );

    -- Objecoes B2B
    INSERT INTO scenario_objections (
      scenario_id, objection_id, description, severity, trigger_keywords, expected_response_keywords, display_order
    ) VALUES
    (
      b2b_id, 'obj_competitor_price',
      'Concorrente ofereceu 20% menos pelo mesmo escopo',
      'high',
      ARRAY['concorrente', '20%', 'mais barato', 'menor preco', 'outra proposta'],
      ARRAY['diferencial', 'qualidade', 'suporte', 'experiencia', 'risco', 'TCO'],
      1
    ),
    (
      b2b_id, 'obj_timeline',
      'O prazo de implementacao de 6 meses e muito longo',
      'medium',
      ARRAY['prazo', 'meses', 'longo', 'demora', 'urgente', 'rapido'],
      ARRAY['fases', 'MVP', 'priorizacao', 'quick wins', 'paralelo'],
      2
    ),
    (
      b2b_id, 'obj_board_approval',
      'Preciso de aprovacao do board antes de fechar',
      'medium',
      ARRAY['board', 'aprovacao', 'diretoria', 'comite', 'decisao'],
      ARRAY['apresentacao', 'material', 'ROI', 'apoio', 'agenda'],
      3
    );

    UPDATE scenarios
    SET duration_min_seconds = 360, -- 6 min
        duration_max_seconds = 720  -- 12 min
    WHERE id = b2b_id;
  END IF;
END $$;

-- ============================================
-- 10. SEED DATA - RUBRICAS PARA RETENCAO
-- ============================================

DO $$
DECLARE
  retencao_id UUID;
BEGIN
  SELECT id INTO retencao_id FROM scenarios WHERE title = 'Retencao de Cliente Insatisfeito' LIMIT 1;

  IF retencao_id IS NOT NULL THEN
    INSERT INTO criterion_rubrics (
      scenario_id, criterion_id, criterion_name, criterion_description, weight,
      level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
      display_order
    ) VALUES
    (
      retencao_id, 'crit_1',
      'Demonstracao de Empatia',
      'Demonstrou empatia genuina pela situacao do cliente',
      30,
      'Foi defensivo ou minimizou o problema do cliente',
      'Reconheceu o problema mas de forma mecanica/protocolar',
      'Demonstrou compreensao genuina e validou os sentimentos do cliente',
      'Criou conexao emocional, usou escuta ativa e demonstrou que realmente se importa',
      1
    ),
    (
      retencao_id, 'crit_2',
      'Identificacao da Causa Raiz',
      'Identificou a causa raiz da insatisfacao (sentir-se ignorado)',
      25,
      'Focou apenas no problema tecnico sem entender o impacto emocional',
      'Identificou parcialmente mas nao explorou o sentimento de ser ignorado',
      'Identificou que o cliente se sentiu desvalorizado alem do problema tecnico',
      'Fez perguntas que revelaram frustracao profunda e validou a importancia do relacionamento',
      2
    ),
    (
      retencao_id, 'crit_3',
      'Solucao e Compensacao',
      'Ofereceu solucao concreta e compensacao adequada',
      30,
      'Nao ofereceu solucao ou ofereceu algo inadequado/insuficiente',
      'Ofereceu solucao generica sem personalizacao',
      'Propôs solucao concreta e compensacao proporcional ao problema',
      'Criou plano de recuperacao personalizado com garantias futuras e compensacao que demonstra valor do cliente',
      3
    ),
    (
      retencao_id, 'crit_4',
      'Valorizacao do Historico',
      'Valorizou o historico e lealdade do cliente',
      15,
      'Tratou como cliente qualquer sem reconhecer o historico',
      'Mencionou o tempo de relacionamento mas sem dar peso real',
      'Reconheceu explicitamente o valor do relacionamento de 3 anos',
      'Usou o historico para criar compromisso mutuo e reforcar importancia do cliente para a empresa',
      4
    );

    -- Objecoes Retencao
    INSERT INTO scenario_objections (
      scenario_id, objection_id, description, severity, trigger_keywords, expected_response_keywords, display_order
    ) VALUES
    (
      retencao_id, 'obj_sla_delay',
      'O suporte demorou 5 dias para resolver algo que deveria levar horas',
      'high',
      ARRAY['5 dias', 'demora', 'espera', 'ticket', 'resolver', 'horas'],
      ARRAY['inaceitavel', 'desculpas', 'investigar', 'processo', 'garantia'],
      1
    ),
    (
      retencao_id, 'obj_competitor_sla',
      'Vi que o concorrente X oferece SLA de 4 horas com preco similar',
      'high',
      ARRAY['concorrente', 'SLA', '4 horas', 'melhor', 'preco similar'],
      ARRAY['entendo', 'melhorar', 'compromisso', 'prioridade', 'diferencial'],
      2
    ),
    (
      retencao_id, 'obj_not_valued',
      'Nao me sinto mais valorizado como cliente antigo',
      'high',
      ARRAY['valorizado', 'cliente antigo', 'novos clientes', 'ignorado', 'importancia'],
      ARRAY['importante', 'parceria', '3 anos', 'prioridade', 'especial'],
      3
    );

    UPDATE scenarios
    SET duration_min_seconds = 300, -- 5 min
        duration_max_seconds = 600  -- 10 min
    WHERE id = retencao_id;
  END IF;
END $$;

-- ============================================
-- 11. VIEW PARA CONSULTA DE CENARIO COMPLETO
-- ============================================

CREATE OR REPLACE VIEW scenario_full_details AS
SELECT
  s.id,
  s.title,
  s.context,
  s.avatar_profile,
  s.duration_min_seconds,
  s.duration_max_seconds,
  s.default_session_mode,
  s.is_active,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', cr.criterion_id,
        'name', cr.criterion_name,
        'description', cr.criterion_description,
        'weight', cr.weight,
        'rubric', jsonb_build_object(
          'level_1', cr.level_1_descriptor,
          'level_2', cr.level_2_descriptor,
          'level_3', cr.level_3_descriptor,
          'level_4', cr.level_4_descriptor
        )
      ) ORDER BY cr.display_order
    )
    FROM criterion_rubrics cr
    WHERE cr.scenario_id = s.id
  ) as criteria_with_rubrics,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', so.objection_id,
        'description', so.description,
        'severity', so.severity,
        'trigger_keywords', so.trigger_keywords,
        'expected_response_keywords', so.expected_response_keywords
      ) ORDER BY so.display_order
    )
    FROM scenario_objections so
    WHERE so.scenario_id = s.id
  ) as objections_detailed
FROM scenarios s;

-- ============================================
-- 12. FUNCAO PARA CALCULAR SCORE PONDERADO
-- ============================================

CREATE OR REPLACE FUNCTION calculate_weighted_score(
  p_criteria_scores JSONB
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  total_weight INTEGER := 0;
  weighted_sum DECIMAL := 0;
  criterion JSONB;
  level INTEGER;
  weight INTEGER;
BEGIN
  FOR criterion IN SELECT * FROM jsonb_array_elements(p_criteria_scores)
  LOOP
    level := (criterion->>'level')::INTEGER;
    weight := COALESCE((criterion->>'weight')::INTEGER, 25);

    -- Converter nivel 1-4 para porcentagem: 1=25%, 2=50%, 3=75%, 4=100%
    weighted_sum := weighted_sum + (level * 25.0 * weight / 100.0);
    total_weight := total_weight + weight;
  END LOOP;

  IF total_weight = 0 THEN
    RETURN NULL;
  END IF;

  RETURN weighted_sum * 100.0 / total_weight;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. INDICES ADICIONAIS PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sessions_mode ON sessions(session_mode);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid);
CREATE INDEX IF NOT EXISTS idx_feedbacks_confidence ON feedbacks(confidence_level);
