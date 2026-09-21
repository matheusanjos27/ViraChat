# ViraChat — Mapa do sistema (estado atual)

> Documento para remodelagem. Descreve **como o produto funciona hoje** (telas, dados, fluxos, infra), não o roadmap ideal.
>
> Data de referência: **20/set/2026** · Stack: Next.js (Docker) + **Supabase self-host (VPS)** + **Evolution/Baileys** + OpenAI · Meta Cloud API = **fora do produto** (legado residual no código)


---

## 1. O que é o produto

**ViraChat** é um CRM/atendimento multi-tenant com IA no WhatsApp.

- Cada **empresa (tenant)** tem seus leads, conversas, funil, catálogo e IA.
- O cliente final fala no **WhatsApp** (número conectado por **QR / Baileys**); a **IA** responde; humanos assumem quando necessário.
- Um **super admin da plataforma** cria empresas, define limites/mensalidade, acompanha saúde da VPS, uso de tokens e MRR.

**Não há signup público.** Entrada só por convite (super admin ou admin da empresa).

---

## 2. Produção (infra atual)

| Item | Valor |
|---|---|
| Domínio | **virachat.com.br** (KingHost DNS → VPS) |
| App | https://app.virachat.com.br (e www quando DNS propagar) |
| WhatsApp API (Evolution) | https://wa.virachat.com.br |
| Supabase API | https://api.virachat.com.br |
| Host | VPS (~70 GB SSD; Saúde mostra usados/livres) |
| App stack | Docker Compose prod: **Caddy + ViraChat + Evolution** |
| Dados | **Supabase self-host** na mesma VPS (Postgres + Auth; gateway **Envoy**, não Kong) |
| HTTPS | Caddy (Let’s Encrypt), UFW 80/443 |

**Paths úteis na VPS:**

- App: `/opt/ViraChat`
- Compose: `docker/docker-compose.prod.yml`
- Scripts: `docker/scripts/` (`setup-vps`, `bootstrap-supabase`, `migrate`, `backup`, `enable-https-virachat`)
- Disco no painel: container monta `/:/host:ro` → `statfs(/host)` em `/platform/health`

**Nota:** deploy típico **não é mais Vercel**; o app roda na VPS. Variáveis em `docker/.env` / `.env.prod`.

---

## 3. Arquitetura em uma frase

```
WhatsApp (Evolution/Baileys — QR)
    → Webhook /api/webhooks/evolution
    → grava contato/conversa/mensagem (Postgres/Supabase self-host)
    → dispara IA (OpenAI) em background
    → responde via Evolution sendText
    → atualiza CRM (atributos, deal/funil, notificações)
    → registra tokens em ai_usage_events
```

UI web: operadores veem inbox, leads, funil e configurações. Super admin vê `/platform/*`.

```
Internet → Caddy (:443)
            ├─ app/www → virachat:3000
            ├─ wa     → evolution-api:8080
            └─ api    → supabase-envoy:8000 → Auth/DB/Storage…
```

---

## 4. Papéis e acesso

| Papel | Onde | O que faz |
|---|---|---|
| **Platform admin** (super admin) | `/platform/*` | Tenants, mensalidade, convites, saúde VPS, uso IA, finanças |
| **admin** (empresa) | `/app/*` | Tudo do tenant: canais, IA, equipe, funil, etc. |
| **supervisor** | `/app/*` | Opera + pode convidar colaboradores |
| **agent** (atendente) | `/app/*` | Opera conversas/leads/funil (sem gerir equipe admin) |

- Usuário autenticado via **Supabase Auth** (self-host).
- Vínculo empresa: tabela `user_tenant_roles` (hoje o app pega o **primeiro** tenant do usuário).
- Convite: e-mail Supabase → `/auth/set-password` → define senha → entra só naquela empresa.

**Assentos (`tenants.max_members`):** padrão **2** (= empresa + 1 colaborador). Super admin altera.

**Billing (plataforma):** `tenants.monthly_fee_cents` + `billing_status` (`trial` | `active` | `past_due` | `canceled`).

---

## 5. Telas (rotas)

### Públicas / auth

| Rota | Função |
|---|---|
| `/` | Landing / redirect |
| `/login` | Login e-mail/senha |
| `/signup` | Existe, mas criação self-serve de empresa está **desabilitada** |
| `/auth/set-password` | Convidado define senha (hash do invite) |
| `/auth/callback` | Callback OAuth/invite Supabase |

### App da empresa (`/app`)

