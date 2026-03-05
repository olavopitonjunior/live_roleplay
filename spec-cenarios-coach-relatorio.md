# Especificacao Conceitual — Cenarios, Coach e Relatorio

Data: Marco 2026
Versao: 1.0
Status: Para implementacao via Claude Code

---

## 1. Visao Geral

Este documento consolida as decisoes de produto para a evolucao de tres camadas interdependentes do Live Roleplay: Cenarios (fundacao), Coach (operacao em tempo real) e Relatorio (avaliacao pos-sessao). As tres camadas se alimentam mutuamente — o cenario define o que o avatar faz, o coach monitora em cima disso, e o relatorio avalia o resultado.

Principios transversais:

- A IA preenche e enriquece. O admin fornece o minimo e a IA gera o resto com qualidade.
- Todos os campos sao estruturados no banco, mesmo os ocultos. O system prompt e compilado a partir deles, nunca o contrario.
- Existem dois modos de sessao: solo (sem coach visivel) e com coach (HUD + ferramentas acionaveis). O relatorio se adapta ao modo.

---

## 2. Camada de Cenarios

### 2.1 Fluxo de Criacao

O admin interage com o builder em duas etapas:

Etapa 1 — Input minimo. O admin fornece tres informacoes:
- Descricao livre do cenario (linguagem natural)
- Objetivo do usuario (o que o rep precisa alcançar)
- Nivel de dificuldade (facil, medio, dificil)

Etapa 2 — Previa conversacional. A IA interpreta o input e devolve um paragrafo curto descrevendo o cenario que entendeu: quem e o personagem, como vai se comportar, quais objecoes vai levantar, como a sessao comeca e termina, e como o usuario vai ser avaliado. O admin le e pode corrigir em linguagem natural ("muda a objecao principal para X", "quero que ele seja mais agressivo"). Essa etapa e uma conversa, nao um formulario.

Etapa 3 — Campos editaveis. Depois que o admin aprova a previa, o sistema exibe os campos estruturados ja preenchidos. Seis campos ficam expostos para edicao direta. Os demais ficam ocultos com opcao de modo avancado.

### 2.2 Campos Expostos (sempre visiveis)

Nome e cargo do personagem
O admin pode querer que o avatar represente um perfil especifico da base de clientes dele. A IA gera, o admin ajusta se necessario.

Personalidade
Resumo em texto livre, 2-3 frases. E o campo que mais define o tom da sessao. Ex: "Educado mas evasivo, evita compromissos diretos."

Objecoes
Lista editavel. O admin precisa validar porque ele sabe quais objecoes seus clientes reais fazem. Pode adicionar, remover ou reordenar.

Objetivo do usuario
Ja fornecido como input, aparece para confirmacao. A IA pode ter reformulado.

Criterios de avaliacao
O admin valida o que vai ser medido. Se a IA gerou "identificou a dor do cliente" e o admin quer "mencionou o ROI do produto", precisa poder trocar.

Fala de abertura
Como o avatar inicia a conversa. Campo curto que define o tom dos primeiros segundos.

### 2.3 Campos Ocultos (modo avancado)

Todos os campos abaixo sao gerados pela IA a partir do input do admin e armazenados como dados estruturados no banco. Ficam acessiveis no modo avancado para admins que queiram editar.

Bloco Situacao:
- Tipo de sessao (cold call, objecao, discovery, retencao, etc.) — inferido da descricao
- Contexto de mercado (setor, empresa, momento) — inferido da descricao
- Condicao de sucesso — derivada do objetivo do usuario
- Condicao de encerramento — derivada do tipo de sessao
- Duracao alvo — derivada do tipo de sessao e dificuldade

Bloco Personagem:
- Objetivo oculto — o que o personagem quer mas nao declara (ex: "quer desconto mas nao vai pedir primeiro")
- Estado emocional inicial — derivado da dificuldade e tipo de cenario
- Reatividade emocional — regras de como a emocao muda conforme a interacao (oculto, nao editavel nem no modo avancado)
- Estilo de comunicacao — prolixo vs. monossilabico, formal vs. informal, interrompe ou nao
- Frases e expressoes tipicas — vocabulario que ancora o personagem
- Limites de conhecimento — o que o personagem sabe e nao sabe sobre o produto do usuario
- Backstory — historico resumido que justifica o comportamento

