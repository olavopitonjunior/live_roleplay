# PRD 06: Enterprise Features

## Metadata

| Campo | Valor |
|-------|-------|
| **Versao** | 1.0 |
| **Status** | Planejado |
| **Fase** | 4B - Enterprise |
| **Prioridade** | P3 (Futura) |
| **Dependencias** | PRD-05 (Analytics Dashboard) |
| **Estimativa** | 8-12 semanas |
| **Ultima Atualizacao** | 2026-01-22 |

---

## 1. Contexto

### Problema
O Live Roleplay atualmente opera como **single-tenant** sem suporte a multiplas empresas, equipes, ou customizacao. Isso impede a venda para clientes enterprise que exigem isolamento de dados, SSO, e personalizacao.

### Oportunidade
Enterprise e o segmento com **maior LTV** e **menor churn**. Uma empresa com 50 vendedores representa R$5.000+/mes recorrente. Sem features enterprise, perdemos esse mercado para concorrentes.

### Hipotese
> "Empresas com 20+ vendedores pagarao 3x mais por features de customizacao, SSO, e multi-equipe."

---

## 2. Objetivos (OKRs)

### Objetivo
Tornar o Live Roleplay pronto para venda enterprise com multi-tenancy, customizacao, e integracoes.

### Key Results
| KR | Meta | Prazo |
|----|------|-------|
| KR1 | 3 clientes enterprise onboardados | Mes 3 |
| KR2 | Deal size medio enterprise > R$3.000/mes | Mes 3 |
| KR3 | Churn enterprise < 3% | Mes 6 |
| KR4 | NPS enterprise > 60 | Mes 6 |

---

## 3. User Stories

### US-01: Gerenciar Empresa
**Como** admin de empresa
**Quero** gerenciar configuracoes da minha organizacao
**Para** personalizar a experiencia para minha equipe

**Criterios de Aceite**:
- [ ] Dashboard de admin da empresa
- [ ] Configurar nome, logo, cores
- [ ] Gerenciar usuarios e permissoes
- [ ] Ver uso e limites do plano

### US-02: Gerenciar Equipes
**Como** admin de empresa
**Quero** criar e gerenciar equipes
**Para** organizar vendedores por regiao/produto

**Criterios de Aceite**:
- [ ] Criar/editar/excluir equipes
- [ ] Atribuir usuarios a equipes
- [ ] Definir gestor por equipe
- [ ] Analytics por equipe

### US-03: Criar Cenarios Customizados
**Como** admin de empresa
**Quero** criar cenarios especificos para minha empresa
**Para** treinar situacoes reais do nosso negocio

**Criterios de Aceite**:
- [ ] Interface de criacao de cenarios
- [ ] Definir contexto, objecoes, criterios
- [ ] Preview antes de publicar
- [ ] Cenarios visiveis apenas para minha empresa

### US-04: Login com SSO
**Como** usuario de empresa
**Quero** fazer login com minha conta corporativa
**Para** nao precisar de mais uma senha

**Criterios de Aceite**:
- [ ] Suporte a SAML 2.0
- [ ] Suporte a OAuth (Google Workspace, Microsoft)
- [ ] Provisioning automatico de usuarios
- [ ] Logout centralizado

### US-05: Integrar com CRM
**Como** admin de empresa
**Quero** integrar Live Roleplay com nosso CRM
**Para** correlacionar treino com resultados de venda

**Criterios de Aceite**:
- [ ] Conectar Salesforce/HubSpot/Pipedrive
- [ ] Sync de usuarios/vendedores
- [ ] Exportar metricas de treino
- [ ] Sugerir treinos baseado em pipeline

### US-06: Usar API
**Como** desenvolvedor de empresa
**Quero** acessar dados via API
**Para** integrar com sistemas internos

**Criterios de Aceite**:
- [ ] API REST documentada
- [ ] Autenticacao via API key
- [ ] Endpoints para sessoes, feedbacks, metricas
- [ ] Rate limiting por plano

---

## 4. Requisitos Funcionais

### RF-01: Multi-tenancy