| Rota | Tela | O que faz |
|---|---|---|
| `/app` | Home | Redirect / entrada |
| `/app/conversations` | **Conversas** | Inbox WhatsApp ao vivo: lista, thread, assumir/devolver IA, filtro status + **canal** |
| `/app/leads` | **Leads** | Contatos + atributos + temperatura (hot/warm/cold) |
| `/app/deals` | **Funil** | Kanban de oportunidades por etapa |
| `/app/channels` | **Canais** | Conectar WhatsApp por **QR (Baileys/Evolution)**; N números/tenant; alerta de desconectados + **Reconectar** |
| `/app/settings` | Hub configurações | Cards para subpáginas |
| `/app/settings/company` | Empresa | Nome, about, telefone, site (IA usa na apresentação) |
| `/app/settings/ai` | Atendimento com IA | Liga/desliga IA, instruções, abas: campos, catálogo, playbook |
| `/app/settings/fields` | Campos do lead | CRUD atributos customizados |
| `/app/settings/services` | Catálogo | Serviços + faixas de preço |
| `/app/settings/playbook` | Playbook | Roteiro de conversa em texto |
| `/app/settings/pipeline` | Etapas do funil | CRUD stages |
| `/app/settings/team` | Equipe | Lista membros, convite nome+e-mail, limite de assentos |

**Sidebar:** Conversas, Leads, Funil, Atendimento com IA, Configurações + **sino** (handoff + **WhatsApp desconectado**).

### Plataforma (super admin) — layout full-width com shell próprio

| Rota | Função |
|---|---|
| `/platform` | Visão geral: cards Saúde, Clientes, MRR, tokens do mês |
| `/platform/health` | Saúde VPS: disco SSD (usados/total/livres), Postgres, app, Evolution, API Supabase |
| `/platform/tenants` | Lista/cria clientes; `max_members`, mensalidade, status billing |
| `/platform/usage` | Uso de IA (tokens por tenant / eventos) |
| `/platform/finance` | Finanças: MRR a partir de `monthly_fee_cents` dos tenants ativos |
| `/platform/invites` | Histórico / gestão de convites |

---

## 6. Modelo de dados (o que guardamos)

Tudo é **multi-tenant** (`tenant_id`) com RLS no Supabase.

### Identidade e tenancy

| Tabela | Campos principais | Uso |
|---|---|---|
| `tenants` | name, slug, about, website, phone, **max_members**, **monthly_fee_cents**, **billing_status** | Empresa + billing interno |
| `profiles` | full_name, email | Usuário (liga com `auth.users`) |
| `user_tenant_roles` | user_id, tenant_id, role | Quem pertence a qual empresa |
| `platform_admins` | user_id | Super admins |
| `tenant_invites` | email, role, accepted_at, invited_by | Histórico de convites |

### WhatsApp / canal

| Tabela | Campos principais | Uso |
|---|---|---|
| `providers` | id=`whatsapp` | Catálogo de provedores |
| `channels` | display_name, is_active, provider_id | Canal lógico |
| `whatsapp_accounts` | phone_number_id, waba_id, **access_token_encrypted**, onboard_source, display_phone… | Conta Evolution (`waba_id=evolution`, token `evolution:instanceName`) ou legado Meta |

Token fica **criptografado** com `TOKEN_ENCRYPTION_KEY`.

### Inbox

| Tabela | Campos principais | Uso |
|---|---|---|
| `contacts` | display_name, phone_e164, external_id, email, company_name, notes, **temperature** | Lead/contato |
| `conversations` | channel_id, contact_id, **status**, assigned_to, last_message_at, **waiting_human_at**, **handoff_busy_sent_at** | Thread |
| `messages` | direction, sender_type (contact/ai/agent/system), body, provider_message_id | Mensagens |
| `app_notifications` | type, title, body, conversation_id, read_at | Sino (`handoff`, **`channel_disconnected`**, etc.) |

**Status da conversa:**

- `ai_active` — IA responde
- `waiting_human` — pediu humano / handoff
- `human_active` — atendente assumiu
- `resolved` — encerrada

### CRM

| Tabela | Uso |
|---|---|
| `contact_attributes` | Definição dos campos (key, label, type, required, collect_via_ai) |
| `contact_attribute_values` | Valores preenchidos por contato |
| `deal_stages` | Etapas do funil |
| `deals` | Oportunidade: contact, stage, title, value, conversation_id |

### Comercial / IA

| Tabela | Uso |
|---|---|
| `services` | Catálogo (billing_type: fixed / per_unit / tiered, …) |
| `service_pricing_tiers` | Faixas de preço |
| `playbooks` | Roteiro texto |
| `ai_configs` | name, instructions, **is_enabled** (por tenant) |
| **`ai_usage_events`** | Log de tokens OpenAI por tenant (prompt/completion/total, model, conversation_id) |

### Temperatura do lead