Bloco Avaliacao:
- Peso por criterio — distribuicao de pesos padrao baseada no tipo de cenario
- Indicadores positivos — comportamentos que somam pontos
- Indicadores negativos — comportamentos que tiram pontos
- Escala de scoring — como cada criterio e pontuado

### 2.4 Comportamento Dinamico de Runtime

A IA gera tres tipos de logica dinamica a partir dos campos do cenario. Essa logica e compilada no system prompt e governa como o avatar evolui ao longo da sessao.

Reatividade emocional (oculta, nao editavel)
Regras especificas do cenario que definem como o avatar reage ao usuario. Ex: "Se o usuario ignorar 2 objecoes, avatar fica impaciente. Se o usuario fizer uma boa pergunta de discovery, avatar abre mais." Geradas pela IA a partir da personalidade, dificuldade e objecoes.

Fluxo de fases (editavel no modo avancado)
A sessao tem fases com comportamentos distintos:
- Abertura — avatar se apresenta, estabelece contexto, da espaco para o usuario entrar. Duracao sugerida pela IA.
- Corpo — objecoes, discovery, negociacao. Avatar segue objetivo oculto e reage conforme reatividade emocional.
- Encerramento — avatar sinaliza decisao (positiva, negativa ou adiamento) conforme desempenho do usuario.

A IA gera duracoes sugeridas por fase e o avatar tem consciencia de quanto tempo falta para ajustar o ritmo. Um admin avancado pode editar o fluxo, por exemplo definindo que "a objecao de preco so aparece depois do minuto 2".

Escalada de dificuldade (oculta, nao editavel)
Se o usuario esta performando muito bem, o avatar pode introduzir uma objecao nao prevista ou encurtar respostas. Se o usuario esta patinando, o avatar pode dar mais aberturas. Derivada do nivel de dificuldade configurado.

### 2.5 Versionamento

Quando um cenario e editado, o sistema cria uma nova versao. Sessoes ja rodadas permanecem vinculadas a versao do cenario que existia no momento da execucao. Isso garante que relatorios historicos nao sejam invalidados por mudancas retroativas nos criterios ou objecoes.

### 2.6 Cenarios Pre-configurados

Os cenarios entregues prontos pela plataforma seguem a mesma estrutura — todos os campos ocultos vem preenchidos, incluindo reatividade emocional, frases tipicas e fluxo de fases. Nao sao versoes simplificadas; sao cenarios completos que servem como referencia de qualidade.

### 2.7 Compilacao do System Prompt

Os campos estruturados sao compilados em um system prompt seguindo a arquitetura recomendada pelo guia de prompting da OpenAI Realtime API:

1. Role & Objective — SEU PAPEL (CRITICO), derivado dos campos do personagem
2. Personality & Tone — personalidade, estilo de comunicacao, frases tipicas
3. Context — contexto de mercado, backstory, limites de conhecimento
4. Instructions/Rules — regras de comportamento, reatividade emocional, escalada de dificuldade
5. Conversation Flow — fases com duracoes, transicoes e condicoes de encerramento
6. Safety & Escalation — condicoes de encerramento, fallback para problemas tecnicos

---

## 3. Camada do Coach

### 3.1 Arquitetura

O coach evolui o coach_orchestrator.py existente. A fundacao se mantem: estado centralizado, fila de prioridade, gating por estado do agente. O que muda e o que o orchestrator produz como output.

Tres tipos de output:
- Estados continuos — dados do HUD, emitidos sempre, independente de gerar mensagem
- Respostas a ferramentas — processamento sob demanda quando o usuario aciona
- Coleta silenciosa — acumula dados para o relatorio sem emitir nada para o frontend (modo solo e modo com coach)

### 3.2 Modos de Sessao

Modo solo
O coach nao aparece durante a sessao. O orchestrator continua processando internamente para alimentar o relatorio. O usuario nao ve HUD nem tem acesso a ferramentas. O orchestrator registra momentos em que o usuario teria se beneficiado de ajuda (hesitacoes longas, objecoes nao tratadas) para incluir no relatorio como oportunidades perdidas.

Modo com coach
O usuario ve sinais continuos (HUD) e tem acesso a ferramentas acionaveis. O orchestrator opera nos tres tipos de output simultaneamente.

### 3.3 Briefing Pre-Sessao

