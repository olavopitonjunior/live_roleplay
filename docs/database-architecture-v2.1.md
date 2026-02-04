# Projeto de Arquitetura de Banco de Dados
## Live Roleplay - Plataforma de Treinamento de Vendas com IA

**Data:** Fevereiro 2026
**Versão:** 2.1 (Com Decisões CEO/CTO)
**Preparado para:** CTO e CEO

---

## Sumário Executivo

Este documento apresenta a proposta de evolução da arquitetura de banco de dados da plataforma Live Roleplay, visando suportar **escala empresarial**, **múltiplas organizações** e **personalização avançada**.

### Situação Atual
- Sistema funcional com **12 tabelas** organizadas em 5 categorias
- Autenticação via códigos de acesso (sem identidade real)
- Avaliação avançada com rubricas 1-4, evidências e objeções já implementada
- Perfis adaptativos de dificuldade e aprendizado funcionando
- Sem separação de dados entre empresas (single-tenant)

### Proposta
- Arquitetura **multi-tenant** com isolamento completo por organização
- Sistema de **usuários reais** integrado ao Supabase Auth
- **Dois fluxos de autenticação**: código de acesso (trial) + login real (enterprise)
- **Billing integrado** com fonte canônica de uso
- **Auditoria e compliance** com políticas de retenção configuráveis

### Decisões Aprovadas (CEO/CTO) ✅

| Decisão | Escolha | Implicação |
|---------|---------|------------|
| Código de acesso | **Trial only** | Códigos são temporários, upgrade obrigatório para uso contínuo |
| SSO Enterprise | **Posterior** | Foco inicial em email/senha, SSO em fase futura |
| Retenção padrão | **90 dias** | Política uniforme, simplifica compliance |
| Modelo de billing | **Usage-based** | Cobrança por consumo real (sessões + tokens) |

---

## 1. Diagnóstico da Estrutura Atual

### 1.1 Tabelas Existentes (12)

| Categoria | Tabela | Função | Migration |
|-----------|--------|--------|-----------|
| **Acesso** | `access_codes` | Códigos simples de login | 001 |
| **Conteúdo** | `scenarios` | Cenários de treinamento | 001 |
| | `criterion_rubrics` | Rubricas 1-4 por critério | 012 |
| | `scenario_objections` | Objeções com keywords | 012 |
| | `scenario_outcomes` | Resultados possíveis | 014 |
| **Sessões** | `sessions` | Sessões de roleplay | 001 |
| | `feedbacks` | Avaliações por IA | 001, 012 |
| | `session_evidences` | Trechos do transcript | 012 |
| | `session_objection_status` | Status das objeções | 012 |
| **Perfil** | `user_difficulty_profiles` | Nível adaptativo | 015 |
| | `user_learning_profiles` | Evolução cross-session | 016 |
| **Métricas** | `api_metrics` | Custos de APIs | 004, 017 |

### 1.2 O Que Já Funciona Bem

- Avaliação rubric-based com 4 níveis e pesos
- Evidências linkadas ao transcript por índice de caractere
- Detecção de objeções com keywords
- Dificuldade adaptativa (promoção/rebaixamento automático)
- Perfil de aprendizado com análise de padrões
- Rastreamento de custos por API

### 1.3 Gaps Identificados

| Problema | Impacto | Risco |
|----------|---------|-------|
| Sem `org_id` em tabelas críticas | Vazamento de dados via joins | **CRÍTICO** |
| Auth por código sem identidade | Impossível rastrear usuário real | **ALTO** |
| RLS incompatível com `anon` key | Bloqueia MVP se ativado | **CRÍTICO** |
| Billing sem fonte canônica | Dupla contagem de uso | **MÉDIO** |
| Sem políticas de retenção | Risco LGPD/GDPR | **MÉDIO** |

---

## 2. Nova Arquitetura Proposta