Em `contacts.temperature`: `hot` | `warm` | `cold` (heurística, não modelo ML).

Migração platform ops: `supabase/migrations/20260920210000_platform_ops.sql`.

---

## 7. Fluxos principais (como funciona)

### 7.1 Conectar WhatsApp (fluxo atual)

1. Empresa vai em **Canais**.
2. **Baileys/Evolution:** cria instância → mostra QR → escaneia no celular.
3. Sistema grava `channels` + `whatsapp_accounts` (token criptografado `evolution:…`).
4. Webhook Evolution: `POST {APP_URL}/api/webhooks/evolution` (eventos msgs + `CONNECTION_UPDATE`).
5. Se o número **cair**: notificação no sino + destaque em Canais + botão **Reconectar** (novo QR).

*(Meta Cloud API / Embedded Signup: código legado residual — **não é o caminho de produção**.)*

### 7.2 Mensagem chega (inbound)

1. Evolution envia webhook.
2. `processEvolutionWebhook` resolve instância → conta → tenant.
3. Upsert **contact** (por `external_id` / telefone).
4. Upsert/abre **conversation** (status tipicamente `ai_active`).
5. Insere **message** inbound.
6. Dispara `runAiForConversation(conversationId)` em background.

### 7.3 IA responde

Arquivo central: `src/lib/ai/orchestrate.ts`.

**Só responde se:**

- conversa em `ai_active`
- `ai_configs.is_enabled = true`
- existe `OPENAI_API_KEY`

**Prompt montado com:** instruções do tenant, perfil da empresa, playbook, campos a coletar, catálogo/orçamento, funil.

**Resposta OpenAI em JSON:** `action` (`reply` | `handoff`), `text`, `collected`, `deal_stage`.

**Depois:** persiste collected → cria/avança deal → envia via Evolution → grava message `ai` → se handoff, notifica → **registra tokens** em `ai_usage_events`.

### 7.4 Handoff humano

1. IA (ou pedido) → `waiting_human` + notificação no sino.
2. Atendente **Assumir** → `human_active` (RPC `assume_conversation`).
3. Timeout 5 min: cron `/api/cron/handoff-timeout` → mensagem “atendentes ocupados…” + `handoff_busy_sent_at`.
4. **Devolver à IA** / **Resolver** nas actions.

### 7.5 Inbox ao vivo

- **Polling** estável (~8s) — Realtime foi desligado na UI de produção (hydration/recover loop).
- Filtros: Todas / Não lidas / Aguardando / Atendidas + **filtro por canal**.
- Sino também atualiza por poll.

### 7.6 Leads, funil, equipe

- **Leads:** contacts + atributos + temperatura.
- **Funil:** deals por stages; avanço por IA/heurística.
- **Equipe:** convites respeitam `max_members`.

### 7.7 Operação da plataforma

- **Saúde:** checks de disco (`/host`), DB, app `/login`, Evolution, Auth health.
- **Uso IA:** agrega `ai_usage_events` (estimativa USD no painel).
- **Finanças:** MRR = soma `monthly_fee_cents` de tenants `active` / `past_due`.

---

## 8. Variáveis de ambiente importantes

