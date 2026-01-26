-- Migration: Add ideal_outcome field to scenarios
-- Allows defining expected successful outcomes for better feedback calibration

-- ============================================
-- ADD IDEAL_OUTCOME COLUMN
-- ============================================

ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS ideal_outcome TEXT;

-- Add helpful comment for documentation
COMMENT ON COLUMN scenarios.ideal_outcome IS
  'Descricao do resultado ideal esperado para a conversa. Usado pelo Claude para calibrar a avaliacao de feedback. Exemplo: "O vendedor deve demonstrar empatia, apresentar beneficios especificos e responder objecoes com argumentos de valor."';

-- ============================================
-- UPDATE EXISTING SCENARIOS WITH IDEAL OUTCOMES
-- ============================================

-- Venda de Seguro de Vida
UPDATE scenarios
SET ideal_outcome = 'O participante deve: (1) Identificar as preocupacoes do cliente com a familia e educacao dos filhos; (2) Responder a objecao de preco com argumentos de valor e custo-beneficio, nao com descontos; (3) Apresentar beneficios especificos de protecao familiar; (4) Criar senso de urgencia de forma sutil, sem pressionar. O objetivo final e que o cliente demonstre interesse em avancar com a proposta.'
WHERE title = 'Venda de Seguro de Vida';

-- Negociacao de Contrato B2B
UPDATE scenarios
SET ideal_outcome = 'O participante deve: (1) Diferenciar claramente valor vs preco, justificando o investimento; (2) Apresentar cases de sucesso ou dados concretos de ROI; (3) Manter o valor do produto durante a negociacao, sem ceder facilmente; (4) Propor proximos passos claros e timeline realista. O objetivo e que o diretor se sinta confiante para recomendar a proposta ao board.'
WHERE title = 'Negociacao de Contrato B2B';

-- Retencao de Cliente Insatisfeito
UPDATE scenarios
SET ideal_outcome = 'O participante deve: (1) Demonstrar empatia genuina, reconhecendo a frustracao do cliente; (2) Identificar que a insatisfacao vai alem do problema tecnico - o cliente se sentiu ignorado; (3) Oferecer solucao concreta para o problema E compensacao pelo inconveniente; (4) Valorizar o historico de 3 anos como cliente. O objetivo e reconquistar a confianca do cliente e evitar o cancelamento.'
WHERE title = 'Retencao de Cliente Insatisfeito';