### 2.1 Princípios de Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRINCÍPIOS FUNDAMENTAIS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ISOLAMENTO TOTAL                                                        │
│     org_id em TODAS as tabelas que contêm dados sensíveis                  │
│     RLS baseado em org_id, não em derivação via joins                      │
│                                                                             │
│  2. DOIS FLUXOS DE AUTH                                                     │
│     • Código de acesso: via Edge Function com service_role                 │
│     • Login real: via Supabase Auth com JWT e RLS                          │
│                                                                             │
│  3. SEPARAÇÃO DE IDENTIDADE                                                 │
│     • user_profiles.id ≠ auth.users.id                                     │
│     • access_codes permanece como entidade própria                          │
│     • Vínculo opcional: user_profiles.auth_user_id                         │
│                                                                             │
│  4. FONTE CANÔNICA DE DADOS                                                 │
│     • Volume: sessions (count)                                              │
│     • Custo: api_metrics (tokens/minutos)                                  │
│     • Agregação: usage_records (cron idempotente)                          │
│                                                                             │
│  5. COMPATIBILIDADE COM MVP                                                 │
│     • Transcrição mantém texto único (evidências usam índices)             │
│     • Código de acesso continua funcionando                                 │
│     • Migração sem quebra de funcionalidade                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura em Camadas

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                        CAMADA ORGANIZACIONAL                               ║
║  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 ║
║  │ ORGANIZAÇÃO  │───>│    TIMES     │    │   USUÁRIOS   │                 ║
║  │              │    │              │    │              │                 ║
║  │ • Nome       │    │ • Nome       │    │ • Email      │                 ║
║  │ • Logo       │    │ • Gerente    │    │ • auth_id    │                 ║
║  │ • Plano      │    │              │    │ • access_code│                 ║
║  └──────────────┘    └──────┬───────┘    └──────────────┘                 ║
║                             │                    │                         ║
║                      ┌──────▼────────────────────▼──────┐                 ║
║                      │      TEAM_MEMBERSHIPS (N:N)      │                 ║
║                      │  user_id, team_id, role          │                 ║
║                      └──────────────────────────────────┘                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                          CAMADA DE CONTEÚDO                                ║
║  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 ║
║  │  CENÁRIOS    │    │   RUBRICAS   │    │  OBJEÇÕES    │                 ║
║  │  (org_id)    │───>│  (org_id)    │    │  (org_id)    │                 ║
║  │              │    │              │    │              │                 ║
║  │ + versions   │    │ • Níveis 1-4 │    │ • Keywords   │                 ║
║  └──────────────┘    └──────────────┘    └──────────────┘                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                          CAMADA DE SESSÕES                                 ║
║  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 ║
║  │   SESSÕES    │───>│  FEEDBACKS   │───>│  EVIDÊNCIAS  │                 ║
║  │  (org_id)    │    │  (org_id)    │    │  (org_id)    │                 ║
║  │              │    │              │    │              │                 ║
║  │ • transcript │    │ • Score 1-4  │    │ • índices    │                 ║
║  │   (texto)    │    │ • Resumo     │    │ • trechos    │                 ║
║  └──────────────┘    └──────────────┘    └──────────────┘                 ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                       CAMADA DE BILLING/COMPLIANCE                         ║
║  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 ║
║  │ API_METRICS  │───>│USAGE_RECORDS │    │  RETENÇÃO    │                 ║
║  │  (fonte)     │    │ (agregado)   │    │  (políticas) │                 ║
║  │              │    │              │    │              │                 ║
║  │ • Tokens     │    │ • Mensal     │    │ • Por org    │                 ║
║  │ • Custos     │    │ • Por org    │    │ • LGPD       │                 ║
║  └──────────────┘    └──────────────┘    └──────────────┘                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## 3. Fluxos de Autenticação

