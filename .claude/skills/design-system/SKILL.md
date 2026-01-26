# Skill: Design Minimalista Sofisticado

Este skill orienta a criação de interfaces com identidade visual forte, evitando padrões genéricos de ferramentas de vibe coding.

## Princípios Inegociáveis

### Espaço como elemento de design
- Usar padding e margin generosos
- Nunca preencher cada pixel disponível
- Deixar o conteúdo respirar
- Preferir uma tela "vazia" a uma tela "cheia"

### Paleta restrita e intencional
- Máximo 2 cores de destaque por projeto
- Uma cor primária usada com parcimônia
- Neutros sofisticados (não cinzas puros)
- Fundos com personalidade: bege, off-white, cinza quente, não branco puro (#fff)

### Tipografia como protagonista
- Hierarquia via tamanho e peso, não via cor
- Usar variações de uma mesma família
- Títulos com presença, corpo com legibilidade
- Evitar mais de 2 famílias tipográficas

### Bordas e separadores
- Bordas sutis ou inexistentes
- Separar com espaço, não com linhas
- Quando usar linhas: finas, cor sutil (opacity baixa)
- Border-radius: consistente e discreto (4px-8px), nunca 12px+ em tudo

## Lista Negra — Nunca Usar

### Componentes proibidos no estado default
- Cards com sombra + border-radius uniforme
- Ícones dentro de círculos coloridos
- Avatares com iniciais em círculos coloridos
- Badges coloridas (verde/vermelho/amarelo)
- Estrelas amarelas de rating
- Barras de progresso coloridas
- Seções de "números impressionantes" com ícones

### Padrões visuais proibidos
- Gradientes previsíveis (azul→azul claro, verde→verde claro)
- Paleta "alegre" sem identidade (verde/laranja/rosa juntos)
- Header com gradiente azul "tech startup"
- Footer escuro padrão com colunas de links
- Sombras sutis em absolutamente tudo
- Gamificação visual óbvia (XP, badges, níveis) sem refinamento

### Comportamentos proibidos
- Aplicar o mesmo border-radius em todos os elementos
- Usar cores saturadas demais em botões
- Empilhar cards com espaçamento mecânico uniforme
- Colocar ícone decorativo em cada item de lista

## Customizações Shadcn Obrigatórias

### Card
- Remover shadow default
- Usar border sutil (border-opacity-50 ou menos)
- Ou: remover border e usar apenas background diferenciado
- Padding interno generoso (p-6 mínimo, p-8 preferível)

### Button
- Criar variantes com cores do projeto, não usar primary/secondary padrão
- Versão outline com border fina
- Hover states sutis (opacity, não mudança drástica de cor)
- Evitar botões muito saturados

### Input
- Border sutil ou apenas border-bottom
- Focus state elegante (não ring azul padrão)
- Placeholder com boa legibilidade

### Badge
- Se precisar usar, tom sobre tom (não cores contrastantes)
- Ou: apenas texto com peso diferente, sem background

### Avatar
- Preferir imagens reais ou ilustrações
- Se usar fallback: cor neutra, não colorida
- Considerar formas alternativas (rounded-lg em vez de full)

### Separator
- Usar com moderação extrema
- Preferir espaço a linhas
- Quando usar: opacity muito baixa

## Movimento e Microinterações

### Quando usar movimento
- Transições de entrada de elementos (fade + translate sutil)
- Hover states em elementos interativos
- Feedback de ações (click, submit)
- Elementos decorativos de fundo (como blobs do Uniswap)

### Como implementar
- Duração: 150-300ms para interações, 500-800ms para entradas
- Easing: ease-out para entradas, ease-in-out para hovers
- Movimento sutil: 4-8px de translate, 0.95-1.05 de scale
- Opacidade: transições de 0 para 1, não aparecer abruptamente

### Elementos vivos sugeridos
- Gradientes animados sutis no fundo
- Formas geométricas flutuantes (movimento lento, orgânico)
- Cursor effects em áreas específicas
- Parallax sutil em scroll

### Framer Motion patterns
- initial={{ opacity: 0, y: 10 }}
- animate={{ opacity: 1, y: 0 }}
- transition={{ duration: 0.3, ease: "easeOut" }}
- whileHover={{ scale: 1.02 }}

## Checklist Antes de Entregar

Antes de finalizar qualquer interface, verificar:

1. Existe espaço suficiente entre os elementos?
2. A paleta tem no máximo 2 cores de destaque?
3. O fundo é algo além de branco puro?
4. A hierarquia funciona só com tipografia (sem depender de cor)?
5. Algum componente está no estado default do shadcn sem customização?
6. Existe algum item da lista negra presente?
7. Os border-radius estão consistentes e discretos?
8. Há pelo menos uma microinteração ou elemento de movimento?
9. A interface parece "de template" ou tem identidade?
10. Eu usaria isso no meu próprio produto?

## Processo de Criação

1. Antes de criar qualquer componente, definir a paleta (1 primária, 1 secundária, neutros)
2. Definir o tom do fundo (nunca começar com branco)
3. Estabelecer a escala tipográfica
4. Criar componentes base customizados antes de compor telas
5. Adicionar movimento como camada final, não como decoração inicial

## Referências de Qualidade

Interfaces que exemplificam este padrão:
- Claude Console (Anthropic) — minimalismo funcional, bege sofisticado
- Incident.io — laranja como destaque único, tipografia forte
- Uniswap — movimento orgânico, paleta restrita, espaço generoso
- Linear — densidade bem resolvida, hierarquia clara
- Vercel — preto e branco com propósito, tipografia como design