Antes da sessao comecar, o usuario ve um briefing curto gerado a partir do cenario. Ex: "Voce vai conversar com Roberto, Diretor de TI da TechCorp. Ele esta satisfeito com o fornecedor atual. Seu objetivo e agendar uma demo." No modo com coach, o briefing inclui: "O coach estara disponivel durante a sessao com indicadores e ferramentas de apoio."

### 3.4 HUD — Sinais Continuos

Tres sinais visuais, sempre visiveis no modo com coach, leves e nao intrusivos:

Estado emocional do avatar
Indicador visual simples (rotulo que muda). Ex: "Cetico", "Abrindo", "Impaciente", "Interessado". Devolve ao usuario a leitura emocional que em uma conversa presencial viria pela linguagem corporal.

Tempo e balanco de fala
Timer da sessao e proporcao visual de quem esta falando mais (talk ratio). Se o usuario esta falando 80% do tempo em discovery, o indicador sinaliza visualmente sem precisar de texto.

Indicador de progresso do cenario
Sinaliza em que fase da sessao o usuario esta: "Abertura", "Discovery", "Objecao", "Fechamento". Mostra onde o usuario esta na jornada sem entregar a resposta. O orchestrator detecta transicao de fase baseado no comportamento do avatar (levantou primeira objecao = saiu da fase de abertura) e no tempo decorrido.

### 3.5 Ferramentas Acionaveis

Tres ferramentas sob demanda, disponiveis apenas no modo com coach:

Ferramenta 1 — Teleprompter

Quando: o usuario esta entre turnos, ouviu o avatar e nao sabe como responder.
Acionamento: botao na interface.
O que faz: gera sugestao do que dizer baseada no contexto atual — o que o avatar acabou de falar, estado emocional, fase do cenario, objecoes pendentes, objetivo do usuario.
Formato: duas camadas. Primeiro a estrategia em uma linha curta e em destaque ("Reconheca a preocupacao e pergunte o deadline"). Abaixo, sugestao de frase em tom mais discreto ("Entendo sua preocupacao com o prazo. Qual seria o deadline ideal para voces?"). O usuario escolhe o nivel de ajuda.
Comportamento: o texto aparece enquanto o avatar espera. Some quando o usuario comeca a falar.
Otimizacao de latencia: o orchestrator pre-calcula uma sugestao a cada turno do avatar em background. Quando o botao e acionado, a sugestao ja esta pronta. Se nao acionada, descarta.

Ferramenta 2 — "O que ele quis dizer?"

Quando: logo depois que o avatar fala. O usuario nao entende a intencao por tras.
Acionamento: botao na interface.
O que faz: analisa a ultima fala do avatar no contexto do cenario (objetivo oculto, estado emocional, fase da sessao) e devolve uma interpretacao curta. Ex: "Ele esta testando se voce vai pressionar. O objetivo dele e ganhar tempo para comparar com o concorrente. Nao e um nao — e uma objecao de timing disfarçada."
Comportamento: a sessao nao pausa. A interpretacao aparece como card rapido (2-3 segundos de leitura). Se o usuario precisa de mais tempo, aciona o timeout separadamente.

Ferramenta 3 — Timeout/Pause

Quando: qualquer momento da sessao.
Acionamento: botao na interface.
O que faz: congela a sessao — avatar para de falar, timer congela.
O que aparece: resumo do momento atual — o que o avatar disse por ultimo, estado emocional, objecao pendente se houver, fase do cenario. Nao sugere acao — da consciencia situacional.
Composicao: durante o pause, o usuario pode acionar o teleprompter se quiser sugestao. As ferramentas se compoem.
Retomada: o avatar age como se nada aconteceu (continua esperando resposta). O pause e ferramenta de aprendizado, nao faz parte da simulacao.
Limite: sem limite de pauses por sessao. O numero e tempo total pausado entram no relatorio como indicador de nivel.

Timing de acionamento das ferramentas:
- Teleprompter: entre turnos (enquanto o usuario precisa responder)
- "O que ele quis dizer?": logo apos fala do avatar
- Timeout: qualquer momento

### 3.6 Transicao para o Relatorio

Quando a sessao termina, no modo com coach, o usuario ve um resumo rapido antes do relatorio completo: "Sessao encerrada. Voce tratou 2 de 3 objecoes, o cliente terminou receptivo. Relatorio completo em alguns segundos." Isso preenche o vazio entre fim da sessao e relatorio pronto.