```sql
-- Nova tabela de organizacoes
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color VARCHAR(7),  -- Hex color
    settings JSONB DEFAULT '{}',
    plan VARCHAR(50) DEFAULT 'starter',
    plan_limits JSONB DEFAULT '{"users": 10, "sessions_month": 100}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nova tabela de equipes
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    manager_id UUID REFERENCES access_codes(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar organization_id em access_codes
ALTER TABLE access_codes ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE access_codes ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE access_codes ADD COLUMN org_role VARCHAR(50) DEFAULT 'member';
-- org_roles: owner, admin, manager, member

-- Adicionar organization_id em scenarios
ALTER TABLE scenarios ADD COLUMN organization_id UUID REFERENCES organizations(id);
-- NULL = cenario publico (da plataforma)
-- UUID = cenario privado da empresa

-- RLS policies atualizadas
CREATE POLICY "Users see own org scenarios"
ON scenarios FOR SELECT
USING (
    organization_id IS NULL OR
    organization_id = (
        SELECT organization_id FROM access_codes
        WHERE id = auth.uid()
    )
);
```

### RF-02: Scenario Builder

```typescript
interface ScenarioBuilder {
  // Dados basicos
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;  // minutos

  // Contexto
  context: {
    situation: string;       // Descricao da situacao
    avatarProfile: string;   // Perfil do cliente
    avatarName: string;
    avatarRole: string;      // Ex: "Diretor de TI"
    avatarCompany: string;
  };

  // Objecoes
  objections: Array<{
    id: string;
    description: string;
    keywords: string[];           // Para deteccao
    responseKeywords: string[];   // Para verificar tratamento
    difficulty: 'easy' | 'medium' | 'hard';
  }>;

  // Criterios de avaliacao
  evaluationCriteria: Array<{
    id: string;
    description: string;
    weight: number;  // 1-5
    required: boolean;
  }>;

  // Metodologia (opcional)
  methodology?: {
    type: 'SPIN' | 'MEDDIC' | 'BANT' | 'custom';
    customSteps?: MethodologyStep[];
  };

  // Compliance (opcional)
  compliance?: ComplianceRule[];

  // Coaching rules (opcional)
  coachingRules?: CoachingRule[];
}
```

### RF-03: SSO Integration

```typescript
// Supabase Auth com SAML
// Configuracao via dashboard ou API

interface SSOConfig {
  provider: 'saml' | 'google' | 'microsoft' | 'okta';
  organizationId: string;

  // SAML
  saml?: {
    entityId: string;
    ssoUrl: string;
    certificate: string;
    attributeMapping: {
      email: string;
      firstName: string;
      lastName: string;
      groups?: string;
    };
  };

  // OAuth
  oauth?: {
    clientId: string;
    clientSecret: string;
    domain?: string;  // Para Google Workspace
  };

  // Provisioning
  autoProvision: boolean;
  defaultTeamId?: string;
  defaultRole: 'member' | 'manager';
}

// Fluxo de login SSO
// 1. Usuario acessa /login/sso/:orgSlug
// 2. Redireciona para IdP
// 3. IdP retorna com assertion
// 4. Verifica/cria usuario no Supabase
// 5. Associa a organization
// 6. Redireciona para app
```

### RF-04: CRM Integration

```typescript
interface CRMIntegration {
  provider: 'salesforce' | 'hubspot' | 'pipedrive';
  organizationId: string;

  // Credenciais (criptografadas)
  credentials: {
    accessToken: string;
    refreshToken: string;
    instanceUrl?: string;  // Salesforce
  };

  // Sync settings
  syncSettings: {
    syncUsers: boolean;
    userMapping: {
      crmField: string;      // Ex: "Email"
      roleplayField: string; // Ex: "email"
    }[];

    syncDeals: boolean;      // Para sugerir treinos
    dealStageMapping?: {
      crmStage: string;
      suggestedScenario: string;
    }[];

    exportMetrics: boolean;
    metricsCustomObject?: string;  // Nome do objeto custom no CRM
  };

  // Webhooks
  webhooks: {
    onSessionComplete?: string;  // URL para notificar CRM
    onBadgeEarned?: string;
  };
}

// Edge Function: crm-sync
// Roda periodicamente para sincronizar dados
```

### RF-05: API Publica

