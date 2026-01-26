-- Agent Roleplay - Database Schema
-- Execute this migration in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ACCESS CODES TABLE
-- Simple authentication via access codes
-- ============================================
CREATE TABLE access_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(20) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast code lookup
CREATE INDEX idx_access_codes_code ON access_codes(code);

-- ============================================
-- SCENARIOS TABLE
-- Training scenarios with context and criteria
-- ============================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  context TEXT NOT NULL,
  avatar_profile TEXT NOT NULL,
  objections JSONB DEFAULT '[]'::jsonb,
  evaluation_criteria JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active scenarios listing
CREATE INDEX idx_scenarios_active ON scenarios(is_active) WHERE is_active = true;

-- ============================================
-- SESSIONS TABLE
-- Training sessions linking users to scenarios
-- ============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_code_id UUID REFERENCES access_codes(id) ON DELETE SET NULL,
  scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL,
  livekit_room_name VARCHAR(100),
  transcript TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);

-- Indexes for session queries
CREATE INDEX idx_sessions_access_code ON sessions(access_code_id);
CREATE INDEX idx_sessions_scenario ON sessions(scenario_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- ============================================
-- FEEDBACKS TABLE
-- AI-generated feedback for each session
-- ============================================
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
  criteria_results JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  score INTEGER CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feedback lookup by session
CREATE INDEX idx_feedbacks_session ON feedbacks(session_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on scenarios
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scenarios_updated_at
  BEFORE UPDATE ON scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Access codes: Allow public read for code validation
CREATE POLICY "Allow code validation" ON access_codes
  FOR SELECT USING (is_active = true);

-- Scenarios: Public read for active scenarios
CREATE POLICY "Anyone can view active scenarios" ON scenarios
  FOR SELECT USING (is_active = true);

-- Scenarios: Service role can manage all (for admin operations via Edge Functions)
CREATE POLICY "Service role manages scenarios" ON scenarios
  FOR ALL USING (auth.role() = 'service_role');

-- Sessions: Anyone can read (filtered by access_code_id in app)
CREATE POLICY "View sessions" ON sessions
  FOR SELECT USING (true);

-- Sessions: Anyone can insert new sessions
CREATE POLICY "Create sessions" ON sessions
  FOR INSERT WITH CHECK (true);

-- Sessions: Anyone can update sessions
CREATE POLICY "Update sessions" ON sessions
  FOR UPDATE USING (true);

-- Feedbacks: Anyone can read feedbacks
CREATE POLICY "View feedbacks" ON feedbacks
  FOR SELECT USING (true);

-- Feedbacks: Service role can insert feedbacks
CREATE POLICY "Service creates feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA - Test Access Codes
-- ============================================
INSERT INTO access_codes (code, role) VALUES
  ('ADMIN001', 'admin'),
  ('USER001', 'user'),
  ('USER002', 'user'),
  ('TEST123', 'user');

-- ============================================
-- SEED DATA - Test Scenarios
-- ============================================
INSERT INTO scenarios (title, context, avatar_profile, objections, evaluation_criteria) VALUES
(
  'Venda de Seguro de Vida',
  'Voce esta em uma reuniao com um potencial cliente interessado em seguro de vida. O cliente e um empresario de 45 anos com familia. Ele agendou esta reuniao apos ver um anuncio, mas ainda tem muitas duvidas sobre a necessidade de um seguro.',
  'Empresario de 45 anos, casado, dois filhos adolescentes (16 e 14 anos). Dono de uma empresa de medio porte. Questionador e analitico, nao toma decisoes por impulso. Preocupado com o futuro financeiro da familia, especialmente a educacao dos filhos. Ja teve experiencias ruins com vendedores insistentes no passado. Prefere conversas objetivas e dados concretos.',
  '[
    {"id": "obj_1", "description": "O preco esta muito alto para meu orcamento atual"},
    {"id": "obj_2", "description": "Preciso pensar mais e conversar com minha esposa antes de decidir"},
    {"id": "obj_3", "description": "Ja tenho alguns investimentos que podem proteger minha familia"}
  ]'::jsonb,
  '[
    {"id": "crit_1", "description": "Identificou a preocupacao principal com os filhos e educacao"},
    {"id": "crit_2", "description": "Respondeu adequadamente a objecao de preco com argumentos de valor"},
    {"id": "crit_3", "description": "Destacou beneficios especificos de protecao familiar"},
    {"id": "crit_4", "description": "Criou senso de urgencia sem ser agressivo ou pressionar demais"}
  ]'::jsonb
),
(
  'Negociacao de Contrato B2B',
  'Voce esta negociando um contrato de servicos de consultoria com o diretor de compras de uma empresa de tecnologia. O valor do contrato e de R$ 500.000 anuais. Esta e a reuniao final antes da decisao.',
  'Diretor de compras experiente, 50 anos, MBA em gestao. Muito analitico e focado em numeros, ROI e metricas. Tem outras 2 propostas concorrentes na mesa com precos menores. Respeitado na empresa, sua recomendacao tem peso. Valoriza relacionamentos de longo prazo mas e pragmatico nas decisoes.',
  '[
    {"id": "obj_1", "description": "Seu concorrente ofereceu 20% menos pelo mesmo escopo"},
    {"id": "obj_2", "description": "O prazo de implementacao de 6 meses e muito longo para nossa necessidade"},
    {"id": "obj_3", "description": "Preciso de aprovacao do board antes de fechar, e eles sao bem conservadores"}
  ]'::jsonb,
  '[
    {"id": "crit_1", "description": "Diferenciou valor vs preco de forma convincente"},
    {"id": "crit_2", "description": "Apresentou cases de sucesso ou dados relevantes"},
    {"id": "crit_3", "description": "Negociou sem desvalorizar o produto ou servico"},
    {"id": "crit_4", "description": "Propos proximos passos concretos e timeline"}
  ]'::jsonb
),
(
  'Retencao de Cliente Insatisfeito',
  'Um cliente antigo (3 anos de contrato) ligou para cancelar o servico apos uma experiencia muito negativa com o suporte tecnico. O ticket dele ficou 5 dias sem resolucao. Voce precisa entender o problema e tentar reter o cliente.',
  'Gerente de TI de uma empresa de e-commerce, 38 anos. Cliente ha 3 anos, sempre foi promotor da marca ate este incidente. Esta genuinamente frustrado, nao e do tipo que reclama por reclamar. Ja pesquisou alternativas no mercado. Valoriza agilidade e comunicacao clara. Se sentiu ignorado e desrespeitado pelo tempo de espera.',
  '[
    {"id": "obj_1", "description": "O suporte demorou 5 dias para resolver algo que deveria levar horas"},
    {"id": "obj_2", "description": "Vi que o concorrente X oferece SLA de 4 horas com preco similar"},
    {"id": "obj_3", "description": "Nao me sinto mais valorizado como cliente antigo, parece que so querem novos clientes"}
  ]'::jsonb,
  '[
    {"id": "crit_1", "description": "Demonstrou empatia genuina pela situacao do cliente"},
    {"id": "crit_2", "description": "Identificou a causa raiz da insatisfacao (sentir-se ignorado)"},
    {"id": "crit_3", "description": "Ofereceu solucao concreta e compensacao adequada"},
    {"id": "crit_4", "description": "Valorizou o historico e lealdade do cliente"}
  ]'::jsonb
);