No modo solo, a transicao vai direto para o loading do relatorio.

### 3.7 Registro de Eventos

Cada acionamento de ferramenta e cada atualizacao de estado do HUD e um evento registrado pelo orchestrator com timestamp e contexto da conversa. Esses eventos alimentam o relatorio.

Eventos registrados:
- Mudancas de estado emocional do avatar (com causa)
- Transicoes de fase do cenario
- Acionamentos de ferramentas (tipo, contexto, o que o usuario fez depois)
- Momentos de hesitacao do usuario (pausas longas entre turnos)
- Talk ratio por janela de tempo
- Objecoes detectadas e status (tratada, parcial, ignorada)
- No modo solo: momentos em que o usuario teria se beneficiado de ajuda

---

## 4. Camada do Relatorio

### 4.1 Modelo de Geracao

O relatorio e gerado por uma unica chamada ao Claude com output estruturado (JSON). O modelo avaliador recebe como input:

- Transcript completo da sessao
- Configuracao do cenario (criterios, pesos, objecoes, rubrica)
- Dados do coach: estados emocionais ao longo da sessao, objecoes detectadas com status, momentos de hesitacao, ferramentas acionadas, talk ratio, fases detectadas
- Modo da sessao (solo ou com coach)
- Historico resumido do usuario no mesmo cenario (sessoes anteriores, scores, tendencias)

Uma unica chamada garante coerencia — a narrativa cita os mesmos momentos-chave que aparecem na lista, o score reflete o que a narrativa descreve.

### 4.2 Camada 1 — Score e Visao Geral

Score objetivo baseado na rubrica configurada no cenario (criterios 1-4 com pesos). Mantém o sistema existente com duas adicoes:

Indicador de confianca
Se o transcript cobriu menos de 80% do audio, ou se a sessao foi muito curta (abaixo do minimo de turnos/duracao), o score aparece com ressalva. Se a confianca esta abaixo do limiar minimo, a sessao e marcada como "nao avaliavel — tente novamente".

Indicador de assistencia
Quantas vezes o usuario acionou ferramentas do coach e quais. Ex: "Sessao com coach — 2 teleprompters, 1 pause, 1 interpretacao". Visivel para o usuario e para o gestor. Nao penaliza o score, mas fica registrado como informacao contextual.

Contextualizacao por dificuldade
Um score de 70% em cenario dificil e melhor que 90% em cenario facil. O relatorio contextualiza: "Score 72% — cenario de dificuldade alta. Equivalente a ~85% em dificuldade media." Evita que usuarios que praticam cenarios dificeis se sintam punidos.

### 4.3 Camada 2 — Narrative Feedback

Um paragrafo gerado pelo Claude que conta o que aconteceu na sessao em linguagem humana. Nao e lista de acertos e erros — e narrativa.

Ex: "Voce abriu bem a conversa com uma pergunta de situacao, o que deixou o cliente receptivo nos primeiros 40 segundos. Quando ele levantou a objecao de preco no minuto 1:20, voce reconheceu a preocupacao mas nao explorou o que 'caro' significava para ele. Isso fez o cliente ficar hesitante. No minuto 2:10 voce recuperou bem ao trazer um case similar."

A narrativa e alimentada pelos dados do coach — estados emocionais, objecoes, hesitacoes, ferramentas acionadas — o que a torna muito mais precisa do que um resumo baseado apenas no transcript.

### 4.4 Camada 3 — Momentos-chave

Lista de 3-5 momentos determinantes da sessao. Cada momento tem:
- Timestamp
- Etiqueta (objecao tratada, oportunidade perdida, virada emocional, uso de ferramenta, boa pergunta, risco)
- Link para o trecho do transcript

Momentos-chave sao unidades narrativas, nao apenas evidencias de criterio. "O avatar mudou de cetico para interessado quando voce fez a pergunta X" nao e evidencia de nenhum criterio especifico, mas e o insight mais valioso da sessao.

### 4.5 Camada 4 — Dados do Coach

Essa camada se adapta ao modo da sessao.

No modo com coach:
Mostra sinais que o HUD exibiu (estados emocionais, talk ratio, fases), ferramentas acionadas com contexto (quando acionou, o que a sessao exigia naquele momento, o que o usuario fez depois), e momentos em que o coach pré-calculou sugestao mas o usuario nao acionou. Aparece como secao separada: "Assistencia do Coach".

