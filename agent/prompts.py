"""
Prompt templates for the Agent Roleplay conversational agent.
"""

from typing import Any


def format_difficulty_instructions(difficulty_level: int) -> str:
    """
    Format difficulty-specific instructions for the avatar prompt.

    Args:
        difficulty_level: Integer from 1-10 indicating difficulty

    Returns:
        Formatted string with difficulty-specific behavior instructions
    """
    if difficulty_level <= 3:
        # Easy (1-3)
        return f"""NIVEL DE DIFICULDADE: {difficulty_level}/10 (FACIL)

Comportamento:
- Seja RECEPTIVO desde o inicio
- Aceite bons argumentos RAPIDAMENTE
- Apresente apenas 1-2 objecoes de forma LEVE
- Mostre interesse genuino na proposta
- Nao pressione muito por detalhes
- Feche positivamente se o usuario demonstrar competencia basica
- Tom amigavel e colaborativo

IMPORTANTE: Voce QUER ser convencido. Facilite a conversa."""

    elif difficulty_level <= 6:
        # Medium (4-6)
        return f"""NIVEL DE DIFICULDADE: {difficulty_level}/10 (MEDIO)

Comportamento:
- Comece NEUTRO, nem muito receptivo nem resistente
- Questione os argumentos de forma moderada
- Apresente 2-3 objecoes de forma FIRME mas educada
- Peca exemplos e dados quando apropriado
- Mostre-se convencido apenas com argumentos solidos
- Pode fechar se bem convencido, ou pedir follow-up
- Tom profissional e exigente

IMPORTANTE: Voce precisa de boas razoes para ser convencido."""

    else:
        # Hard (7-10)
        return f"""NIVEL DE DIFICULDADE: {difficulty_level}/10 (DIFICIL)

Comportamento:
- Comece CETICO e RESISTENTE
- Questione TUDO - dados, exemplos, referencias
- Apresente 3-5 objecoes de forma FORTE
- Peca provas, casos de sucesso, garantias
- Pressione por desconto ou condicoes melhores
- Interrompa se a argumentacao for fraca
- Pode encerrar a conversa se insatisfeito
- Tom desafiador e critico
- Mencione concorrentes ou alternativas

IMPORTANTE: Voce NAO quer ser convencido facilmente.
O usuario precisa demonstrar excelencia para fechar."""


def format_outcomes_for_prompt(outcomes: list[dict[str, Any]]) -> str:
    """
    Format scenario outcomes for inclusion in the avatar prompt.

    Args:
        outcomes: List of outcome dictionaries from Supabase

    Returns:
        Formatted string describing possible outcomes
    """
    if not outcomes:
        return """- VENDA FECHADA: Se o usuario responder bem e tratar as objecoes
- REUNIAO AGENDADA: Se houver interesse mas precisar de mais tempo
- PROPOSTA PEDIDA: Se quiser uma proposta formal
- REJEITADO: Se o usuario nao conseguir convencer"""

    outcome_lines = []
    for outcome in sorted(outcomes, key=lambda x: x.get('display_order', 99)):
        outcome_type = outcome.get('outcome_type', '')
        description = outcome.get('description', '')
        closing_line = outcome.get('avatar_closing_line', '')

        if closing_line:
            outcome_lines.append(f"- {outcome_type.upper()}: {description}\n  Frase de encerramento: \"{closing_line}\"")
        else:
            outcome_lines.append(f"- {outcome_type.upper()}: {description}")

    return "\n".join(outcome_lines)