| Var | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Cliente (em prod: `https://api.virachat.com.br`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/webhooks/IA |
| `DATABASE_URL` | Postgres direto (migrações / scripts) |
| `TOKEN_ENCRYPTION_KEY` | Criptografa credenciais de canal |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | Evolution (interno Docker ou `https://wa.…`) |
| `EVOLUTION_WEBHOOK_SECRET` | Opcional no webhook |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | IA |
| `NEXT_PUBLIC_APP_URL` | Links / redirects (`https://app.virachat.com.br`) |
| `PLATFORM_ADMIN_EMAILS` / `PASSWORD` | Seed super admin |
| `CRON_SECRET` | Protege `/api/cron/*` |
| Domínios Caddy | `APP_DOMAIN`, `APP_ALIAS`, `ROOT_DOMAIN`, `WA_DOMAIN`, `API_DOMAIN` |
| `SUPABASE_KONG_UPSTREAM` | Em prod: **`supabase-envoy:8000`** (nome histórico “Kong”) |

Template: `.env.example` (raiz) e `docker/.env.example` / `.env.prod.example`.

---

## 9. Pastas de código relevantes

```
src/app/app/...                 → páginas do produto
src/app/platform/...            → super admin (health, tenants, usage, finance, invites)
src/app/api/webhooks/evolution  → webhook WhatsApp (produção)
src/app/api/cron/...            → timeout handoff
src/app/actions/...             → server actions (channels, platform, …)
src/components/inbox/...        → UI conversas (polling)
src/components/channels/...     → QR Baileys, disconnect, reconnect
src/components/platform/...     → shell + forms do super admin
src/lib/ai/orchestrate.ts       → cérebro da IA
src/lib/evolution/client.ts     → HTTP Evolution
src/lib/whatsapp/evolution-webhook.ts
src/lib/platform/health.ts      → checks VPS + disco /host
src/lib/platform/usage.ts       → recordAiUsage + estimativa custo
src/lib/crm/...                 → atributos, pricing, funil, playbook
src/lib/team/invite.ts          → convites
docker/                         → compose prod, Caddyfile, scripts VPS, supabase/
supabase/migrations/            → schema
track/PLANO.md                  → plano original
track/Escopo-eduardo.txt        → escopo cliente
```

---

## 10. O que já funciona bem (hoje)

- Multi-tenant + RLS em Postgres self-host
- WhatsApp por **QR (Evolution/Baileys)**, N números por tenant
- Alerta + reconexão quando o WhatsApp cai
- Inbox com polling + filtros + handoff
- IA com playbook + catálogo + coleta de campos + registro de tokens
- Funil e leads
- Equipe com limite de assentos
- Super admin: tenants, mensalidade/MRR, uso IA, **Saúde com disco SSD**
- HTTPS + domínio próprio na VPS (Caddy)
- Deploy Docker reproduzível (`docker-compose.prod.yml`)

---

## 11. Limitações / dívidas conhecidas (úteis p/ remodelar)

1. **Um usuário ≈ um tenant na prática** (UI usa o primeiro membership).
2. **Meta Cloud / Embedded Signup** legado — produto atual é só Baileys; limpar UI/código residual.
3. **Inngest / follow-up automático** planejado no `PLANO.md`, **não implementado**.
4. **Áudio / STT** fora de escopo.
5. **PDF de proposta** descartado (proposta no WhatsApp).
6. Temperatura do lead é heurística simples.
7. Tags/observações na lateral do inbox ainda são placeholder/demo em partes.
8. Signup público desligado de propósito.
9. Inbox **sem Realtime** (polling) — candidato a voltar com cuidado.
10. **Enterprise-ready / redesign de telas** — próximo foco (UX, robustez, auditoria, permissões).
11. Backup: script existe; **cron de backup** pode ainda não estar agendado na VPS.
12. DNS `www` vs `app`: em alguns clients o www ainda pode cachear parking antigo da KingHost; `app.` está estável.

---

## 12. Decisões de produto já tomadas (não reinventar sem querer)

- Canal de produção = **Evolution/Baileys** (não Meta Cloud)
- Dados = **Postgres self-host**, não depender do Free Cloud da Supabase
- Follow-up futuro com **Inngest**
- Sem PDF de proposta
- Playbooks = **prompt estruturado**, não flowchart visual
- Sem STT por enquanto
- Tudo **genérico por tenant** (não hardcode KM Safety)
- Billing interno simples (`monthly_fee_cents`) — sem gateway de pagamento ainda

---

## 13. Como usar este doc para remodelar

Peça à IA algo nesta linha:

> Com base em `track/SISTEMA-ATUAL.md`, proponha uma remodelagem de [área: inbox / canais Baileys / CRM / platform / multi-tenant].  
> Preserve o que já funciona (webhook Evolution → IA → WhatsApp).  
> Liste: o que manter, o que fundir, o que cortar, schema novo e ordem de migração.

Áreas candidatas (próxima sprint — enterprise / telas):

- Redesign UX das telas `/app` (inbox, leads, funil, settings)
- Modelo de permissões / vários tenants por usuário
- Automações (follow-up, SLA, filas)
- UX unificada Configurações vs IA vs Canais
- Billing SaaS (planos, cobrança real) a partir de `monthly_fee_cents`
- Observabilidade / auditoria / hardering enterprise
- Limpeza total do legado Meta

---

## 14. Diagrama mental rápido

```
                    ┌─────────────┐
                    │ Super admin │
                    │  /platform  │  saúde · tenants · IA · MRR
                    └──────┬──────┘
                           │ cria tenant + assentos + mensalidade
                           ▼
┌──────────┐         ┌───────────┐         ┌────────────┐
│ WhatsApp │◄───────►│  ViraChat │◄───────►│ Operadores │
│ Baileys  │ webhook │  (Next)   │  /app   │ admin/agent│
│ Evolution│         │  VPS+Caddy│         └────────────┘
└──────────┘         └─────┬─────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     Supabase self     OpenAI      Evolution API
     (Postgres/Auth)   (texto)     (enviar / QR)
```

---

*Fim do mapa. Atualize este arquivo quando fluxos grandes mudarem (WhatsApp, IA, tenancy, billing, infra).*