No modo solo:
Mostra momentos em que o usuario teria se beneficiado de ajuda. Ex: "No minuto 1:15, voce hesitou por 4 segundos apos a objecao de preco. Em modo com coach, o teleprompter estaria disponivel." Cria incentivo natural para experimentar o modo com coach.

### 4.6 Camada 5 — Comparativo, Evolucao e Proximos Passos

O relatorio se conecta ao historico do usuario.

Evolucao por cenario: como o score evoluiu ao longo das sessoes no mesmo cenario.
Evolucao por competencia: se o tratamento de objecoes esta melhorando, se o talk ratio esta convergindo para a faixa ideal, se o tempo de resposta esta subindo ou descendo.

Proximos passos acionaveis: o relatorio fecha com uma recomendacao concreta gerada pelo Claude. Ex: "Baseado nesta sessao, sugerimos praticar tratamento de objecoes de preco no cenario X" ou "Seu talk ratio esta alto — na proxima sessao, foque em fazer perguntas abertas antes de argumentar."

### 4.7 Visao do Gestor

O gestor ve o mesmo relatorio que o usuario, com uma camada extra:
- Espaco para adicionar notas e comentarios sobre a sessao
- Visao comparativa com outros membros da equipe no mesmo cenario
- Indicador de assistencia em destaque (para avaliar proficiencia real vs. assistida)

### 4.8 Sessao Invalida

Se a sessao foi muito curta, o transcript cobriu pouco, ou houve falha tecnica, o relatorio entra em estado proprio: "Sessao nao avaliavel". Nao exibe score nem rubrica. Mostra o motivo (duracao insuficiente, falha de audio, transcript incompleto) e sugere tentar novamente. A narrativa e os momentos-chave ainda sao gerados se houver dados suficientes — o que nao e gerado e o score.

---

## 5. Conexoes Entre as Camadas

### Cenario alimenta Coach
O coach recebe a configuracao completa do cenario: fases com duracoes, objecoes esperadas, criterios de avaliacao, estado emocional inicial e regras de reatividade. Isso permite que o HUD mostre progresso real (nao generico), que o teleprompter gere sugestoes contextualizadas, e que o "o que ele quis dizer?" use o objetivo oculto do personagem.

### Coach alimenta Relatorio
O relatorio recebe todos os eventos registrados pelo coach: estados emocionais com timestamps e causas, transicoes de fase, ferramentas acionadas com contexto, hesitacoes, talk ratio por janela. Isso transforma o relatorio de "analise de transcript" em "analise de sessao completa".

### Relatorio alimenta proxima Sessao
O historico de relatorios alimenta a proxima sessao de duas formas: o briefing pre-sessao pode mencionar pontos de atencao de sessoes anteriores, e o modelo avaliador usa o historico para contextualizar a evolucao. Os user_learning_profiles e user_difficulty_profiles existentes sao a infraestrutura para isso.

### Cenario versiona, Relatorio congela
Quando um cenario e editado, sessoes historicas mantem vinculo com a versao original. O relatorio sempre reflete o cenario como era quando a sessao foi rodada.

---

## 6. Impacto no Schema Existente

Campos a adicionar na tabela scenarios (ou tabela auxiliar):
- Todos os campos ocultos do bloco Situacao, Personagem e Avaliacao (JSONB)
- Fluxo de fases com duracoes (JSONB)
- Reatividade emocional (JSONB)
- Versao do cenario (integer, auto-incrementado a cada edicao)

Campos a adicionar na tabela sessions:
- Modo da sessao (solo / com_coach)
- Versao do cenario utilizada (FK ou snapshot)
- Eventos do coach (JSONB — estados, ferramentas, hesitacoes)

Campos a adicionar na tabela feedbacks:
- Indicador de confianca (float)
- Indicador de assistencia (JSONB — contagem por ferramenta)
- Momentos-chave (JSONB)
- Narrative feedback (text — separado do summary existente)
- Proximos passos (text)
- Contextualizacao por dificuldade (text)

Tabela nova (ou extensao):
- scenario_versions — snapshot completo do cenario no momento da edicao, referenciado por sessions

---

## 7. Impacto no System Prompt

