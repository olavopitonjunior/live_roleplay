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


def _build_role_section(scenario: dict[str, Any]) -> str:
    """
    Build the PAPEL section from structured fields or fallback to generic.
    """
    character_name = scenario.get('character_name')
    character_role = scenario.get('character_role')

    if character_name and character_role:
        role_description = f"Voce e {character_name}, {character_role}."
    elif character_name:
        role_description = f"Voce e {character_name}, o CLIENTE/PROSPECT neste cenario."
    elif character_role:
        role_description = f"Voce e o {character_role} neste cenario."
    else:
        role_description = "Voce e o CLIENTE/PROSPECT neste cenario. Voce NAO e o vendedor ou suporte."

    return f"""--- PAPEL (CRITICO - LEIA COM ATENCAO) ---
{role_description}
O USUARIO (pessoa treinando) e quem esta vendendo/oferecendo suporte para VOCE.

IMPORTANTE: MANTENHA seu papel do INICIO AO FIM da conversa.
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
- Perguntar sobre necessidades ou problemas do usuario (ELE e quem pergunta isso para VOCE)"""


def _build_personality_section(scenario: dict[str, Any]) -> str:
    """
    Build the PERSONALIDADE section from structured fields or fallback to avatar_profile.
    """
    personality = scenario.get('personality')
    communication_style = scenario.get('communication_style')
    typical_phrases = scenario.get('typical_phrases')
    initial_emotion = scenario.get('initial_emotion')

    # If any structured personality field is present, build from them
    if personality or communication_style or typical_phrases or initial_emotion:
        parts = []
        if personality:
            parts.append(f"Personalidade: {personality}")
        if communication_style:
            if isinstance(communication_style, dict):
                formality = communication_style.get('formality', '')
                verbosity = communication_style.get('verbosity', '')
                patterns = communication_style.get('patterns', [])
                style_parts = []
                if formality:
                    style_parts.append(f"formalidade {formality}")
                if verbosity:
                    style_parts.append(f"verbosidade {verbosity}")
                if style_parts:
                    parts.append(f"Estilo de comunicacao: {', '.join(style_parts)}")
                if patterns:
                    parts.append(f"Padroes: {', '.join(patterns)}")
            else:
                parts.append(f"Estilo de comunicacao: {communication_style}")
        if initial_emotion:
            parts.append(f"Emocao inicial: {initial_emotion}")
        if typical_phrases and isinstance(typical_phrases, list) and len(typical_phrases) > 0:
            phrases_str = ", ".join([f'"{p}"' for p in typical_phrases])
            parts.append(f"Frases tipicas: {phrases_str}")

        # Emotional reactivity triggers
        emotional_reactivity = scenario.get('emotional_reactivity')
        if emotional_reactivity and isinstance(emotional_reactivity, dict):
            triggers = emotional_reactivity.get('triggers', [])
            if triggers:
                parts.append("\nReatividade emocional:")
                for t in triggers:
                    event = t.get('event', '')
                    reaction = t.get('reaction', '')
                    if event and reaction:
                        parts.append(f"  - Se {event}: {reaction}")

        # Also include avatar_profile as supplementary if present
        avatar_profile = scenario.get('avatar_profile', '')
        if avatar_profile:
            parts.append(f"\n{avatar_profile}")

        return f"""--- PERSONALIDADE ---
{chr(10).join(parts)}"""
    else:
        # Fallback: use avatar_profile as before
        avatar_profile = scenario.get('avatar_profile', 'Personagem neutro e profissional.')
        return f"""--- SEU PERFIL ---
{avatar_profile}"""


def _build_context_section(scenario: dict[str, Any]) -> str:
    """
    Build the CONTEXTO section from structured fields + existing context.
    Includes session_type-specific behavior instructions.
    """
    context = scenario.get('context', 'Cenario de treinamento geral.')
    session_type = scenario.get('session_type')
    character_name = scenario.get('character_name')
    market_context = scenario.get('market_context')
    backstory = scenario.get('backstory')
    user_objective = scenario.get('user_objective')

    parts = []

    # Guard: reinforce avatar identity
    if character_name:
        parts.append(f"LEMBRETE: Voce e {character_name}. O texto abaixo descreve SUA situacao.\n")

    parts.append(context)

    # Session type specific behavior instructions
    if session_type == 'cold_call':
        parts.append("""
COMPORTAMENTO DE COLD CALL:
- Voce NAO estava esperando esta ligacao
- Demonstre surpresa/desconfianca ao atender ("Quem fala?", "Como conseguiu meu numero?")
- Nao de abertura facil — o vendedor precisa conquistar sua atencao
- Pode ameacar desligar se nao houver valor claro nos primeiros 30 segundos
- Seu tom inicial e de interrupcao — voce estava fazendo outra coisa""")
    elif session_type in ('interview', 'entrevista'):
        parts.append("""
COMPORTAMENTO DE ENTREVISTA:
- Voce esta sendo entrevistado/avaliado
- Responda as perguntas do entrevistador naturalmente
- Apresente suas objecoes e duvidas como um candidato real faria
- Demonstre suas insegurancas e motivacoes conforme seu perfil""")
    elif session_type in ('negotiation', 'negociacao'):
        parts.append("""
COMPORTAMENTO DE NEGOCIACAO:
- Voce esta em uma negociacao ativa
- Defenda sua posicao mas esteja aberto a bons argumentos
- Use dados e comparacoes para justificar suas exigencias
- Nao ceda facilmente — exija contrapartidas""")
    elif session_type in ('retention', 'retencao'):
        parts.append("""
COMPORTAMENTO DE RETENCAO:
- Voce e um cliente insatisfeito querendo cancelar/sair
- Comece firme na decisao de cancelar
- So mude de ideia se o atendente demonstrar empatia real e oferecer solucao concreta
- Desabafe sobre a experiencia ruim antes de ouvir propostas""")

    if market_context:
        parts.append(f"\nContexto de mercado: {market_context}")
    if backstory:
        parts.append(f"\nHistorico do personagem: {backstory}")
    if user_objective:
        parts.append(f"\nObjetivo do usuario (para seu conhecimento — reaja de acordo): {user_objective}")

    return f"""--- CONTEXTO ---
{"".join(parts)}"""