```typescript
// API RESTful
// Base URL: https://api.liveroleplay.com/v1

// Autenticacao
// Header: Authorization: Bearer <api_key>

// Endpoints

// Usuarios
// GET    /users                    - Lista usuarios da org
// GET    /users/:id                - Detalhes do usuario
// POST   /users                    - Criar usuario
// PATCH  /users/:id                - Atualizar usuario
// DELETE /users/:id                - Desativar usuario

// Sessoes
// GET    /sessions                 - Lista sessoes
// GET    /sessions/:id             - Detalhes da sessao
// GET    /sessions/:id/transcript  - Transcript completo
// GET    /sessions/:id/metrics     - Metricas da sessao

// Feedbacks
// GET    /feedbacks                - Lista feedbacks
// GET    /feedbacks/:id            - Detalhes do feedback

// Cenarios
// GET    /scenarios                - Lista cenarios
// POST   /scenarios                - Criar cenario
// PATCH  /scenarios/:id            - Atualizar cenario
// DELETE /scenarios/:id            - Arquivar cenario

// Analytics
// GET    /analytics/overview       - Metricas gerais
// GET    /analytics/users          - Performance por usuario
// GET    /analytics/trends         - Tendencias

// Rate Limits por plano
// Starter: 100 req/hora
// Pro: 1000 req/hora
// Enterprise: 10000 req/hora
```

### RF-06: White Label

```typescript
interface WhiteLabelConfig {
  organizationId: string;

  branding: {
    logo: string;           // URL
    logoSmall: string;      // Favicon
    primaryColor: string;   // Hex
    secondaryColor: string;
    fontFamily?: string;
  };

  customDomain?: {
    domain: string;         // Ex: treino.minhaempresa.com
    sslCertificate: string;
    verified: boolean;
  };

  emailTemplates?: {
    welcomeEmail?: string;
    sessionReminder?: string;
    weeklyReport?: string;
  };

  features: {
    hideRoleplayBranding: boolean;
    customTerms?: string;    // URL para termos customizados
    customPrivacy?: string;  // URL para privacidade customizada
  };
}
```

---

## 5. Requisitos Nao-Funcionais

### RNF-01: Isolamento de Dados
- Dados de uma org nunca visiveis para outra
- RLS em todas as tabelas
- Audit log de acessos cross-org

### RNF-02: Compliance
- LGPD compliant
- Opcao de data residency (BR, US, EU)
- Export de dados do usuario (DSAR)
- Retencao de dados configuravel

### RNF-03: SLA Enterprise
- Uptime 99.9%
- Suporte prioritario (< 4h resposta)
- Ambiente de staging dedicado

### RNF-04: Seguranca
- SSO obrigatorio para enterprise
- MFA disponivel
- IP allowlist opcional
- Sessoes com timeout configuravel

---

## 6. Especificacao Tecnica

### 6.1 Arquitetura Multi-tenant

```
+------------------+
|    Frontend      |
|  (React App)     |
+--------+---------+
         |
         v
+--------+---------+     +------------------+
|   Supabase       |     |   External       |
|   (Multi-tenant) |     |   Services       |
|                  |     |                  |
| - RLS Policies   |<--->| - Salesforce     |
| - Organizations  |     | - HubSpot        |
| - Teams          |     | - Okta (SSO)     |
+------------------+     +------------------+
```

### 6.2 Scenario Builder UI

```typescript
// Componentes do builder

// ScenarioBasicInfo.tsx
// - Titulo, descricao, dificuldade

// AvatarProfileEditor.tsx
// - Nome, cargo, empresa, personalidade
// - Preview do avatar

// ObjectionManager.tsx
// - Lista de objecoes
// - Drag-and-drop para ordenar
// - Keywords para deteccao

// CriteriaManager.tsx
// - Lista de criterios
// - Peso de cada criterio
// - Required flag

// MethodologySelector.tsx
// - Escolher metodologia
// - Customizar steps

// ScenarioPreview.tsx
// - Simulacao do cenario
// - Testar antes de publicar
```

### 6.3 API Gateway

