# Agent Roleplay - PRD (Product Requirements Document)

## 1. Visão Geral

Agent Roleplay é uma plataforma de treinamento onde usuários praticam conversas com avatares de IA em cenários pré-configurados. O avatar assume o papel de cliente ou oponente, reagindo em tempo real por voz. Ao final de cada sessão, o usuário recebe feedback baseado em critérios definidos no cenário.

O MVP tem como objetivo validar três hipóteses:
- O avatar funciona de forma fluida em sessões completas
- O avatar mantém coerência com o contexto configurado
- O feedback gerado é relevante para o que aconteceu na sessão

## 2. Usuários

Para o MVP, dois perfis de uso:

**Administrador**
- Configura cenários (contexto, perfil do avatar, objeções, critérios de avaliação)
- Acessa o sistema via código de acesso
- Testa sessões e valida funcionamento

**Usuário de teste**
- Recebe código de acesso para entrar
- Escolhe um cenário disponível
- Realiza sessão de treino com o avatar
- Visualiza feedback ao final
- Acessa histórico de feedbacks anteriores

## 3. Estrutura do Cenário

Cada cenário é composto por:

**Contexto**
Descrição da situação que define o pano de fundo da conversa. Ex: "Negociação para venda de seguro de vida para cliente de alta renda."

**Perfil do Avatar**
Características do personagem que o avatar interpreta. Ex: "Empresário questionador, tem filhos, preocupado com o futuro deles."

**Objeções**
Lista de resistências que o avatar pode apresentar durante a conversa. Ex: "Preço alto", "Dúvidas sobre saúde", "Desconfiança sobre risco do produto."

**Critérios de Avaliação**
Checklist que define o que será analisado no feedback. Ex:
- Identificou a preocupação com os filhos?
- Respondeu a objeção de preço?
- Mencionou benefício de proteção familiar?

## 4. Fluxo do Usuário

**Acesso**
1. Usuário acessa a plataforma (web ou mobile)
2. Insere código de acesso
3. Visualiza lista de cenários disponíveis

**Sessão**
1. Seleciona um cenário
2. Visualiza breve descrição do contexto
3. Inicia sessão
4. Conversa por voz com o avatar em tempo real
5. Encerra sessão quando quiser (ou ao atingir limite de 3 minutos)

**Feedback**
1. Aguarda processamento da avaliação
2. Visualiza feedback com pontuação por critério
3. Pode iniciar nova sessão ou acessar histórico

**Histórico**
1. Acessa lista de sessões anteriores
2. Visualiza feedback de cada sessão

## 5. Funcionalidades do MVP

**Autenticação**
- Entrada via código de acesso simples
- Sem cadastro ou senha

**Gestão de Cenários (Admin)**
- Interface para criar cenário
- Campos: contexto, perfil do avatar, objeções, critérios de avaliação
- Editar e excluir cenários existentes
- Limite inicial: 3 cenários

**Sessão de Treino**
- Avatar estilizado visível na tela
- Conversa por voz em tempo real
- Duração máxima: 3 minutos
- Botão para encerrar sessão a qualquer momento
- Indicador visual de que o avatar está ouvindo/falando

**Feedback Pós-Sessão**
- Transcrição da conversa processada automaticamente
- Avaliação baseada nos critérios configurados
- Resultado exibido como checklist (atendeu / não atendeu)
- Resumo geral da performance

**Histórico**
- Lista de sessões realizadas pelo usuário
- Acesso ao feedback de cada sessão
- Ordenado por data (mais recente primeiro)

## 6. Requisitos Técnicos

**Avatar Conversacional**
- Solução all-in-one (Tavus, Simli ou HeyGen Streaming)
- Latência aceitável para conversa fluida (alvo: < 2 segundos)
- Lip-sync com áudio gerado

**Plataforma**
- Web responsivo
- Mobile (PWA ou app nativo - a definir)
- Desenvolvimento via Claude Code

**Integrações**
- API do provider de avatar para streaming
- LLM para processar contexto e gerar respostas do avatar
- LLM para analisar transcrição e gerar feedback

**Dados**
- Armazenamento de cenários configurados
- Armazenamento de sessões (transcrição, feedback, data)
- Vínculo sessão-usuário via código de acesso

## 7. Critérios de Sucesso do MVP

**Avatar funciona**
- Sessão completa sem travamentos ou quedas
- Latência de resposta percebida como aceitável
- Lip-sync coerente com áudio

**Mantém contexto**
- Avatar não foge do personagem configurado
- Respostas coerentes com objeções definidas
- Não quebra imersão com respostas genéricas ou desconexas

**Feedback relevante**
- Checklist reflete o que realmente aconteceu na conversa
- Avaliação faz sentido para quem participou da sessão
- Critérios são aplicados corretamente

## 8. Fora do Escopo (MVP)

- Cadastro de usuários e autenticação completa
- Múltiplos idiomas
- Personalização visual do avatar
- Relatórios agregados e analytics
- Integração com plataformas externas (LMS, CRM)
- Gamificação (pontos, rankings, conquistas)
- Avatar como "treinador" (papel invertido)
- Gravação em vídeo da sessão
- Modelo de monetização