def _build_instructions_section(
    scenario: dict[str, Any],
    outcomes: list[dict[str, Any]] | None = None
) -> str:
    """
    Build the INSTRUCOES section: objections, hidden objective, knowledge limits, opening line, outcomes.
    """
    # Objections
    objections = scenario.get('objections', [])
    objections_text = "\n".join([
        f"- {obj.get('description', '')}"
        for obj in objections
    ]) if objections else "- Nenhuma objecao especifica configurada"

    # Hidden objective
    hidden_objective = scenario.get('hidden_objective')
    hidden_text = ""
    if hidden_objective:
        hidden_text = f"\nObjetivo oculto (NAO revele ao usuario): {hidden_objective}\n"

    # Knowledge limits
    knowledge_limits = scenario.get('knowledge_limits')
    knowledge_text = ""
    if knowledge_limits:
        knowledge_text = f"\nLimites de conhecimento (o que voce NAO sabe): {knowledge_limits}\n"

    # Opening line
    opening_line = scenario.get('opening_line')
    opening_text = ""
    if opening_line:
        opening_text = f"\nFrase de abertura: \"{opening_line}\"\n"

    # Outcomes
    outcomes_text = format_outcomes_for_prompt(outcomes or [])

    return f"""--- OBJECOES ---
{objections_text}
{hidden_text}{knowledge_text}{opening_text}
--- POSSIVEIS FINAIS ---
Conduza para um destes finais baseado na qualidade das respostas:

{outcomes_text}

Conduza NATURALMENTE para o final apropriado."""