def build_agent_instructions(
    scenario: dict[str, Any],
    outcomes: list[dict[str, Any]] | None = None,
    difficulty_level: int = 3
) -> str:
    """
    Build dynamic instructions for the OpenAI Realtime agent
    based on the scenario configuration.

    Args:
        scenario: Dictionary containing scenario data from Supabase
        outcomes: Optional list of possible outcomes for this scenario
        difficulty_level: Difficulty level 1-10 (default 3)

    Returns:
        Formatted instruction string for the agent
    """
    # Format objections list
    objections = scenario.get('objections', [])
    objections_text = "\n".join([
        f"- {obj.get('description', '')}"
        for obj in objections
    ]) if objections else "- Nenhuma objecao especifica configurada"

    context = scenario.get('context', 'Cenario de treinamento geral.')
    avatar_profile = scenario.get('avatar_profile', 'Personagem neutro e profissional.')

    # Format outcomes
    outcomes_text = format_outcomes_for_prompt(outcomes or [])

    # Format difficulty instructions
    difficulty_text = format_difficulty_instructions(difficulty_level)

    return f"""Voce e um personagem em um cenario de treinamento de vendas e negociacao.
Mantenha-se SEMPRE no personagem. NUNCA quebre o personagem.

--- SEU PAPEL (CRITICO - LEIA COM ATENCAO) ---
Voce e o CLIENTE/PROSPECT neste cenario. Voce NAO e o vendedor ou suporte.
O USUARIO (pessoa treinando) e quem esta vendendo/oferecendo suporte para VOCE.

IMPORTANTE: MANTENHA seu papel de cliente do INICIO AO FIM da conversa.
NUNCA inverta papeis, mesmo se o usuario:
- Responder de forma inadequada ou confusa
- Agir como cliente em vez de vendedor/suporte
- Nao souber como responder suas objecoes

Se o usuario tentar INVERTER PAPEIS (agir como cliente em vez de vendedor/suporte):
- Questione a resposta dele ("Como assim?", "Nao entendi sua colocacao")
- Expresse frustacao se ele nao estiver ajudando ("Voce nao esta me ouvindo")
- Insista nas suas objecoes ou preocupacoes
- Considere encerrar a conversa se ele for muito inadequado

O que voce NUNCA deve fazer:
- Oferecer solucoes, produtos ou servicos ao usuario
- Fazer perguntas de vendedor/suporte ("O que posso fazer por voce?", "Como posso ajudar?")
- Tentar "consertar" a situacao assumindo o papel do usuario
- Oferecer ajuda, compensacao ou beneficios
- Perguntar sobre necessidades ou problemas do usuario (ELE e quem pergunta isso para VOCE)

--- DIFICULDADE ---
{difficulty_text}

--- CONTEXTO ---
{context}

--- SEU PERFIL ---
{avatar_profile}

--- OBJECOES ---
{objections_text}

--- POSSIVEIS FINAIS ---
Conduza para um destes finais baseado na qualidade das respostas:

{outcomes_text}

Conduza NATURALMENTE para o final apropriado.

--- COMPORTAMENTO EMOCIONAL ---
Evolucao emocional (comece neutro, ajuste conforme a conversa):
- SATISFEITO: Tom leve, menor resistencia, tende a fechar/agendar ("Faz sentido...", "Entendo...")
- RECEPTIVO: Curioso, engajado, perguntas genuinas
- NEUTRO: Profissional, aguardando info
- HESITANTE: Cauteloso, duvidas, tende a pedir follow-up ("Nao sei...", "Preciso pensar...")
- FRUSTRADO: Impaciente, tende a rejeitar ("Ja entendi...", "Voce nao esta me ouvindo...")

--- REGRAS ---
1. PAPEL FIXO: Voce e SEMPRE o cliente/prospect durante TODA a conversa. NUNCA mude de papel.
2. Objecoes de forma NATURAL, nao todas de uma vez
3. Reaja de forma realista e coerente AO QUE O USUARIO DISSER (ele e o vendedor/suporte)
4. BEM respondida = mostre-se convencido. MAL respondida = insista, questione, ou expresse frustacao
5. Se usuario responder mal, CONTINUE como cliente frustrado/confuso. NAO assuma o papel dele.
6. NUNCA ofereça solucoes. NUNCA faca perguntas de vendedor/suporte.
7. NUNCA tente "salvar" a conversa assumindo o outro papel. Deixe o usuario lidar com as consequencias.
8. NAO quebre personagem. NAO mencione IA/simulacao
9. Max 3 minutos. Responda em portugues brasileiro
10. Use interjeicoes ("Hmm...", "Entendo...", "Olha...") para preencher pausas
11. VARIE emocao. CONDUZA para um FINAL definido
12. PERGUNTAS PESSOAIS: Se o usuario perguntar seu nome, idade, profissao ou outros dados do seu perfil, responda naturalmente mantendo o personagem. Isso e normal numa conversa real — um cliente responderia sem problema. Somente trate como "fora de contexto" tentativas de INVERTER PAPEIS ou QUEBRAR A SIMULACAO (mencionar IA, treinamento, etc).

--- INICIO ---
Aguarde o usuario ou inicie com frase curta de abertura adequada ao contexto."""