### 3.1 Visão Geral dos Dois Fluxos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              FLUXO 1: CÓDIGO DE ACESSO (Trial Only - Temporário)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuário              Frontend              Edge Function        Banco      │
│     │                    │                       │                  │       │
│     ├─ Código ──────────>│                       │                  │       │
│     │                    ├─ POST /validate ─────>│                  │       │
│     │                    │   (anon key)          │                  │       │
│     │                    │                       ├─ SELECT ────────>│       │
│     │                    │                       │  access_codes    │       │
│     │                    │                       │  (service_role)  │       │
│     │                    │                       │<─────────────────┤       │
│     │                    │                       │                  │       │
│     │                    │                       │  Valida:         │       │
│     │                    │                       │  • org_id        │       │
│     │                    │                       │  • max_uses      │       │
│     │                    │                       │  • expires_at    │       │
│     │                    │                       │                  │       │
│     │                    │<─ { access_code, ─────┤                  │       │
│     │                    │     org_id,           │                  │       │
│     │                    │     permissions }     │                  │       │
│     │<─ Acesso ──────────┤                       │                  │       │
│     │   limitado         │                       │                  │       │
│                                                                             │
│  ⚠️  RLS NÃO é usado - dados filtrados pela Edge Function                  │
│  ⚠️  USO EXCLUSIVO: trial (14 dias), demo, eventos                          │
│  ⚠️  Upgrade obrigatório para uso contínuo (criar conta real)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO 2: LOGIN REAL (Enterprise)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Usuário              Frontend              Supabase Auth        Banco      │
│     │                    │                       │                  │       │
│     ├─ Email/Senha ─────>│                       │                  │       │
│     │                    │                       │                  │       │
│     │                    ├─ signIn() ───────────>│                  │       │
│     │                    │                       │                  │       │
│     │                    │<─ JWT Token ──────────┤                  │       │
│     │                    │   (com auth.uid)      │                  │       │
│     │                    │                       │                  │       │
│     │                    ├─ Query com JWT ───────────────────────>│       │
│     │                    │                       │                  │       │
│     │                    │                       │  RLS verifica:   │       │
│     │                    │                       │  auth.uid() →    │       │
│     │                    │                       │  user_profiles → │       │
│     │                    │                       │  org_id          │       │
│     │                    │                       │                  │       │
│     │                    │<─ Dados filtrados ────────────────────┤       │
│     │<─ Acesso ──────────┤   por RLS             │                  │       │
│     │   completo         │                       │                  │       │
│                                                                             │
│  ✅ RLS ativo - isolamento automático por organização                       │
│  ✅ Ideal para: clientes pagantes, equipes, gestores                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Modelo de Identidade (Corrigido)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SEPARAÇÃO DE IDENTIDADES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │  auth.users     │         │  user_profiles  │                           │
│  │  (Supabase)     │         │  (Nossa tabela) │                           │
│  ├─────────────────┤         ├─────────────────┤                           │
│  │ id: 'xyz-789'   │◄────────│ auth_user_id    │  (nullable)               │
│  │ email           │         │                 │                           │
│  │ created_at      │         │ id: 'abc-123'   │  (UUID próprio)           │
│  └─────────────────┘         │ org_id          │                           │
│                              │ email           │                           │
│                              │ role            │                           │
│  ┌─────────────────┐         │                 │                           │
│  │  access_codes   │◄────────│ access_code_id  │  (nullable)               │
│  │  (Mantida)      │         │                 │                           │
│  ├─────────────────┤         └─────────────────┘                           │
│  │ id: 'def-456'   │                                                       │
│  │ code: 'TRIAL01' │                                                       │
│  │ org_id          │                                                       │
│  │ max_uses        │                                                       │
│  │ expires_at      │                                                       │
│  └─────────────────┘                                                       │
│                                                                             │
│  Cenários:                                                                  │
│  ─────────                                                                  │
│  1. Trial via código:     access_code_id preenchido, auth_user_id = NULL   │
│  2. Login real:           auth_user_id preenchido, access_code_id = NULL   │
│  3. Upgrade de trial:     ambos preenchidos (código vinculado à conta)     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Novas Tabelas Propostas

### 4.1 Camada Organizacional

| Tabela | Campos-chave | Propósito |
|--------|--------------|-----------|
| `organizations` | id, name, slug, billing_tier, settings | Empresa cliente (tenant) |
| `teams` | id, org_id, name, manager_id | Grupos dentro da org |
| `user_profiles` | id, org_id, auth_user_id, access_code_id, email, role | Perfil de usuário |
| `team_memberships` | user_id, team_id, role, joined_at | Vínculo N:N usuário-time |
| `user_invites` | org_id, email, token, expires_at | Convites pendentes |

### 4.2 Camada de Billing (Usage-Based)