```typescript
// supabase/functions/api-gateway/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

// Rate limiting
const rateLimits = {
  starter: { requests: 100, window: 3600000 },    // 100/hora
  pro: { requests: 1000, window: 3600000 },       // 1000/hora
  enterprise: { requests: 10000, window: 3600000 } // 10000/hora
};

serve(async (req) => {
  // 1. Validar API key
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 2. Buscar organizacao pela API key
  const supabase = createClient(/*...*/);
  const { data: org } = await supabase
    .from('api_keys')
    .select('organization_id, organizations(plan)')
    .eq('key', apiKey)
    .single();

  if (!org) {
    return new Response('Invalid API key', { status: 401 });
  }

  // 3. Verificar rate limit
  const isWithinLimit = await checkRateLimit(apiKey, rateLimits[org.organizations.plan]);
  if (!isWithinLimit) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  // 4. Rotear para handler apropriado
  const url = new URL(req.url);
  const path = url.pathname.replace('/v1', '');

  // ... routing logic ...
});
```

---

## 7. UI/UX

### Wireframe: Admin Dashboard

```
+------------------------------------------------------------------+
|  ADMIN - MINHA EMPRESA                           [Config] [Sair]  |
+------------------------------------------------------------------+
|                                                                   |
|  +----------------+  +----------------+  +----------------+       |
|  | USUARIOS       |  | SESSOES/MES    |  | CENARIOS       |       |
|  |   45 / 50      |  |   342 / 500    |  |   12 custom    |       |
|  |   90% usado    |  |   68% usado    |  |   + 8 padrao   |       |
|  +----------------+  +----------------+  +----------------+       |
|                                                                   |
|  EQUIPES                                           [+ Nova Equipe]|
|  +--------------------------------------------------------------+ |
|  | Vendas SP        | 15 membros | Ana (gestor) | Score: 78%    | |
|  | Vendas RJ        | 12 membros | Bob (gestor) | Score: 72%    | |
|  | Inside Sales     | 18 membros | Carol (gestor)| Score: 81%   | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  CENARIOS CUSTOMIZADOS                          [+ Novo Cenario]  |
|  +--------------------------------------------------------------+ |
|  | Venda Enterprise        | Avancado | 45 sessoes | Ativo  [E] | |
|  | Renovacao de Contrato   | Medio    | 32 sessoes | Ativo  [E] | |
|  | Onboarding Cliente      | Basico   | 28 sessoes | Ativo  [E] | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  INTEGRACOES                                                      |
|  +--------------------------------------------------------------+ |
|  | [SF] Salesforce     | Conectado | Sync: 2h atras   [Config]  | |
|  | [G]  Google SSO     | Ativo     | 45 usuarios      [Config]  | |
|  | [API] API Access    | Ativo     | 1,234 req/hoje   [Keys]    | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### Wireframe: Scenario Builder

```
+------------------------------------------------------------------+
|  CRIAR CENARIO                                   [Cancelar] [Salvar]
+------------------------------------------------------------------+
|                                                                   |
|  INFORMACOES BASICAS                                              |
|  +--------------------------------------------------------------+ |
|  | Titulo: [Negociacao de Renovacao de Contrato              ]  | |
|  | Descricao: [Cliente existente considerando nao renovar... ]  | |
|  | Dificuldade: ( ) Basico  (x) Intermediario  ( ) Avancado     | |
|  | Duracao estimada: [3] minutos                                | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  PERFIL DO AVATAR (CLIENTE)                                       |
|  +--------------------------------------------------------------+ |
|  | Nome: [Roberto Silva      ]  Cargo: [Diretor de TI        ]  | |
|  | Empresa: [TechCorp        ]                                  | |
|  |                                                              | |
|  | Personalidade:                                               | |
|  | [x] Analitico  [ ] Expressivo  [x] Cético  [ ] Amigavel     | |
|  |                                                              | |
|  | Contexto:                                                    | |
|  | [Cliente ha 2 anos, satisfeito com produto mas orcamento  ]  | |
|  | [foi cortado. Recebeu proposta de concorrente 20% mais    ]  | |
|  | [barato. Quer entender se vale manter...                  ]  | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  OBJECOES                                        [+ Adicionar]    |
|  +--------------------------------------------------------------+ |
|  | 1. [O concorrente oferece 20% menos           ] [Dificil] [x]| |
|  |    Keywords: concorrente, preco, mais barato                 | |
|  | 2. [Orcamento foi cortado esse ano            ] [Medio]   [x]| |
|  |    Keywords: orcamento, corte, verba                         | |
|  | 3. [Nao estamos usando todas as features     ] [Facil]   [x]| |
|  |    Keywords: features, usando, utilizar                      | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  CRITERIOS DE AVALIACAO                         [+ Adicionar]     |
|  +--------------------------------------------------------------+ |
|  | [x] Identificou motivo real da hesitacao        Peso: [5]    | |
|  | [x] Tratou objecao de preco com valor           Peso: [5]    | |
|  | [x] Destacou features nao utilizadas            Peso: [3]    | |
|  | [ ] Ofereceu plano alternativo                  Peso: [2]    | |
|  | [x] Conseguiu compromisso para proxima etapa    Peso: [4]    | |
|  +--------------------------------------------------------------+ |
|                                                                   |
|  [Preview Cenario]                                                |
+------------------------------------------------------------------+
```

---

## 8. Metricas de Sucesso

| Metrica | Target | Como Medir |
|---------|--------|------------|
| Clientes enterprise | 10 | Contagem |
| ARR enterprise | R$200k | MRR * 12 |
| Cenarios custom criados | 50 | Contagem |
| Integrações ativas | 20 | Contagem |
| Churn enterprise | <3% | Cancelamentos |
| NPS enterprise | >60 | Survey |

---

## 9. Riscos e Mitigacoes

| Risco | Prob | Impacto | Mitigacao |
|-------|------|---------|-----------|
| Complexidade de multi-tenancy | Alta | Alto | Arquitetura desde o inicio, testes rigorosos |
| SSO bugs | Media | Alto | Testar com multiplos IdPs |
| Integracao CRM complexa | Alta | Medio | Comecear com 1 CRM (Salesforce) |
| Cenarios custom de baixa qualidade | Media | Medio | Templates, validacao, preview |

---

## 10. Criterios de Aceite (DoD)

- [ ] Multi-tenancy com RLS completo
- [ ] CRUD de organizacoes e equipes
- [ ] Scenario Builder funcional
- [ ] SSO com SAML e OAuth
- [ ] Integracao Salesforce basica
- [ ] API documentada (OpenAPI)
- [ ] White label basico (logo, cores)
- [ ] Admin dashboard
- [ ] Testes E2E para fluxos criticos
- [ ] Documentacao para clientes

---

## 11. Plano de Rollout

### Fase 1: Multi-tenancy (3 semanas)
- Schema de organizacoes e equipes
- RLS policies
- Admin dashboard basico

### Fase 2: Scenario Builder (3 semanas)
- Interface de criacao
- Preview de cenario
- Validacao e publicacao

### Fase 3: SSO (2 semanas)
- SAML integration
- Google Workspace
- Microsoft Entra

### Fase 4: Integracoes (3 semanas)
- Salesforce connector
- API publica
- Documentacao

### Fase 5: Polish (1 semana)
- White label
- Testes finais
- Onboarding de pilots

---

## 12. Apendice

### A. Comparativo de Planos

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Usuarios | 10 | 50 | Ilimitado |
| Sessoes/mes | 100 | 500 | Ilimitado |
| Cenarios custom | 3 | 10 | Ilimitado |
| Analytics | Basico | Completo | Completo |
| SSO | - | - | Sim |
| API | - | Sim | Sim |
| CRM Integration | - | - | Sim |
| White Label | - | - | Sim |
| Suporte | Email | Email + Chat | Dedicado |
| SLA | - | 99.5% | 99.9% |

### B. Integrações Planejadas

**Fase 1 (MVP Enterprise)**:
- Salesforce
- Google Workspace SSO
- API REST

**Fase 2**:
- HubSpot
- Microsoft Entra (Azure AD)
- Pipedrive

**Fase 3**:
- Okta
- OneLogin
- Slack notifications
- Teams notifications

### C. Referencias

- [Supabase Multi-tenancy Guide](https://supabase.com/docs/guides/auth/multi-tenancy)
- [SAML 2.0 Specification](https://docs.oasis-open.org/security/saml/v2.0/)
- [Salesforce API Documentation](https://developer.salesforce.com/docs/apis)
- [HubSpot API Documentation](https://developers.hubspot.com/docs/api)
