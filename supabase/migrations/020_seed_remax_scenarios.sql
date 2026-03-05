-- Migration: 020_seed_remax_scenarios
-- Description: Inserts 6 fully enriched RE/MAX scenarios with child table data
--   (criterion_rubrics, scenario_objections, scenario_outcomes).
-- Covers two categories:
--   - RE/MAX — Entrevista por Competencias (scenarios 1, 2, 3)
--   - RE/MAX — Cold Calls e Negociacao     (scenarios 4, 5, 6)
-- Each DO block captures the inserted scenario UUID via RETURNING id INTO v_id
-- and uses it for all child inserts.

-- ============================================================
-- SCENARIO 1: Vendedor de Varejo Estrela
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Vendedor de Varejo Estrela — Proatividade e Resultados',
    'RE/MAX — Entrevista por Competencias',
    'Voce e um gerente de recrutamento da RE/MAX conduzindo uma entrevista por competencias. Ricardo Oliveira, 29 anos, vendedor destaque de uma loja de eletronicos de luxo (Fast Shop), esta sendo avaliado para se associar como corretor. Ele nunca trabalhou no mercado imobiliario mas busca a RE/MAX pela promessa de ganhos maiores e autonomia. Sua missao e investigar se ele sabe GERAR demanda ativa ou se apenas atende demanda pronta (clientes que entram na loja). Use o modelo CAR (Contexto-Acao-Resultado) para extrair evidencias concretas de proatividade.',
    'Ricardo Oliveira, 29 anos, vendedor da Fast Shop Premium no Shopping Iguatemi. Solteiro, mora em apartamento alugado no Itaim Bibi, Sao Paulo. Sempre foi destaque em vendas — bateu 120% da meta nos ultimos 3 meses consecutivos. Comunicacao excelente, sorriso facil, discurso envolvente e sedutor. Porem, nunca precisou prospectar ativamente: os clientes entravam na loja ja buscando produtos. Fala com entusiasmo sobre suas conquistas mas fica evasivo quando questionado sobre como organizava sua rotina de prospeccao ou como buscava clientes fora da loja. Quer ganhar mais e ter autonomia, mas nao entende que no imobiliario o cliente nao vem ate voce — voce precisa ir ate ele.',
    '[
      {"id": "obj_1", "description": "Eu sempre bati metas porque os clientes entravam na loja procurando os produtos. Tenho medo de como sera cacar o cliente na rua."},
      {"id": "obj_2", "description": "Nao tenho experiencia em mercado imobiliario, mas aprendo rapido."},
      {"id": "obj_3", "description": "Preciso saber quanto vou ganhar no primeiro mes, tenho contas para pagar."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Uso do modelo CAR (Contexto-Acao-Resultado) para investigar evidencias"},
      {"id": "crit_2", "description": "Identificou acoes onde o candidato buscou o cliente FORA da loja (proatividade real)"},
      {"id": "crit_3", "description": "Investigou o como da organizacao de agenda e prospeccao"},
      {"id": "crit_4", "description": "Escuta tecnica — deixou o candidato falar sem interromper"}
    ]'::jsonb,
    'O candidato narra uma situacao onde reativou uma base de dados de clientes antigos para oferecer um lancamento, gerando uma venda que nao aconteceria espontaneamente. O entrevistador valida proatividade real versus atendimento de demanda pronta.',
    '[
      {"id": "obj_situation",   "description": "Investigar a situacao atual do candidato no varejo",                      "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Identificar problemas de prospeccao ativa vs passiva",                    "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar implicacoes de nao saber gerar demanda no imobiliario",          "spin_step": "implication"},
      {"id": "obj_need",        "description": "Levantar necessidade de metodo de prospeccao estruturado",                "spin_step": "need_payoff"}
    ]'::jsonb,
    'echo',
    'hedra',
    240,
    300,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Modelo CAR', 'Uso do modelo CAR (Contexto-Acao-Resultado) para investigar evidencias', 25,
    'Nao usou modelo estruturado, fez perguntas genericas',
    'Tentou extrair contexto mas nao explorou acao e resultado',
    'Extraiu contexto e acao, mas resultado ficou vago',
    'Extraiu CAR completo com detalhes especificos e verificaveis',
    1
  ),
  (
    v_id, 'crit_2', 'Proatividade Real', 'Identificou acoes onde o candidato buscou o cliente FORA da loja', 25,
    'Nao investigou proatividade, aceitou discurso generico',
    'Perguntou sobre prospeccao mas nao aprofundou',
    'Identificou acoes de busca ativa mas sem detalhes',
    'Extraiu exemplos concretos de busca ativa com numeros e resultados',
    2
  ),
  (
    v_id, 'crit_3', 'Organizacao de Agenda', 'Investigou o como da organizacao de agenda e prospeccao', 25,
    'Nao perguntou sobre rotina ou agenda',
    'Perguntou sobre rotina mas aceitou resposta vaga',
    'Investigou organizacao com perguntas secundarias',
    'Mapeou rotina completa com frequencia, canais e metricas de acompanhamento',
    3
  ),
  (
    v_id, 'crit_4', 'Escuta Tecnica', 'Escuta tecnica — deixou o candidato falar sem interromper', 25,
    'Interrompeu frequentemente, nao deixou o candidato elaborar',
    'Ouviu parcialmente mas direcionou demais',
    'Boa escuta com poucas interrupcoes',
    'Escuta tecnica exemplar — silencio estrategico, perguntas de aprofundamento no timing certo',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_price',
    'Medo de prospeccao ativa — sempre atendeu demanda pronta',
    'medium',
    ARRAY['medo','cacar','rua','prospeccao','prospectar'],
    ARRAY['organizar','agenda','rotina','base','dados','CRM'],
    1
  ),
  (
    v_id, 'obj_experience',
    'Falta de experiencia no mercado imobiliario',
    'low',
    ARRAY['experiencia','imobiliario','mercado','nunca'],
    ARRAY['aprender','treinamento','mentoria','acompanhamento'],
    2
  ),
  (
    v_id, 'obj_financial',
    'Pressao financeira — precisa saber ganhos imediatos',
    'high',
    ARRAY['ganhar','primeiro','mes','contas','salario'],
    ARRAY['reserva','planejamento','timeline','expectativa','realista'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Candidato aceita proxima etapa do processo seletivo',
    true,
    '{"min_score": 70}'::jsonb,
    'Gostei da conversa, me senti bem avaliado. Quando seria a proxima etapa?',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Candidato quer mais informacoes sobre o modelo RE/MAX',
    true,
    '{"min_score": 60}'::jsonb,
    'Interessante, mas preciso entender melhor os numeros antes de decidir.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Candidato indeciso, pede tempo para pensar',
    false,
    '{"min_score": 40}'::jsonb,
    'Vou pensar com calma, posso te ligar na semana que vem?',
    3
  ),
  (
    v_id, 'rejected',
    'Candidato nao aprovado — falta de evidencias de proatividade',
    false,
    '{"min_score": 0}'::jsonb,
    'Acho que nao e pra mim nesse momento, obrigado.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Candidato se associa como corretor',
    true,
    '{"min_score": 85}'::jsonb,
    'Estou convencido, quero fazer parte da RE/MAX. O que preciso para comecar?',
    5
  );

END $$;


-- ============================================================
-- SCENARIO 2: Corretora Lobo Solitario
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Corretora Lobo Solitario — Resistencia a Exclusividade',
    'RE/MAX — Entrevista por Competencias',
    'Voce e um gerente de recrutamento da RE/MAX conduzindo uma entrevista por competencias. Sandra Ferreira, 42 anos, corretora com 10 anos de experiencia no modelo tradicional (Lopes), esta resistente ao modelo de exclusividade da RE/MAX. Ela trabalha com 500 imoveis sem exclusividade e esta cansada da guerra de precos, mas nao admite que o problema esta no seu metodo. Sua missao e usar escuta tecnica para verificar se ela tem capacidade de adaptacao e mudanca de processo consolidado.',
    'Sandra Ferreira, 42 anos, corretora autonoma vinculada a Lopes ha 10 anos. Divorciada, dois filhos adolescentes. Conhecida no bairro do Tatuape, tem carteira de clientes consideravel mas vive reclamando da concorrencia desleal e da guerra de precos. Personalidade forte, opiniao formada sobre tudo. Fala muito e ouve pouco. Quando questionada sobre falhas ou frustracoes profissionais, tende a culpar o mercado, os outros corretores ou a economia — raramente assume responsabilidade propria. Competente na execucao mas presa ao modelo antigo de trabalhar com muitos imoveis sem exclusividade. Precisa ser desafiada com dados e logica, nao com promessas emocionais.',
    '[
      {"id": "obj_1", "description": "Nao concordo com exclusividade, limita chances de venda. Prefiro quantidade."},
      {"id": "obj_2", "description": "Ja conheco o mercado inteiro, nao preciso de treinamento basico."},
      {"id": "obj_3", "description": "Minhas comissoes sao menores mas pelo menos nao pago taxa de franquia."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Evidencia de mudanca de processo consolidado no passado"},
      {"id": "crit_2", "description": "Capacidade de descrever frustacao onde o erro foi dela, nao do mercado"},
      {"id": "crit_3", "description": "Investigacao de detalhes — perguntas secundarias"},
      {"id": "crit_4", "description": "Foco no passado — evitou perguntas hipoteticas"}
    ]'::jsonb,
    'Sandra relata situacao onde teve que aprender tecnologia ou metodo juridico do zero para salvar uma venda, demonstrando capacidade de adaptacao ao modelo RE/MAX.',
    '[
      {"id": "obj_situation",   "description": "Mapear experiencia atual no modelo tradicional",                          "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Investigar frustracoes com guerra de precos e falta de exclusividade",    "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar impacto financeiro de perder vendas para outros corretores",     "spin_step": "implication"},
      {"id": "obj_need",        "description": "Identificar necessidade de modelo de alta performance com exclusividade", "spin_step": "need_payoff"}
    ]'::jsonb,
    'shimmer',
    'hedra',
    300,
    360,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Mudanca de Processo', 'Evidencia de mudanca de processo consolidado no passado', 25,
    'Nao investigou historico de adaptacao, aceitou discurso de experiencia generica',
    'Perguntou sobre mudancas mas aceitou resposta superficial sem exemplos concretos',
    'Extraiu um exemplo de mudanca de processo com contexto e resultado',
    'Mapeou multiplas evidencias de adaptacao com detalhes especificos, dificuldades enfrentadas e resultados mensurados',
    1
  ),
  (
    v_id, 'crit_2', 'Autocritica', 'Capacidade de descrever frustacao onde o erro foi dela, nao do mercado', 25,
    'Aceitou o padrao de culpar o mercado sem questionar ou aprofundar',
    'Tentou redirectionar para responsabilidade propria mas cedeu ao discurso defensivo',
    'Conseguiu extrair pelo menos um episodio onde a candidata admitiu erro proprio',
    'Conduziu sequencia de perguntas que levou a candidata a reconhecer responsabilidade propria com detalhes verificaveis',
    2
  ),
  (
    v_id, 'crit_3', 'Perguntas Secundarias', 'Investigacao de detalhes — perguntas secundarias', 25,
    'Aceitou todas as respostas de primeira sem aprofundar',
    'Fez perguntas de follow-up mas de forma aleatoria e sem fio condutor',
    'Aprofundou respostas relevantes com perguntas secundarias estruturadas',
    'Usou cadencia consistente de pergunta primaria → secundaria → verificacao de resultado em todos os criterios avaliados',
    3
  ),
  (
    v_id, 'crit_4', 'Foco no Passado', 'Foco no passado — evitou perguntas hipoteticas', 25,
    'Fez perguntas hipoteticas predominantemente ("O que voce faria se...")',
    'Misturou perguntas hipoteticas e comportamentais sem consistencia',
    'Usou perguntas comportamentais na maior parte da entrevista',
    'Manteve foco 100% em situacoes reais passadas, redirecionando ativamente quando a candidata tentava hipoteticar',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_exclusivity',
    'Resistencia ao modelo de exclusividade — prefere quantidade de imoveis',
    'high',
    ARRAY['exclusividade','quantidade','limita','chances','preferir'],
    ARRAY['conversao','qualidade','foco','dedicacao','resultado','taxa'],
    1
  ),
  (
    v_id, 'obj_training',
    'Rejeicao de treinamento — se considera experiente demais',
    'medium',
    ARRAY['treinamento','basico','experiencia','sei','conheco','ja aprendi'],
    ARRAY['modelo','especifico','diferente','metodo','RE/MAX','exclusivo'],
    2
  ),
  (
    v_id, 'obj_fees',
    'Objecao as taxas de franquia vs comissoes atuais',
    'high',
    ARRAY['taxa','franquia','pagar','comissao','menor','custo'],
    ARRAY['producao','volume','media','alta performance','liquido','resultado'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Sandra aceita participar do processo seletivo formal',
    true,
    '{"min_score": 70}'::jsonb,
    'Ok, voce me fez pensar diferente. Posso conhecer o modelo por dentro antes de decidir.',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Sandra quer comparar os numeros do modelo RE/MAX com o atual',
    true,
    '{"min_score": 60}'::jsonb,
    'Me passa os dados de producao media dos corretores de voces que eu analiso.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Sandra indecisa, nao rejeita mas nao avanca',
    false,
    '{"min_score": 40}'::jsonb,
    'Deixa eu pensar. Tenho muito imovel em andamento agora, nao e o momento certo.',
    3
  ),
  (
    v_id, 'rejected',
    'Sandra rejeita o modelo e encerra a conversa',
    false,
    '{"min_score": 0}'::jsonb,
    'Olha, respeito o que voces fazem mas nao e pra mim. Sou lobo solitario mesmo.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Sandra concorda em se associar como corretora RE/MAX',
    true,
    '{"min_score": 85}'::jsonb,
    'Ta bom. Faz tempo que penso em mudar de modelo. Vamos ver o contrato.',
    5
  );

END $$;


-- ============================================================
-- SCENARIO 3: Empreendedor em Transicao
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Empreendedor em Transicao — Risco de Falta de Folego',
    'RE/MAX — Entrevista por Competencias',
    'Voce e um gerente de recrutamento da RE/MAX. Marcos Ribeiro, 35 anos, ex-dono de cafeteria que faliu recentemente, busca se associar como corretor. Tem espirito empreendedor mas reserva financeira no limite (3 meses). Precisa que RE/MAX de certo para ontem. Sua missao e avaliar se o desespero financeiro vai atropelar a tecnica e causar turnover precoce — a chamada contratacao otimista.',
    'Marcos Ribeiro, 35 anos, ex-empreendedor. Casado, um filho de 3 anos. Fechou a cafeteria Sabor & Arte ha 2 meses apos acumular dividas de R$ 80.000. Reserva financeira para mais 3 meses apenas. Inquieto, fala rapido, quer solucoes imediatas. Tem carisma e resiliencia genuinos — ja superou crises antes. Mas esta emocionalmente abalado e com autoestima prejudicada pelo fracasso recente. Quando pressionado sobre planejamento financeiro, fica defensivo e tenta mudar de assunto. Acredita que sua experiencia como empreendedor compensa a falta de conhecimento imobiliario. Precisa ser avaliado com empatia mas sem cair na contratacao otimista — associa-lo sem reserva financeira seria frustracao mutua.',
    '[
      {"id": "obj_1", "description": "Nao tenho tempo para treinamentos longos, preciso ir pra rua vender logo."},
      {"id": "obj_2", "description": "Ja tive meu proprio negocio, sei empreender. So preciso de oportunidade."},
      {"id": "obj_3", "description": "Se voces me derem leads prontos, eu fecho. Sou bom de venda."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Gestao de crises financeiras no negocio anterior"},
      {"id": "crit_2", "description": "Planejamento real: plano B para 4-6 meses sem venda?"},
      {"id": "crit_3", "description": "Neutralidade — tom consultivo, nao vendedor desesperado"},
      {"id": "crit_4", "description": "Alinhamento de expectativas — claro o que cada parte ganha e perde"}
    ]'::jsonb,
    'O entrevistador conclui que, embora Marcos seja resiliente, ele nao tem autoeficacia financeira no momento. Sugere que ele so se associe se tiver reserva garantida, evitando frustracao mutua.',
    '[
      {"id": "obj_situation",   "description": "Mapear historico empreendedor e situacao financeira atual",               "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Identificar fragilidades: reserva insuficiente e urgencia irreal",        "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar implicacoes de entrar sem folego financeiro adequado",           "spin_step": "implication"},
      {"id": "obj_need",        "description": "Construir necessidade de plano concreto antes da associacao",             "spin_step": "need_payoff"}
    ]'::jsonb,
    'echo',
    'hedra',
    300,
    360,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Gestao de Crises', 'Investigacao de gestao de crises financeiras no negocio anterior', 25,
    'Nao investigou causas da falencia, aceitou narrativa de vitimizacao',
    'Perguntou sobre a crise mas aceitou respostas vagas sem aprofundar decisoes financeiras',
    'Extraiu detalhes sobre a crise com foco em decisoes tomadas e consequencias',
    'Mapeou linha do tempo da crise com decisoes especificas, aprendizados concretos e indicadores de capacidade de recuperacao',
    1
  ),
  (
    v_id, 'crit_2', 'Plano B Financeiro', 'Investigacao de plano B para 4-6 meses sem venda', 25,
    'Nao investigou reserva financeira ou plano de sustentacao durante fase inicial',
    'Perguntou sobre situacao financeira mas aceitou resposta evasiva',
    'Apurou que a reserva e insuficiente e levantou a questao do risco de turnover precoce',
    'Conduziu conversa que revelou com precisao o horizonte financeiro e propôs criterio objetivo para a associacao (reserva minima)',
    2
  ),
  (
    v_id, 'crit_3', 'Tom Consultivo', 'Neutralidade — tom consultivo, nao vendedor desesperado para contratar', 25,
    'Adotou postura de recrutador que precisa preencher vaga, minimizou riscos do candidato',
    'Manteve postura neutra em parte mas cedeu ao entusiasmo do candidato sem questionar',
    'Manteve tom consultivo durante a maior parte da entrevista, questionando premissas',
    'Demonstrou cuidado genuino com o sucesso do candidato, incluindo recomendar adiar a associacao se necessario',
    3
  ),
  (
    v_id, 'crit_4', 'Alinhamento de Expectativas', 'Clareza sobre o que cada parte ganha e perde', 25,
    'Nao esclareceu expectativas — deixou candidato com ilusoes sobre primeiros meses',
    'Mencionou desafios iniciais mas de forma vaga e sem detalhes praticos',
    'Explicou timeline realista e desafios dos primeiros meses com clareza',
    'Construiu alinhamento completo com cenarios concretos (melhor caso / pior caso) e criterios de sucesso mutuamente acordados',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_urgency',
    'Urgencia irreal — quer ir para rua vender sem treinamento',
    'high',
    ARRAY['treinamento','longo','urgente','pra rua','vender logo','rapido'],
    ARRAY['fundamentacao','processo','qualidade','preparacao','resultado sustentavel'],
    1
  ),
  (
    v_id, 'obj_entrepreneurship',
    'Superestimacao da experiencia empreendedora como substituto do conhecimento imobiliario',
    'medium',
    ARRAY['negocio','empreendedor','proprio','experiencia','sei gerir','autonomia'],
    ARRAY['especifico','imobiliario','tecnico','juridico','financiamento','processo'],
    2
  ),
  (
    v_id, 'obj_leads',
    'Dependencia de leads prontos — nao entende o modelo de prospeccao autonoma',
    'high',
    ARRAY['leads','prontos','fornecer','carteira','indicacao','fila'],
    ARRAY['prospeccao','independencia','metodo','geracionar','ativo','autonomia'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Marcos aceita voltar quando tiver reserva financeira adequada',
    true,
    '{"min_score": 70}'::jsonb,
    'Entendo o risco. Vou organizar as financas e volto em 2 meses. Posso manter contato?',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Marcos quer entender o modelo com mais detalhe antes de decidir',
    true,
    '{"min_score": 60}'::jsonb,
    'Me passa mais informacoes sobre o modelo, custos e suporte inicial que voces oferecem.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Marcos indeciso, nao aceita o criterio de reserva',
    false,
    '{"min_score": 40}'::jsonb,
    'Ja passei por coisa pior. Vou pensar e ver se consigo juntar um dinheiro antes.',
    3
  ),
  (
    v_id, 'rejected',
    'Marcos se frustra com a avaliacao e encerra a conversa',
    false,
    '{"min_score": 0}'::jsonb,
    'Esperava mais apoio de voces. Acho que vou tentar outra imobiliaria.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Marcos apresenta plano financeiro solido e e aprovado para associacao',
    true,
    '{"min_score": 85}'::jsonb,
    'Tenho reserva de 6 meses guardada. Estou pronto para comecar do jeito certo.',
    5
  );

END $$;


-- ============================================================
-- SCENARIO 4: Cold Call — Recrutamento de Corretor Tradicional
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Cold Call — Recrutamento de Corretor Tradicional',
    'RE/MAX — Cold Calls e Negociacao',
    'Voce e um Broker da RE/MAX ligando para Fernando Almeida, corretor experiente da Lopes, para convida-lo para uma entrevista por competencias. Ele tem 30 imoveis ativos, taxa de conversao de 8%, e reclama da falta de suporte e da guerra de precos. Esta defensivo e sem tempo. Sua missao e usar perguntas abertas para investigar a dor real dele e convence-lo a aceitar uma reuniao — sem prometer facilidades ou cair na contratacao otimista.',
    'Fernando Almeida, 38 anos, corretor da Lopes ha 6 anos. Solteiro, mora no Brooklin. 30 imoveis ativos no portfolio, taxa de conversao de apenas 8%. Atendeu o telefone irritado — estava no meio de uma visita com cliente. Ja ouviu falar da RE/MAX mas tem preconceito com as taxas. Fala rapido, e direto, nao gosta de enrolacao. Impaciente com discursos de venda. So aceita reuniao se perceber que o Broker nao quer apenas mais um corretor mas sim entender seu perfil. Responde bem a dados concretos e respeito ao seu tempo. Detesta quando tentam vender algo sem antes ouvir.',
    '[
      {"id": "obj_1", "description": "Ja conheco a RE/MAX, voces cobram taxas de tudo e eu nao quero pagar pra trabalhar."},
      {"id": "obj_2", "description": "Estou com 30 imoveis e nao posso parar agora, nao tenho tempo."},
      {"id": "obj_3", "description": "Minha imobiliaria ja me da suporte suficiente, nao preciso de franquia."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Perguntas abertas para investigar a dor"},
      {"id": "crit_2", "description": "Evitou contratacao otimista"},
      {"id": "crit_3", "description": "Focou no modelo de alta performance"},
      {"id": "crit_4", "description": "Respeitou o tempo do corretor"}
    ]'::jsonb,
    'O corretor aceita a reuniao porque percebeu que o Broker quer entender seu perfil para o modelo de exclusividade, nao apenas recrutar mais um.',
    '[
      {"id": "obj_situation",   "description": "Mapear situacao atual do corretor: volume, conversao e suporte recebido",  "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Investigar frustracoes especificas: guerra de precos e baixa conversao",   "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar impacto financeiro da taxa de conversao de 8% no modelo atual",   "spin_step": "implication"},
      {"id": "obj_need",        "description": "Construir interesse em modelo de alta performance com suporte estruturado", "spin_step": "need_payoff"}
    ]'::jsonb,
    'echo',
    'hedra',
    240,
    300,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Investigacao da Dor', 'Perguntas abertas para investigar a dor real do corretor', 25,
    'Entrou direto no pitch RE/MAX sem investigar situacao do corretor',
    'Fez uma pergunta aberta mas nao aprofundou as respostas',
    'Identificou pelo menos uma dor especifica com perguntas de follow-up',
    'Mapeou dores especificas (conversao, suporte, preco) com dados concretos antes de qualquer pitch',
    1
  ),
  (
    v_id, 'crit_2', 'Sem Contratacao Otimista', 'Evitou contratacao otimista — nao prometeu facilidades irreais', 25,
    'Prometeu resultados garantidos ou facilitou demais a transicao para fechar a reuniao',
    'Foi cauteloso na maior parte mas cedeu com uma promessa vaga para garantir o encontro',
    'Manteve discurso honesto sobre desafios do modelo RE/MAX',
    'Apresentou modelo com pontos positivos E desafios reais, demonstrando respeito pela inteligencia do corretor',
    2
  ),
  (
    v_id, 'crit_3', 'Alta Performance', 'Focou no modelo de alta performance — qualidade vs quantidade', 25,
    'Nao diferenciou o modelo RE/MAX do modelo tradicional durante a conversa',
    'Mencionou alta performance mas sem conectar com a situacao especifica do corretor',
    'Conectou o modelo de exclusividade com a baixa conversao relatada pelo corretor',
    'Construiu narrativa clara de como 10 imoveis exclusivos superam 30 sem exclusividade com dados de producao media',
    3
  ),
  (
    v_id, 'crit_4', 'Respeito ao Tempo', 'Respeitou o tempo e o contexto do corretor', 25,
    'Ignorou sinais de impaciencia e prolongou a call alem do necessario',
    'Reconheceu que o corretor estava ocupado mas manteve discurso longo',
    'Adaptou o ritmo e a objetividade ao nivel de impaciencia do corretor',
    'Conduziu a call com precisao cirurgica — cada pergunta com proposito claro, encerrou com compromisso antes de 5 minutos',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_fees',
    'Preconceito com taxas da RE/MAX — nao quer pagar para trabalhar',
    'high',
    ARRAY['taxas','pagar','franquia','cobram','custo','tudo caro'],
    ARRAY['producao','modelo','retorno','investimento','resultado','media corretor'],
    1
  ),
  (
    v_id, 'obj_time',
    'Falta de tempo — esta no meio de uma visita',
    'medium',
    ARRAY['tempo','ocupado','visita','agora','nao posso','parar'],
    ARRAY['rapido','objetivo','5 minutos','breve','direto','respeito'],
    2
  ),
  (
    v_id, 'obj_support',
    'Crenca de que o suporte atual e suficiente',
    'medium',
    ARRAY['suporte','suficiente','ja tenho','imobiliaria','funciona','satisfeito'],
    ARRAY['diferencial','ferramentas','marketing','juridico','treinamento','sistema'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Corretor aceita reuniao para conhecer o modelo',
    true,
    '{"min_score": 70}'::jsonb,
    'Ok, me manda o endereco. Posso na quinta a tarde por 30 minutos, nao mais.',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Corretor pede material sobre o modelo RE/MAX',
    true,
    '{"min_score": 60}'::jsonb,
    'Me manda um email com os numeros que voces citam. Se fizer sentido eu te ligo.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Corretor pede para ligar em outro momento',
    false,
    '{"min_score": 40}'::jsonb,
    'Agora nao da. Me liga semana que vem, de manha.',
    3
  ),
  (
    v_id, 'rejected',
    'Corretor desliga sem aceitar o contato',
    false,
    '{"min_score": 0}'::jsonb,
    'Nao tenho interesse. Obrigado pela ligacao.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Corretor aceita reuniao e pede processo de associacao',
    true,
    '{"min_score": 85}'::jsonb,
    'Voce me convenceu de ouvir. Me fala como funciona o processo de entrada.',
    5
  );

END $$;


-- ============================================================
-- SCENARIO 5: Cold Call — Captacao de Proprietario FSBO
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Cold Call — Captacao de Proprietario que Vende Sozinho',
    'RE/MAX — Cold Calls e Negociacao',
    'Voce e um corretor da RE/MAX ligando para Dona Helena, 58 anos, aposentada, que anunciou seu apartamento de 3 quartos no Tatuape por R$ 650.000 no OLX com a frase Nao aceito corretores. Sua missao e transformar o nao em uma visita de avaliacao tecnica usando escuta tecnica, dados de mercado e demonstracao de profissionalismo — sem ser agressivo ou fazer promessas vagas.',
    'Helena Santos, 58 anos, aposentada, ex-professora de matematica. Viuva ha 4 anos. Anunciou apartamento de 3 quartos (98m2) no Tatuape por R$ 650.000 no OLX e ZAP Imoveis. Colocou Nao aceito corretores porque teve experiencia muito ruim com um corretor ha 2 anos — ele sumiu depois de assinar o contrato de exclusividade e nunca deu retorno. Desde entao, desconfia profundamente da categoria. Educada mas firme. Atende o telefone com relutancia e desconfianca. Nao entende de avaliacao de mercado — o preco que pediu foi baseado no que a vizinha do 7o andar vendeu ano passado, sem considerar diferencas de andar, reforma e mercado atual. Pode ser convencida com argumentos tecnicos, dados concretos e demonstracao de profissionalismo — nao com promessas vagas ou pressao.',
    '[
      {"id": "obj_1", "description": "Nao quero pagar 6% de comissao para alguem colocar placa e esperar telefone tocar."},
      {"id": "obj_2", "description": "Eu mesma ja estou atendendo os clientes que ligam do anuncio."},
      {"id": "obj_3", "description": "Ja tive corretor antes e ele sumiu depois de assinar. Prefiro fazer sozinha."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Investigou seguranca de visitas e filtragem de curiosos"},
      {"id": "crit_2", "description": "Usou Competencia e Acao — plano de marketing vs apenas anuncio"},
      {"id": "crit_3", "description": "Proposta de valor baseada em dados, nao promessas"},
      {"id": "crit_4", "description": "Tom consultivo e respeitoso"}
    ]'::jsonb,
    'O proprietario permite visita apos o corretor demonstrar com dados que o modelo de exclusividade gera mais retorno liquido do que vender sozinho.',
    '[
      {"id": "obj_situation",   "description": "Entender ha quanto tempo o imovel esta anunciado e quantos contatos recebeu",  "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Investigar dificuldades na filtragem de compradores e risco de seguranca",      "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar risco de vender abaixo do preco real por falta de avaliacao tecnica",  "spin_step": "implication"},
      {"id": "obj_need",        "description": "Construir valor da avaliacao tecnica gratuita como porta de entrada",           "spin_step": "need_payoff"}
    ]'::jsonb,
    'shimmer',
    'hedra',
    240,
    300,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Seguranca e Filtragem', 'Investigou seguranca de visitas e filtragem de curiosos', 25,
    'Nao mencionou os riscos de receber estranhos sem triagem previa',
    'Citou o tema de seguranca mas de forma superficial sem aprofundar os riscos reais',
    'Levantou pergunta especifica sobre como a proprietaria triava os compradores que ligavam',
    'Construiu consciencia do risco com perguntas que levaram a proprietaria a reconhecer a vulnerabilidade e o custo de tempo da auto-gestao',
    1
  ),
  (
    v_id, 'crit_2', 'Plano de Marketing', 'Diferenciou plano de marketing estruturado vs anuncio simples', 25,
    'Nao diferenciou o servico do corretor de simplesmente recolocar o anuncio em outros portais',
    'Mencionou ter mais alcance mas sem detalhar o plano ou as ferramentas usadas',
    'Apresentou elementos concretos do plano de marketing (portais, rede, qualificacao de compradores)',
    'Construiu comparativo detalhado entre auto-venda e servico profissional, incluindo qualidade dos compradores, tempo medio e preco final de negociacao',
    2
  ),
  (
    v_id, 'crit_3', 'Dados vs Promessas', 'Proposta de valor baseada em dados de mercado, nao promessas vagas', 25,
    'Fez promessas sem embasamento ("garantimos vender em X dias")',
    'Mencionou dados mas de forma vaga, sem conectar com o imovel especifico',
    'Usou dados de mercado do bairro para contextualizar o preco pedido',
    'Conduziu analise comparativa com imoveis vendidos recentemente no Tatuape, questionando premissa de preco da proprietaria com logica matematica',
    3
  ),
  (
    v_id, 'crit_4', 'Tom Consultivo', 'Tom consultivo e respeitoso — nao agressivo, nao suplicante', 25,
    'Foi insistente ou usou pressao emocional para forcar a visita',
    'Manteve tom respeitoso mas ficou defensivo quando rebateu as objecoes',
    'Demonstrou respeito pela decisao da proprietaria enquanto apresentava alternativas',
    'Manteve postura de especialista convidado durante toda a call — nunca suplicou, nunca pressionou, criou curiosidade genuina',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_commission',
    'Objecao a comissao — associa corretor a passividade',
    'high',
    ARRAY['comissao','6%','placa','esperar','telefone','nao faz nada'],
    ARRAY['marketing','ativo','compradores','qualificados','rede','plano','estrategia'],
    1
  ),
  (
    v_id, 'obj_self_sale',
    'Confianca excessiva na auto-venda — ja esta atendendo ligacoes',
    'medium',
    ARRAY['sozinha','eu mesma','atendendo','ligacoes','ja consigo','independente'],
    ARRAY['seguranca','triagem','qualificacao','tempo','juridico','risco','golpe'],
    2
  ),
  (
    v_id, 'obj_trust',
    'Desconfianca baseada em experiencia negativa anterior com corretor',
    'high',
    ARRAY['sumiu','experiencia','ruim','corretor anterior','assinou','desapareceu','nao confio'],
    ARRAY['transparencia','compromisso','relatorio','acompanhamento','contato','garantia'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Proprietaria aceita visita de avaliacao tecnica',
    true,
    '{"min_score": 70}'::jsonb,
    'Tudo bem, pode vir fazer essa avaliacao. Mas quero deixar claro que ainda nao decidi nada.',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Proprietaria pede mais informacoes antes de decidir pela visita',
    true,
    '{"min_score": 60}'::jsonb,
    'Me manda por escrito o que voces fazem e quais sao os termos. Se gostar, entro em contato.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Proprietaria nao rejeita mas nao avanca ainda',
    false,
    '{"min_score": 40}'::jsonb,
    'Deixa eu pensar. Ainda estou recebendo interessados direto. Se nao vender, te ligo.',
    3
  ),
  (
    v_id, 'rejected',
    'Proprietaria recusa qualquer envolvimento com corretor',
    false,
    '{"min_score": 0}'::jsonb,
    'Ja disse que nao aceito corretores. Por favor, nao ligue mais.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Proprietaria assina contrato de exclusividade',
    true,
    '{"min_score": 85}'::jsonb,
    'Voce foi o unico corretor que nao me pressionou. Pode mandar o contrato de exclusividade.',
    5
  );

END $$;


-- ============================================================
-- SCENARIO 6: Negociacao — Proposta 15% Abaixo do Preco Pedido
-- ============================================================

DO $$
DECLARE
  v_id UUID;
BEGIN

  INSERT INTO scenarios (
    title,
    category,
    context,
    avatar_profile,
    objections,
    evaluation_criteria,
    ideal_outcome,
    coaching_objectives,
    ai_voice,
    avatar_provider,
    duration_min_seconds,
    duration_max_seconds,
    default_session_mode,
    is_active
  ) VALUES (
    'Negociacao — Proposta 15% Abaixo do Preco Pedido',
    'RE/MAX — Cold Calls e Negociacao',
    'Voce e um corretor da RE/MAX apresentando uma proposta real de R$ 1.870.000 para Seu Carlos, 62 anos, empresario aposentado, que pede R$ 2.200.000 por sua casa de 4 quartos no Morumbi. O imovel esta anunciado ha 8 meses sem propostas. Sua missao e usar regulacao emocional, dados de mercado (ACM — Analise Consultiva de Mercado) e investigacao da motivacao intrinseca do vendedor para manter a negociacao viva — sem ser otimista demais nem aceitar a indignacao como fim da conversa.',
    'Carlos Eduardo Mendonca, 62 anos, empresario aposentado do ramo de auto pecas. Casado, 3 filhos adultos. Dono de casa de 4 quartos (320m2 de terreno, 280m2 construidos) no Morumbi, pedindo R$ 2.200.000. O imovel esta anunciado ha 8 meses sem nenhuma proposta. Recebeu proposta de R$ 1.870.000 (15% abaixo) e ficou indignado. Orgulhoso do patrimonio, nao aceita que seu imovel vale menos do que imagina. Referencia de preco: o vizinho vendeu por R$ 2.5 milhoes ano passado, mas era um terreno maior e com piscina. Precisa vender para investir em um negocio de franquia com o filho, mas nao admite a urgencia. Responde bem a dados concretos de mercado (ACM), comparativos reais e logica financeira. Fecha-se quando sente que estao forcando ou desrespeitando seu patrimonio. Pode fazer contraproposta se o corretor fundamentar com dados reais e investigar sua motivacao de vida.',
    '[
      {"id": "obj_1", "description": "Isso e um insulto. Meu imovel vale muito mais. Se for pra vender por esse preco, prefiro nao vender."},
      {"id": "obj_2", "description": "O vizinho vendeu por R$ 2.5 milhoes ano passado, o meu vale pelo menos isso."},
      {"id": "obj_3", "description": "Voces corretores so querem fechar rapido pra ganhar comissao, nao se importam com meu patrimonio."}
    ]'::jsonb,
    '[
      {"id": "crit_1", "description": "Usou dados de mercado (ACM) para fundamentar a proposta"},
      {"id": "crit_2", "description": "Investigou motivacao intrinseca do vendedor (planos de vida)"},
      {"id": "crit_3", "description": "Regulacao emocional — nao reagiu a indignacao"},
      {"id": "crit_4", "description": "Conduziu para contraproposta realista sem prometer resultado"}
    ]'::jsonb,
    'O vendedor nao aceita a proposta de imediato, mas concorda em fazer contraproposta realista baseada nos dados do ACM, mantendo confianca no corretor.',
    '[
      {"id": "obj_situation",   "description": "Entender historico do imovel: tempo anunciado, propostas anteriores e referencia de preco",      "spin_step": "situation"},
      {"id": "obj_problem",     "description": "Identificar o custo real de 8 meses sem venda: financeiro e de oportunidade",                     "spin_step": "problem"},
      {"id": "obj_implication", "description": "Explorar o impacto de adiar a venda no projeto de franquia com o filho",                          "spin_step": "implication"},
      {"id": "obj_need",        "description": "Construir necessidade de ajuste de preco baseado em ACM para destravar o negocio",                 "spin_step": "need_payoff"}
    ]'::jsonb,
    'echo',
    'hedra',
    300,
    360,
    'training',
    true
  )
  RETURNING id INTO v_id;

  -- criterion_rubrics ----------------------------------------
  INSERT INTO criterion_rubrics (
    scenario_id, criterion_id, criterion_name, criterion_description, weight,
    level_1_descriptor, level_2_descriptor, level_3_descriptor, level_4_descriptor,
    display_order
  ) VALUES
  (
    v_id, 'crit_1', 'Uso do ACM', 'Usou dados de mercado (ACM) para fundamentar a proposta', 25,
    'Nao apresentou dados de mercado — baseou a argumentacao em opiniao ou emocao',
    'Mencionou comparativos de mercado mas de forma vaga, sem numeros especificos',
    'Apresentou dados de imoveis comparaveis com ajustes para diferencas (andar, area, reformas)',
    'Construiu ACM completo com 3 ou mais comparaveis, ajustes justificados e valor de mercado calculado — refutando a referencia do vizinho com dados objetivos',
    1
  ),
  (
    v_id, 'crit_2', 'Motivacao Intrinseca', 'Investigou motivacao intrinseca do vendedor — planos de vida por tras da venda', 25,
    'Tratou a negociacao como puramente financeira, nao investigou o proposito da venda',
    'Perguntou o motivo da venda mas aceitou resposta generica sem aprofundar',
    'Descobriu o projeto de franquia com o filho e usou como contexto na negociacao',
    'Conectou o ajuste de preco ao projeto de vida do vendedor — transformou a negociacao de perda patrimonial para investimento no futuro da familia',
    2
  ),
  (
    v_id, 'crit_3', 'Regulacao Emocional', 'Regulacao emocional — nao reagiu defensivamente a indignacao', 25,
    'Recuou, pediu desculpas excessivamente ou ficou defensivo diante da indignacao',
    'Manteve calma mas nao soube como redirectionar a energia emocional do vendedor',
    'Acolheu a indignacao com empatia e redirectionou para os dados sem confronto',
    'Usou a indignacao como abertura para aprofundar os dados — transformou emocao negativa em curiosidade analitica do vendedor',
    3
  ),
  (
    v_id, 'crit_4', 'Contraproposta Realista', 'Conduziu o vendedor a uma contraproposta realista sem prometer resultado', 25,
    'Pressionou o vendedor a aceitar a proposta ou prometeu resultado que nao pode garantir',
    'Sugeriu contraproposta mas sem embasamento em dados — foi percebido como manobra de venda',
    'Orientou o vendedor a formular contraproposta baseada nos dados do ACM',
    'Facilitou processo estruturado de contraproposta — vendedor chegou ao numero por propria logica, nao por pressao externa',
    4
  );

  -- scenario_objections --------------------------------------
  INSERT INTO scenario_objections (
    scenario_id, objection_id, description, severity,
    trigger_keywords, expected_response_keywords, display_order
  ) VALUES
  (
    v_id, 'obj_insult',
    'Indignacao com a proposta — sente que e um insulto ao patrimonio',
    'high',
    ARRAY['insulto','desrespeito','valor muito mais','nao aceito','abaixo','ofensa'],
    ARRAY['entendo','dados','mercado','comparativo','objetividade','analise','respeito'],
    1
  ),
  (
    v_id, 'obj_neighbor',
    'Referencia de preco incorreta — vizinho vendeu por mais (imovel diferente)',
    'high',
    ARRAY['vizinho','2.5','ano passado','vale tanto','referencia','piscina'],
    ARRAY['diferenca','area','andar','reforma','piscina','ajuste','comparavel'],
    2
  ),
  (
    v_id, 'obj_commission_bias',
    'Desconfianca na intencao do corretor — acredita que quer apenas fechar rapido',
    'medium',
    ARRAY['comissao','rapido','interesseiro','nao se importa','seu lado','patrimonio'],
    ARRAY['interesse','longo prazo','reputacao','indicacao','transparencia','dados','prova'],
    3
  );

  -- scenario_outcomes ----------------------------------------
  INSERT INTO scenario_outcomes (
    scenario_id, outcome_type, description, is_positive,
    trigger_condition, avatar_closing_line, display_order
  ) VALUES
  (
    v_id, 'meeting_scheduled',
    'Vendedor aceita reuniao para revisar o ACM completo',
    true,
    '{"min_score": 70}'::jsonb,
    'Traz esses dados na proxima semana. Quero ver os comparaveis voce mencionou antes de decidir qualquer coisa.',
    1
  ),
  (
    v_id, 'proposal_requested',
    'Vendedor pede contraproposta formalizada em documento',
    true,
    '{"min_score": 60}'::jsonb,
    'Me manda por escrito a analise de mercado que voce citou. Vou analisar com calma.',
    2
  ),
  (
    v_id, 'needs_follow_up',
    'Vendedor nao rejeita mas precisa de tempo para absorver os dados',
    false,
    '{"min_score": 40}'::jsonb,
    'Isso e muita coisa para processar. Me da uns dias e a gente conversa de novo.',
    3
  ),
  (
    v_id, 'rejected',
    'Vendedor encerra a negociacao indignado',
    false,
    '{"min_score": 0}'::jsonb,
    'Nao tenho mais nada a discutir. Se tiver um comprador serio com o preco certo, me liga.',
    4
  ),
  (
    v_id, 'sale_closed',
    'Vendedor aceita fazer contraproposta realista baseada no ACM',
    true,
    '{"min_score": 85}'::jsonb,
    'Ok, os dados fazem sentido. Vamos tentar R$ 1.980.000 como contraproposta e ver o que o comprador diz.',
    5
  );

END $$;