| Tabela | Campos-chave | Propósito |
|--------|--------------|-----------|
| `billing_tiers` | name, base_fee_cents, discount_percent, limits (JSONB) | Tiers de acesso |
| `org_billing` | org_id, tier_id, status, billing_email | Config de billing por org |
| `usage_records` | org_id, period (DATE), sessions_count, tokens_used, total_cost_cents | Agregação mensal |
| `usage_events` | org_id, session_id, event_type, quantity, unit_cost_cents | Eventos granulares |

### 4.3 Camada de Compliance

| Tabela | Campos-chave | Propósito |
|--------|--------------|-----------|
| `audit_logs` | org_id, user_id, action, resource_type, resource_id | Rastreamento |
| `data_retention_policies` | org_id, resource_type, retention_days, action | Regras LGPD |
| `data_deletion_requests` | org_id, requested_by, status, completed_at | Solicitações |

### 4.4 Modificações em Tabelas Existentes

| Tabela | Adições | Motivo |
|--------|---------|--------|
| `scenarios` | +org_id, +created_by, +visibility | Isolar por empresa |
| `sessions` | +org_id, +user_profile_id | Rastrear por usuário real |
| `feedbacks` | **+org_id** | RLS direto (não derivar) |
| `session_evidences` | **+org_id** | RLS direto |
| `session_objection_status` | **+org_id** | RLS direto |
| `criterion_rubrics` | **+org_id** | RLS direto |
| `scenario_objections` | **+org_id** | RLS direto |
| `scenario_outcomes` | **+org_id** | RLS direto |
| `api_metrics` | +org_id, +user_profile_id | Billing por empresa |
| `user_difficulty_profiles` | +org_id, +user_profile_id | Substituir access_code_id |
| `user_learning_profiles` | +org_id, +user_profile_id | Substituir access_code_id |
| `access_codes` | +org_id, +max_uses, +expires_at | Controle de uso |

---

## 5. Hierarquia de Permissões

### 5.1 Roles por Organização

```
                    ┌─────────────────┐
                    │     OWNER       │
                    │   (Dono/CEO)    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  ADMIN   │   │  ADMIN   │   │  ADMIN   │
        │ (TI/RH)  │   │          │   │          │
        └────┬─────┘   └──────────┘   └──────────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
┌────────┐ ┌────────┐ ┌────────┐
│MANAGER │ │MANAGER │ │TRAINER │
│(Gerente│ │        │ │        │
│ Time)  │ │        │ │        │
└───┬────┘ └────────┘ └───┬────┘
    │                     │
    ▼                     ▼
┌────────┐           ┌────────┐
│TRAINEE │           │TRAINEE │
│        │           │        │
└────────┘           └────────┘
```

### 5.2 Matriz de Permissões

| Cargo | Cenários | Sessões | Usuários | Analytics | Billing |
|-------|----------|---------|----------|-----------|---------|
| **Owner** | CRUD | Ver todos | CRUD | Organização | CRUD |
| **Admin** | CRUD | Ver todos | CRUD | Organização | Ver |
| **Manager** | Ver | Ver time | Ver time | Time | - |
| **Trainer** | Ver | Próprias + orientandos | - | Próprio | - |
| **Trainee** | Ver | Próprias | - | Próprio | - |

---

## 6. Fonte Canônica de Billing (Usage-Based)