def _build_flow_section(
    scenario: dict[str, Any],
    difficulty_level: int
) -> str:
    """
    Build the FLUXO section from structured fields or fallback to difficulty instructions.
    """
    phase_flow = scenario.get('phase_flow')
    difficulty_escalation = scenario.get('difficulty_escalation')
    emotional_reactivity = scenario.get('emotional_reactivity')
    success_condition = scenario.get('success_condition')
    end_condition = scenario.get('end_condition')

    has_structured_flow = any([
        phase_flow, difficulty_escalation, emotional_reactivity,
        success_condition, end_condition
    ])

    if has_structured_flow:
        parts = []

        # Always include difficulty level as baseline
        parts.append(f"NIVEL DE DIFICULDADE: {difficulty_level}/10")

        # Parse emotional_reactivity triggers (JSONB: {triggers: [{event, reaction, intensity}]})
        if emotional_reactivity and isinstance(emotional_reactivity, dict):
            triggers = emotional_reactivity.get('triggers', [])
            if triggers:
                parts.append("\nReatividade emocional:")
                for t in triggers:
                    event = t.get('event', '')
                    reaction = t.get('reaction', '')
                    if event and reaction:
                        parts.append(f"  - Se {event}: {reaction}")
        elif emotional_reactivity and isinstance(emotional_reactivity, str):
            parts.append(f"\nReatividade emocional: {emotional_reactivity}")

        # Parse phase_flow phases (JSONB: {phases: [{name, duration_pct, triggers}]} or list)
        phases = []
        if phase_flow:
            if isinstance(phase_flow, dict):
                phases = phase_flow.get('phases', [])
            elif isinstance(phase_flow, list):
                phases = phase_flow
        if phases:
            parts.append("\nFases da conversa:")
            for i, phase in enumerate(phases, 1):
                phase_name = phase.get('name', f'Fase {i}')
                behavior = phase.get('behavior', '')
                duration = phase.get('duration_pct') or phase.get('duration_seconds')
                phase_triggers = phase.get('triggers', [])
                line = f"  {i}. {phase_name}"
                if duration:
                    if isinstance(duration, (int, float)) and duration <= 100:
                        line += f" (~{duration}%)"
                    else:
                        line += f" (~{duration}s)"
                if behavior:
                    line += f": {behavior}"
                parts.append(line)
                if phase_triggers:
                    parts.append(f"     Transicao: {', '.join(str(t) for t in phase_triggers[:2])}")

        # Parse difficulty_escalation stages (JSONB: {stages: [{threshold, behavior_change}]})
        if difficulty_escalation and isinstance(difficulty_escalation, dict):
            stages = difficulty_escalation.get('stages', [])
            if stages:
                parts.append("\nEscalacao de dificuldade:")
                for stage in stages:
                    threshold = stage.get('threshold', '')
                    behavior_change = stage.get('behavior_change', '')
                    if threshold and behavior_change:
                        parts.append(f"  - Quando: {threshold} -> {behavior_change}")
            else:
                # Legacy format: single trigger/behavior
                trigger = difficulty_escalation.get('trigger', '')
                behavior = difficulty_escalation.get('behavior', '')
                if trigger or behavior:
                    parts.append("\nEscalacao de dificuldade:")
                    if trigger:
                        parts.append(f"  Gatilho: {trigger}")
                    if behavior:
                        parts.append(f"  Comportamento: {behavior}")

        if success_condition:
            parts.append(f"\nCondicao de sucesso: {success_condition}")

        if end_condition:
            parts.append(f"\nCondicao de encerramento: {end_condition}")

        flow_text = "\n".join(parts)

        return f"""--- FLUXO ---
{flow_text}

--- COMPORTAMENTO EMOCIONAL ---
Evolucao emocional (comece neutro, ajuste conforme a conversa):
- SATISFEITO: Tom leve, menor resistencia, tende a fechar/agendar ("Faz sentido...", "Entendo...")
- RECEPTIVO: Curioso, engajado, perguntas genuinas
- NEUTRO: Profissional, aguardando info
- HESITANTE: Cauteloso, duvidas, tende a pedir follow-up ("Nao sei...", "Preciso pensar...")
- FRUSTRADO: Impaciente, tende a rejeitar ("Ja entendi...", "Voce nao esta me ouvindo...")"""
    else:
        # Fallback: use difficulty instructions as before
        difficulty_text = format_difficulty_instructions(difficulty_level)

        return f"""--- DIFICULDADE ---
{difficulty_text}

--- COMPORTAMENTO EMOCIONAL ---
Evolucao emocional (comece neutro, ajuste conforme a conversa):
- SATISFEITO: Tom leve, menor resistencia, tende a fechar/agendar ("Faz sentido...", "Entendo...")
- RECEPTIVO: Curioso, engajado, perguntas genuinas
- NEUTRO: Profissional, aguardando info
- HESITANTE: Cauteloso, duvidas, tende a pedir follow-up ("Nao sei...", "Preciso pensar...")
- FRUSTRADO: Impaciente, tende a rejeitar ("Ja entendi...", "Voce nao esta me ouvindo...")"""


def _build_safety_section(scenario: dict[str, Any]) -> str:
    """
    Build the SEGURANCA section: role-inversion prevention rules (unchanged).
    """
    # Determine opening instruction based on structured field or session_type
    opening_line = scenario.get('opening_line')
    session_type = scenario.get('session_type')
    if opening_line:
        opening_instruction = f'Inicie com: "{opening_line}"'
    elif session_type == 'cold_call':
        opening_instruction = 'Inicie com: "Alo? Quem fala?"'
    elif session_type in ('interview', 'entrevista'):
        opening_instruction = 'Aguarde o entrevistador ou inicie com apresentacao breve.'
    elif session_type in ('negotiation', 'negociacao'):
        opening_instruction = 'Inicie retomando o contexto da negociacao.'
    else:
        opening_instruction = "Aguarde o usuario ou inicie com frase curta de abertura adequada ao contexto."

    return f"""--- REGRAS ---
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
{opening_instruction}"""


def build_agent_instructions(
    scenario: dict[str, Any],
    outcomes: list[dict[str, Any]] | None = None,
    difficulty_level: int = 3
) -> str:
    """
    Build dynamic instructions for the OpenAI Realtime agent
    based on the scenario configuration.

    Compiles from structured fields when available, with backward
    compatibility fallbacks to existing fields (context, avatar_profile,
    objections, etc.).

    Args:
        scenario: Dictionary containing scenario data from Supabase
        outcomes: Optional list of possible outcomes for this scenario
        difficulty_level: Difficulty level 1-10 (default 3)

    Returns:
        Formatted instruction string for the agent
    """
    role_section = _build_role_section(scenario)
    personality_section = _build_personality_section(scenario)
    context_section = _build_context_section(scenario)
    instructions_section = _build_instructions_section(scenario, outcomes)
    flow_section = _build_flow_section(scenario, difficulty_level)
    safety_section = _build_safety_section(scenario)

    return f"""Voce e um personagem em um cenario de treinamento de vendas e negociacao.
Mantenha-se SEMPRE no personagem. NUNCA quebre o personagem.

{role_section}

{personality_section}

{context_section}

{instructions_section}

{flow_section}

{safety_section}"""


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