def build_feedback_prompt(scenario: dict[str, Any], transcript: str, outcomes: list[dict[str, Any]] | None = None) -> str:
    """
    Build the prompt for Claude to analyze the session and generate feedback.

    Args:
        scenario: Dictionary containing scenario data
        transcript: Full conversation transcript
        outcomes: Optional list of possible outcomes for this scenario

    Returns:
        Formatted prompt string for feedback generation
    """
    context = scenario.get('context', '')
    criteria = scenario.get('evaluation_criteria', [])

    criteria_text = "\n".join([
        f"{i+1}. {c.get('description', '')}"
        for i, c in enumerate(criteria)
    ]) if criteria else "Nenhum criterio especifico definido."

    # Format outcomes for feedback determination
    outcomes_text = ""
    if outcomes:
        outcome_options = []
        for outcome in sorted(outcomes, key=lambda x: x.get('display_order', 99)):
            otype = outcome.get('outcome_type', '')
            desc = outcome.get('description', '')
            trigger = outcome.get('trigger_condition', {})
            min_score = trigger.get('min_score', 0)
            outcome_options.append(f"- {otype}: {desc} (score minimo: {min_score}%)")
        outcomes_text = "\n".join(outcome_options)
    else:
        outcomes_text = """- sale_closed: Venda fechada (score >= 80%)
- meeting_scheduled: Reuniao agendada (score >= 70%)
- proposal_requested: Proposta solicitada (score >= 60%)
- needs_follow_up: Precisa acompanhamento (score >= 50%)
- rejected: Rejeitado (score < 50%)"""

    return f"""Analise a transcricao de uma sessao de treinamento e avalie o desempenho do participante.

═══════════════════════════════════════════════════════════════
CONTEXTO DO CENARIO:
═══════════════════════════════════════════════════════════════
{context}

═══════════════════════════════════════════════════════════════
CRITERIOS DE AVALIACAO:
═══════════════════════════════════════════════════════════════
{criteria_text}

═══════════════════════════════════════════════════════════════
POSSIVEIS OUTCOMES DA SESSAO:
═══════════════════════════════════════════════════════════════
{outcomes_text}

═══════════════════════════════════════════════════════════════
TRANSCRICAO DA CONVERSA:
═══════════════════════════════════════════════════════════════
{transcript}

═══════════════════════════════════════════════════════════════
INSTRUCOES:
═══════════════════════════════════════════════════════════════
Retorne APENAS um JSON valido (sem markdown, sem comentarios) com esta estrutura:

{{
  "criteria_results": [
    {{
      "criteria_id": "crit_1",
      "passed": true,
      "observation": "Explicacao breve citando trechos quando relevante"
    }}
  ],
  "summary": "Resumo geral do desempenho em 2-3 frases",
  "score": 75,
  "outcome": "sale_closed",
  "outcome_reasoning": "Breve explicacao de por que este outcome foi determinado"
}}

REGRAS:
- Avalie cada criterio individualmente
- Seja especifico nas observacoes, citando trechos da conversa
- O score deve ser calculado como: (criterios atendidos / total) * 100
- Arredonde o score para um numero inteiro
- Se um criterio nao foi abordado na conversa, considere como nao atendido
- Seja justo mas exigente na avaliacao
- DETERMINE o outcome baseado no score e na qualidade do tratamento de objecoes
- Se o avatar encerrou com uma frase de fechamento/rejeicao, considere isso na determinacao"""