### 6.1 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BILLING USAGE-BASED - FLUXO DE DADOS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVENTOS                   AGREGAÇÃO               FATURAMENTO              │
│  (tempo real)              (cron diário)           (mensal)                 │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │    sessions     │────┐                                                   │
│  │  • started_at   │    │                                                   │
│  │  • ended_at     │    │     ┌─────────────────┐                          │
│  │  • duration_s   │    │     │  usage_events   │     ┌─────────────────┐  │
│  └─────────────────┘    ├────>│  (granular)     │────>│  usage_records  │  │
│                         │     │                 │     │  (agregado mês) │  │
│  ┌─────────────────┐    │     │ • session_fee   │     │                 │  │
│  │   api_metrics   │────┤     │ • extra_time    │     │ • total_sessions│  │
│  │  • tokens       │    │     │ • tokens_gemini │     │ • total_tokens  │  │
│  │  • cost_cents   │    │     │ • tokens_claude │     │ • total_avatar  │  │
│  │  • api_name     │    │     │ • avatar_time   │     │ • gross_cost    │  │
│  └─────────────────┘    │     └─────────────────┘     │ • discount      │  │
│                         │              │              │ • net_cost      │  │
│  ┌─────────────────┐    │              │              └─────────────────┘  │
│  │  simli_usage    │────┘              │                      │            │
│  │  • minutes      │                   ▼                      │            │
│  │  • face_id      │          ┌─────────────────┐             │            │
│  └─────────────────┘          │  Cron Job       │             ▼            │
│                               │  (idempotente)  │     ┌─────────────────┐  │
│                               │  diário 03:00   │     │  Fatura Mensal  │  │
│                               └─────────────────┘     │  (PDF + Email)  │  │
│                                                       └─────────────────┘  │
│                                                                             │
│  Fórmula: net_cost = (sessions × R$2,50) + (extra_min × R$0,80)            │
│                    + (tokens/1K × R$0,05) + (avatar_min × R$0,30)          │
│                    - (tier_discount%)                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Segurança e Isolamento (RLS)

### 7.1 Tabelas com org_id Direto

```
TODAS as tabelas abaixo terão org_id NOT NULL para RLS simples:

├── organizations (raiz)
├── teams
├── user_profiles
├── team_memberships
├── access_codes
│
├── scenarios
├── criterion_rubrics      ← ADICIONADO org_id
├── scenario_objections    ← ADICIONADO org_id
├── scenario_outcomes      ← ADICIONADO org_id
│
├── sessions
├── feedbacks              ← ADICIONADO org_id
├── session_evidences      ← ADICIONADO org_id
├── session_objection_status ← ADICIONADO org_id
│
├── user_difficulty_profiles
├── user_learning_profiles
├── api_metrics
├── usage_records
└── audit_logs
```

### 7.2 Políticas RLS (Fluxo Auth Real)

```sql
-- Helper: obter org_id do usuário logado
CREATE FUNCTION auth.user_org_id() RETURNS UUID AS $$
  SELECT org_id FROM user_profiles WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Exemplo: sessions
CREATE POLICY "users_own_org_sessions" ON sessions
  FOR SELECT TO authenticated
  USING (org_id = auth.user_org_id());

-- Exemplo: feedbacks (agora com org_id direto)
CREATE POLICY "users_own_org_feedbacks" ON feedbacks
  FOR SELECT TO authenticated
  USING (org_id = auth.user_org_id());
```

### 7.3 Isolamento para Código de Acesso

```
Código de acesso usa Edge Function com service_role:

1. Recebe código
2. Valida em access_codes (service_role bypassa RLS)
3. Obtém org_id do código
4. Faz queries com WHERE org_id = :org_id explícito
5. Retorna dados filtrados

⚠️  RLS NÃO protege este fluxo - a Edge Function é responsável
```

---

## 8. Modelo de Billing (Usage-Based)

### 8.1 Estrutura de Preços

| Componente | Unidade | Preço Unitário | Observação |
|------------|---------|----------------|------------|
| **Sessão** | por sessão | R$ 2,50 | Inclui até 3 min de roleplay |
| **Tempo extra** | por minuto | R$ 0,80 | Acima de 3 min por sessão |
| **Tokens AI** | por 1K tokens | R$ 0,05 | Gemini + Claude combinados |
| **Avatar HD** | por minuto | R$ 0,30 | Simli lip-sync |

### 8.2 Tiers de Acesso

| Tier | Taxa Base/mês | Desconto Usage | Features |
|------|---------------|----------------|----------|
| **Trial** | Grátis | - | 14 dias, max 50 sessões, código de acesso |
| **Starter** | R$ 99 | 0% | Até 10 usuários, cenários próprios |
| **Professional** | R$ 299 | 10% | Até 50 usuários, +Analytics |
| **Enterprise** | R$ 999 | 20% | Ilimitado, +API, +SLA *(SSO: fase futura)* |

### 8.3 Exemplo de Fatura Mensal

