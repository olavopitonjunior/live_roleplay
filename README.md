# Agent Roleplay

Plataforma de treinamento com IA onde usuarios praticam vendas e negociacao atraves de conversas em tempo real com um avatar de IA.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (PWA)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Agente**: Python + LiveKit Agents + Gemini Live API + ElevenLabs TTS + Hedra
- **Feedback**: Claude API

## Estrutura do Projeto

```
agent-roleplay/
├── frontend/           # Aplicacao React PWA
├── agent/              # Agente Python (LiveKit)
├── supabase/           # Migrations e Edge Functions
├── spec.md             # Especificacao tecnica
└── prd.md              # Documento de requisitos
```

## Configuracao

### 1. Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o schema do banco:
   - Acesse o SQL Editor no dashboard
   - Execute o conteudo de `supabase/migrations/001_initial_schema.sql`
3. Configure os secrets das Edge Functions:
   ```
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   ANTHROPIC_API_KEY=...
   ```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Configure o `.env`:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_LIVEKIT_URL=wss://seu-projeto.livekit.cloud
```

### 3. Agente Python

```bash
cd agent
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt
cp .env.example .env
```

Configure o `.env`:
```
LIVEKIT_URL=wss://seu-projeto.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
GOOGLE_API_KEY=...
HEDRA_API_KEY=...
HEDRA_AVATAR_ID=...
ELEVEN_API_KEY=...          # Opcional: habilita half-cascade (ElevenLabs TTS)
ELEVEN_VOICE_ID=...         # Opcional: voice ID do ElevenLabs
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=...
```

### 4. Google AI (Gemini)

1. Acesse [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Crie uma nova API Key
3. Copie a chave para usar no `.env` do agente

### 5. LiveKit Cloud

1. Crie uma conta no [LiveKit Cloud](https://cloud.livekit.io)
2. Crie um novo projeto
3. Copie as credenciais (API Key e Secret)

### 6. Hedra (Avatar)

1. Crie uma conta no [Hedra](https://www.hedra.com)
2. Obtenha sua API Key
3. Escolha um Avatar ID (Character-3)

## Rodando o Projeto

### Desenvolvimento

**Frontend:**
```bash
cd frontend
npm run dev
```

**Agente:**
```bash
cd agent
python main.py dev
```

### Producao

**Frontend:**
```bash
cd frontend
npm run build
# Deploy da pasta dist/ para Vercel/Cloudflare
```

**Agente:**
```bash
cd agent
python main.py start
# Ou deploy para LiveKit Cloud
```

## Codigos de Acesso de Teste

| Codigo | Role | Descricao |
|--------|------|-----------|
| ADMIN001 | admin | Acesso total, pode criar cenarios |
| USER001 | user | Usuario padrao de teste |
| USER002 | user | Usuario padrao de teste |
| TEST123 | user | Usuario padrao de teste |

## Cenarios de Teste

O banco ja vem com 3 cenarios pre-configurados:

1. **Venda de Seguro de Vida** - Negociacao com empresario
2. **Negociacao de Contrato B2B** - Fechamento com diretor de compras
3. **Retencao de Cliente Insatisfeito** - Recuperacao de cliente

## APIs Utilizadas

| Servico | Proposito |
|---------|-----------|
| LiveKit Cloud | Comunicacao WebRTC em tempo real |
| Gemini Live API | Conversacao em tempo real (STT + LLM) |
| ElevenLabs | TTS de baixa latencia - half-cascade (~75ms TTFB) |
| Hedra | Avatar visual com lip-sync (Character-3) |
| Claude | Analise e geracao de feedback |

## Fluxo do Usuario

1. Acessa a plataforma e insere codigo de acesso
2. Escolhe um cenario de treinamento
3. Inicia sessao de voz com avatar (max 3 min)
4. Recebe feedback com criterios avaliados e pontuacao
5. Acessa historico de sessoes anteriores

## Deploy das Edge Functions

```bash
# Instale o Supabase CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto
supabase link --project-ref seu-project-ref

# Deploy das functions
supabase functions deploy create-livekit-token
supabase functions deploy generate-feedback
```

## Licenca

Projeto privado - Todos os direitos reservados.