O system prompt atual (prompts.py) e monolitico. Na nova arquitetura, ele e compilado a partir dos campos estruturados do cenario seguindo a estrutura:

1. Role & Objective — campos: nome, cargo, objetivo oculto, regras anti-inversao
2. Personality & Tone — campos: personalidade, estilo de comunicacao, frases tipicas
3. Context — campos: contexto de mercado, backstory, limites de conhecimento
4. Instructions/Rules — campos: reatividade emocional, escalada de dificuldade, objecoes com timing
5. Conversation Flow — campos: fases com duracoes, condicoes de transicao, fala de abertura, condicoes de encerramento
6. Safety & Escalation — condicoes de encerramento, comportamento em caso de usuario confuso ou silencioso

A funcao build_agent_instructions() recebe o cenario completo (campos expostos + ocultos) e compila o prompt. Nenhum campo e hard-coded no prompt — tudo vem do banco.

---

## 8. Impacto no Coach Orchestrator

O coach_orchestrator.py evolui de tres formas:

Nova responsabilidade: manter e emitir estados continuos (HUD)
O orchestrator ja rastreia emocao, SPIN stage e talk ratio internamente. A evolucao e expor esses estados como participant attributes do LiveKit (ou via RPC) para o frontend renderizar o HUD. Isso e aditivo — nao requer reescrita.

Nova responsabilidade: responder a ferramentas
O orchestrator ganha um canal reativo alem do proativo. Quando o usuario aciona teleprompter, "o que ele quis dizer?" ou timeout, o evento entra na fila como item HIGH priority. O orchestrator processa e devolve. O pre-calculo do teleprompter roda em background a cada turno do avatar.

Nova responsabilidade: detectar fase do cenario
O orchestrator recebe o fluxo de fases do cenario e detecta transicoes. Mecanismo: baseado no comportamento do avatar (levantou objecao = entrou em fase de objecao) combinado com tempo decorrido. Atualiza o indicador de progresso no HUD.

Modo silencioso
No modo solo, o orchestrator processa tudo mas nao emite estados nem aceita ferramentas. Os dados ficam acumulados para o relatorio.

---

## 9. Impacto no Generate-Feedback

A Edge Function generate-feedback evolui para receber um pacote expandido:

Input atual: transcript + cenario (criterios, objecoes)
Input novo: transcript + cenario completo (com versao) + eventos do coach (estados emocionais, objecoes detectadas, ferramentas acionadas, hesitacoes, talk ratio, fases) + modo da sessao + historico resumido do usuario

Output atual: score + criteria_results + summary
Output novo (JSON estruturado):
- score (com indicador de confianca e contextualizacao por dificuldade)
- criteria_results (rubrica 1-4 com evidencias)
- narrative_feedback (paragrafo narrativo)
- key_moments (3-5 momentos com timestamp, etiqueta e link)
- coach_data (dados de assistencia adaptados ao modo)
- evolution (comparativo com sessoes anteriores)
- next_steps (recomendacao acionavel)
- session_validity (valida / invalida com motivo)

Uma unica chamada ao Claude com prompt estruturado que pede todas as camadas no mesmo JSON.

---

## 10. Ordem de Implementacao Sugerida

Fase 1 — Schema e modelo de dados
Expandir tabela scenarios com campos ocultos (JSONB). Criar mecanismo de versionamento. Adicionar campos de modo e eventos na sessions. Expandir feedbacks.

Fase 2 — Builder de cenarios
Implementar fluxo de input minimo + previa conversacional + campos editaveis. Conectar com Edge Functions existentes (generate-scenario, suggest-scenario-fields). Gerar todos os campos ocultos via IA. Compilar system prompt a partir dos campos.

Fase 3 — Coach evoluido
Adicionar emissao de estados continuos ao orchestrator. Implementar deteccao de fase. Implementar as tres ferramentas acionaveis. Implementar modo silencioso. Adicionar briefing pre-sessao e resumo pos-sessao.

Fase 4 — Relatorio evoluido
Expandir generate-feedback para receber pacote completo. Implementar as 5 camadas do relatorio. Implementar visao do gestor. Implementar estado de sessao invalida.

Fase 5 — Cenarios pre-configurados
Recriar os cenarios existentes na nova estrutura com todos os campos preenchidos. Servem como referencia de qualidade.