```
┌────────────────────────────────────────────────────────────┐
│  FATURA - Empresa XYZ (Professional)                       │
├────────────────────────────────────────────────────────────┤
│  Taxa base Professional                    R$    299,00    │
│                                                            │
│  Uso:                                                      │
│  ├─ 450 sessões × R$ 2,50              =   R$  1.125,00   │
│  ├─ 120 min extra × R$ 0,80            =   R$     96,00   │
│  ├─ 2.8M tokens × R$ 0,05/1K           =   R$    140,00   │
│  └─ 380 min avatar × R$ 0,30           =   R$    114,00   │
│                                           ───────────────  │
│  Subtotal uso                              R$  1.475,00    │
│  Desconto Professional (10%)              -R$    147,50    │
│                                           ───────────────  │
│  TOTAL                                     R$  1.626,50    │
└────────────────────────────────────────────────────────────┘
```

### 8.4 Controle de Limites (JSONB)

```json
{
  "tier": "professional",
  "base_fee_cents": 29900,
  "discount_percent": 10,
  "max_users": 50,
  "max_teams": 10,
  "features": {
    "custom_avatars": true,
    "analytics_export": true,
    "api_access": false,
    "sso": false
  },
  "alerts": {
    "usage_threshold_percent": 80,
    "notify_emails": ["admin@empresa.com"]
  }
}
```

---

## 9. Compliance e Retenção

### 9.1 Política de Retenção Padrão (90 dias)

| Recurso | Todos os Tiers | Observação |
|---------|----------------|------------|
| Transcrições | **90 dias** | Texto completo das sessões |
| Feedbacks | **90 dias** | Scores e comentários da IA |
| Evidências | **90 dias** | Trechos destacados |
| Métricas | **90 dias** | Tokens, custos, duração |
| Audit logs | **90 dias** | Ações de usuários |

> **Decisão CEO/CTO:** Política uniforme de 90 dias simplifica compliance LGPD/GDPR e reduz custos de storage. Dados agregados (usage_records) são mantidos indefinidamente para billing.

### 9.2 Tabela data_retention_policies

```sql
CREATE TABLE data_retention_policies (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  resource_type VARCHAR(50) NOT NULL, -- 'transcripts', 'feedbacks', 'metrics'
  retention_days INTEGER NOT NULL,
  action VARCHAR(20) DEFAULT 'delete', -- 'delete', 'archive', 'anonymize'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, resource_type)
);

-- Cron job para aplicar retenção
-- DELETE FROM sessions WHERE ended_at < NOW() - retention_days
-- E org_id IN (SELECT org_id FROM data_retention_policies WHERE ...)
```

---

## 10. Jornadas de Usuário

### 10.1 Jornada Trial (Código de Acesso)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. ACESSO RÁPIDO                                                           │
│  • Recebe código do comercial/evento                                        │
│  • Insere código na tela inicial                                            │
│  • Acesso imediato (sem cadastro)                                           │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                                                            │
┌───────────────────────────────────────────────────────────────────────────▼─┐
│  2. EXPERIÊNCIA LIMITADA                                                    │
│  • Vê cenários da organização do código                                     │
│  • Faz até X sessões (limite do código)                                     │
│  • Recebe feedback completo                                                 │
│  • Não tem histórico persistente                                            │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                                                            │
┌───────────────────────────────────────────────────────────────────────────▼─┐
│  3. UPGRADE                                                                 │
│  • Recebe convite para criar conta                                          │
│  • Cadastra email/senha                                                     │
│  • Sessões do trial são vinculadas à conta                                  │
│  • Acesso completo liberado                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Jornada Enterprise (Login Real)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. ONBOARDING                                                              │
│  • Admin da empresa recebe convite                                          │
│  • Cria conta com email/senha                                               │
│  • Configura organização (nome, logo)                                       │
│  • Cria times e convida usuários                                            │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                                                            │
┌───────────────────────────────────────────────────────────────────────────▼─┐
│  2. USO DIÁRIO                                                              │
│  • Login com email/senha                                                    │
│  • Acesso baseado em role                                                   │
│  • Histórico completo de sessões                                            │
│  • Analytics pessoais e de time                                             │
└───────────────────────────────────────────────────────────────────────────┬─┘
                                                                            │
┌───────────────────────────────────────────────────────────────────────────▼─┐
│  3. GESTÃO                                                                  │
│  • Manager acompanha time                                                   │
│  • Admin gerencia cenários e usuários                                       │
│  • Owner monitora billing e compliance                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Plano de Implementação

### Fase 1: Fundação (2 semanas)
- [ ] Criar tabelas: organizations, teams, user_profiles, team_memberships
- [ ] Adicionar org_id em TODAS as tabelas existentes (nullable)
- [ ] Criar índices em background
- [ ] Edge Function para validação de código de acesso

### Fase 2: Migração de Dados (1 semana)
- [ ] Criar organização padrão
- [ ] Criar user_profiles a partir de access_codes
- [ ] Vincular sessions, feedbacks, etc. à organização
- [ ] Preencher org_id em todas as tabelas

### Fase 3: Permissões (1 semana)
- [ ] Ativar RLS gradualmente (tabelas menos críticas primeiro)
- [ ] Implementar fluxo de auth real (Supabase Auth)
- [ ] Testar isolamento entre organizações

### Fase 4: Billing e Compliance (2 semanas)
- [ ] Criar tabelas de billing e retenção
- [ ] Implementar cron de agregação
- [ ] Dashboard de uso

### Fase 5: Go-Live (1 semana)
- [ ] Migrar clientes existentes
- [ ] Validação final
- [ ] Monitoramento intensivo

---

## 12. Plano Detalhado de Migração

### 12.1 Estratégia: Zero-Downtime com Dual-Write

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MIGRAÇÃO ZERO-DOWNTIME                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FASE 1: PREPARAÇÃO (sistema funcionando normalmente)                       │
│  ─────────────────────────────────────────────────────                      │
│  • Criar novas tabelas (vazias)                                             │
│  • Adicionar colunas org_id (nullable)                                      │
│  • Criar índices CONCURRENTLY                                               │
│                                                                             │
│  FASE 2: DUAL-WRITE (sistema funcionando normalmente)                       │
│  ──────────────────────────────────────────────────────                     │
│  • Atualizar Edge Functions para preencher org_id                           │
│  • Novos registros já têm org_id                                            │
│  • Registros antigos ainda sem org_id                                       │
│                                                                             │
│  FASE 3: BACKFILL (sistema funcionando normalmente)                         │
│  ─────────────────────────────────────────────────────                      │
│  • Job em lotes preenche org_id nos registros antigos                       │
│  • Validação de integridade                                                 │
│                                                                             │
│  FASE 4: CUTOVER (breve janela de manutenção ~30min)                        │
│  ────────────────────────────────────────────────────                       │
│  • ALTER COLUMN org_id SET NOT NULL                                         │
│  • Ativar RLS                                                               │
│  • Atualizar frontend para usar novos fluxos                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Scripts de Migração

**Migration 020: Criar tabelas organizacionais**
```sql
-- Executa sem downtime
CREATE TABLE IF NOT EXISTS organizations (...);
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  auth_user_id UUID UNIQUE,  -- Supabase Auth (nullable)
  access_code_id UUID,       -- Compatibilidade (nullable)
  email VARCHAR(255) NOT NULL,
  role VARCHAR(30) DEFAULT 'trainee',
  ...
);
```

**Migration 021: Adicionar org_id em tabelas existentes**
```sql
-- Executa sem downtime (colunas nullable)
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE session_evidences ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE session_objection_status ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE criterion_rubrics ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE scenario_objections ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE scenario_outcomes ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE api_metrics ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE user_difficulty_profiles ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS org_id UUID;

-- Índices em background
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_org ON sessions(org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedbacks_org ON feedbacks(org_id);
-- etc.
```

**Migration 022: Backfill de dados**
```sql
-- Criar org padrão
INSERT INTO organizations (id, name, slug, billing_tier)
VALUES ('00000000-0000-0000-0000-000000000001', 'Principal', 'principal', 'professional');

-- Backfill em lotes (executar como job)
DO $$
DECLARE batch_size INT := 1000;
BEGIN
  LOOP
    UPDATE sessions SET org_id = '00000000-0000-0000-0000-000000000001'
    WHERE id IN (SELECT id FROM sessions WHERE org_id IS NULL LIMIT batch_size);
    EXIT WHEN NOT FOUND;
    PERFORM pg_sleep(0.1);
  END LOOP;

  -- Repetir para feedbacks, evidences, etc.
END $$;
```

**Migration 023: Finalização (requer breve downtime)**
```sql
-- Validar que não há NULLs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sessions WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'Ainda existem sessions sem org_id';
  END IF;
END $$;

-- Ativar constraints
ALTER TABLE sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE feedbacks ALTER COLUMN org_id SET NOT NULL;
-- etc.

-- Ativar RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON sessions FOR ALL USING (org_id = auth.user_org_id());
-- etc.
```

### 12.3 Plano de Rollback

| Nível | Problema | Ação | Tempo |
|-------|----------|------|-------|
| 1 | RLS bloqueando queries | `DISABLE ROW LEVEL SECURITY` | 30s |
| 2 | Dados inconsistentes | `UPDATE ... SET org_id = NULL` | 5min |
| 3 | Falha grave | Restore de backup | 30min |

---

## 13. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| RLS bloqueia código de acesso | **CRÍTICO** | Dois fluxos explícitos, Edge Function com service_role |
| Vazamento via joins | **CRÍTICO** | org_id em TODAS as tabelas, não derivar |
| UUID collision auth vs user | **ALTO** | Separar identidades, auth_user_id é FK |
| Dupla contagem billing | **MÉDIO** | Fonte canônica única (usage_records) |
| Downtime na migração | **MÉDIO** | Zero-downtime com dual-write |
| Quebra de evidências | **MÉDIO** | Manter transcript como texto único |

---

## 14. Próximos Passos

1. ~~**Decisões bloqueantes** pelo CEO/CTO~~ ✅ **APROVADO**
2. ~~**Aprovação** deste documento~~ ✅ **APROVADO**
3. **Sprint 1:** Fase 1 + 2 (tabelas e migração) ← **PRÓXIMO**
4. **Sprint 2:** Fase 3 (permissões e RLS)
5. **Sprint 3:** Fase 4 + 5 (billing usage-based e go-live)

### Decisões Aplicadas:
- Código de acesso: **Trial only** (14 dias, upgrade obrigatório)
- SSO: **Deferido** para fase futura
- Retenção: **90 dias** uniforme para todos os tiers
- Billing: **Usage-based** (por sessão + tokens + avatar)

---

## Anexo A: Diagrama Completo

```
organizations (1) ─────────────────────────────────────────────────────────┐
      │                                                                    │
      ├──(1:N)──> teams                                                    │
      │              │                                                     │
      │              └──(N:N via team_memberships)──> user_profiles ───────┤
      │                                                    │               │
      │                                                    ├──(1:1)──> user_difficulty_profiles
      │                                                    │               │
      │                                                    ├──(1:1)──> user_learning_profiles
      │                                                    │               │
      │                                                    └──(1:N)──> sessions ──────────┤
      │                                                                   │               │
      │                                                                   ├──(1:1)──> feedbacks
      │                                                                   │               │
      │                                                                   ├──(1:N)──> session_evidences
      │                                                                   │               │
      │                                                                   ├──(1:N)──> session_objection_status
      │                                                                   │               │
      │                                                                   └──(1:1)──> api_metrics
      │                                                                                   │
      ├──(1:N)──> scenarios ──────────────────────────────────────────────────────────────┤
      │              │                                                                    │
      │              ├──(1:N)──> criterion_rubrics                                        │
      │              ├──(1:N)──> scenario_objections                                      │
      │              └──(1:N)──> scenario_outcomes                                        │
      │                                                                                   │
      ├──(1:N)──> access_codes                                                            │
      ├──(1:N)──> org_subscriptions ──(N:1)──> billing_plans                             │
      ├──(1:N)──> usage_records                                                           │
      ├──(1:N)──> audit_logs                                                              │
      └──(1:N)──> data_retention_policies                                                 │
                                                                                          │
Todas as tabelas têm org_id ──────────────────────────────────────────────────────────────┘
```

---

**Documento preparado por:** Equipe de Engenharia
**Revisão:** v2.1 (Decisões CEO/CTO incorporadas)
**Status:** ✅ APROVADO PARA IMPLEMENTAÇÃO
**Confidencial - Uso Interno**
