# ViraChat — Mapa do sistema (estado atual)

> Documento para remodelagem. Descreve **como o produto funciona hoje** (telas, dados, fluxos), não o roadmap ideal.
>
> Data de referência: setembro/2026 · Stack: Next.js (App Router) + Supabase + **Evolution/Baileys (WhatsApp QR)** + OpenAI · Meta Cloud API = legado


---

## 1. O que é o produto

**ViraChat** é um CRM/atendimento multi-tenant com IA no WhatsApp.

- Cada **empresa (tenant)** tem seus leads, conversas, funil, catálogo e IA.
- O cliente final fala no **WhatsApp**; a **IA** responde; humanos assumem quando necessário.
- Um **super admin da plataforma** cria empresas e controla limites (ex.: quantos colaboradores).

**Não há signup público.** Entrada só por convite (super admin ou admin da empresa).

---

## 2. Arquitetura em uma frase

```
WhatsApp (Evolution/Baileys — QR)
    → Webhook /api/webhooks/evolution
    → grava contato/conversa/mensagem (Supabase)
    → dispara IA (OpenAI) em background
    → responde via Evolution sendText
    → atualiza CRM (atributos, deal/funil, notificações)

(Legado) Meta Cloud API → /api/webhooks/meta → mesmo ingest/IA
```

UI web: operadores veem inbox, leads, funil e configurações.

---

## 3. Papéis e acesso

| Papel | Onde | O que faz |
|---|---|---|
| **Platform admin** (super admin) | `/platform` | Cria tenants, define `max_members`, convida usuários |
| **admin** (empresa) | `/app/*` | Tudo do tenant: canais, IA, equipe, funil, etc. |
| **supervisor** | `/app/*` | Opera + pode convidar colaboradores |
| **agent** (atendente) | `/app/*` | Opera conversas/leads/funil (sem gerir equipe admin) |

- Usuário autenticado via **Supabase Auth**.
- Vínculo empresa: tabela `user_tenant_roles` (hoje o app pega o **primeiro** tenant do usuário).
- Convite: e-mail Supabase → `/auth/set-password` → define senha → entra só naquela empresa.

**Assentos (`tenants.max_members`):** padrão **2** (= empresa + 1 colaborador). Super admin altera.

---

## 4. Telas (rotas)

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
| `/app/channels` | **Canais** | Conectar WhatsApp por **QR (Baileys/Evolution)**; N números/tenant; Meta legado em accordion |
| `/app/settings` | Hub configurações | Cards para subpáginas |
| `/app/settings/company` | Empresa | Nome, about, telefone, site (IA usa na apresentação) |
| `/app/settings/ai` | Atendimento com IA | Liga/desliga IA, instruções, abas: campos, catálogo, playbook |
| `/app/settings/fields` | Campos do lead | CRUD atributos customizados (também via aba IA) |
| `/app/settings/services` | Catálogo | Serviços + faixas de preço |
| `/app/settings/playbook` | Playbook | Roteiro de conversa em texto |
| `/app/settings/pipeline` | Etapas do funil | CRUD stages |
| `/app/settings/team` | Equipe | Lista membros, convite nome+e-mail, limite de assentos |
| `/app/ai` | (legado/redirect) | Unificado em settings/ai |
| `/app/settings/assistant` | (legado) | Unificado |

**Sidebar:** Conversas, Leads, Funil, Atendimento com IA, Configurações + sino de notificações.

### Plataforma

| Rota | Função |
|---|---|
| `/platform` | Super admin: criar tenant, limite de assentos, convidar usuário, lista convites |

---

## 5. Modelo de dados (o que guardamos)

Tudo é **multi-tenant** (`tenant_id`) com RLS no Supabase.

### Identidade e tenancy

| Tabela | Campos principais | Uso |
|---|---|---|
| `tenants` | name, slug, about, website, phone, **max_members** | Empresa |
| `profiles` | full_name, email | Usuário (liga com `auth.users`) |
| `user_tenant_roles` | user_id, tenant_id, role | Quem pertence a qual empresa |
| `platform_admins` | user_id | Super admins |
| `tenant_invites` | email, role, accepted_at, invited_by | Histórico de convites |

### WhatsApp / canal

| Tabela | Campos principais | Uso |
|---|---|---|
| `providers` | id=`whatsapp` | Catálogo de provedores |
| `channels` | display_name, is_active, provider_id | Canal lógico |
| `whatsapp_accounts` | phone_number_id, waba_id, **access_token_encrypted**, onboard_source, display_phone… | Credenciais Cloud API |

Token fica **criptografado** com `TOKEN_ENCRYPTION_KEY`.

### Inbox

| Tabela | Campos principais | Uso |
|---|---|---|
| `contacts` | display_name, phone_e164, external_id, email, company_name, notes, **temperature** | Lead/contato |
| `conversations` | channel_id, contact_id, **status**, assigned_to, last_message_at, **waiting_human_at**, **handoff_busy_sent_at** | Thread |
| `messages` | direction, sender_type (contact/ai/agent/system), body, provider_message_id | Mensagens |
| `app_notifications` | type, title, body, conversation_id, read_at | Sino (handoff etc.) |

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
| `deal_stages` | Etapas do funil (Novo lead → … → Fechado/Perdido) |
| `deals` | Oportunidade: contact, stage, title, value, conversation_id |

### Comercial / IA

| Tabela | Uso |
|---|---|
| `services` | Catálogo (billing_type: fixed / per_unit / tiered, unit_attribute_key, base_price…) |
| `service_pricing_tiers` | Faixas de preço |
| `playbooks` | Roteiro texto (trigger: new_contact / keyword / manual) |
| `ai_configs` | name, instructions, **is_enabled** (por tenant) |

### Temperatura do lead

Em `contacts.temperature`: `hot` | `warm` | `cold` (heurística, não modelo ML).

---

## 6. Fluxos principais (como funciona)

### 6.1 Conectar WhatsApp

1. Empresa vai em **Canais**.
2. Opções:
   - **Token manual (dev):** Phone Number ID + WABA ID + Access Token
   - **Embedded Signup (Meta):** popup Facebook (ainda sensível a `config_id` / domínio / Tech Provider)
3. Sistema grava `channels` + `whatsapp_accounts` (token criptografado).
4. Webhook Meta: `POST/GET {APP_URL}/api/webhooks/meta`  
   - Verify token: `META_WEBHOOK_VERIFY_TOKEN`  
   - Assinatura: `META_APP_SECRET`

### 6.2 Mensagem chega (inbound)

1. Meta envia webhook.
2. `processWhatsAppWebhookPayload` acha o `phone_number_id` → conta → tenant.
3. Upsert **contact** (por `external_id` / telefone).
4. Upsert/abre **conversation** (status tipicamente `ai_active`).
5. Insere **message** inbound.
6. `after()` chama `runAiForConversation(conversationId)`.

### 6.3 IA responde

Arquivo central: `src/lib/ai/orchestrate.ts`.

**Só responde se:**

- conversa em `ai_active`
- `ai_configs.is_enabled = true`
- existe `OPENAI_API_KEY`

**Prompt montado com:**

- instruções do tenant (`ai_configs`)
- perfil da empresa (`tenants.about` etc.)
- playbook ativo
- campos a coletar (atributos pendentes)
- catálogo + orçamento pré-calculado (se houver unidades)
- funil (nomes das etapas)

**Resposta OpenAI em JSON:**

```json
{
  "action": "reply" | "handoff",
  "text": "...",
  "collected": { "empresa": "...", "email": "..." },
  "deal_stage": "Orçamento"
}
```

**Depois da resposta:**

1. Persiste `collected` (+ heurísticas de extração se a IA esquecer o JSON)
2. Cria/avança **deal** no funil (IA `deal_stage` **ou** heurística: interesse → Qualificado, preço → Orçamento…)
3. Envia texto no WhatsApp
4. Grava message outbound `sender_type=ai`
5. Se `handoff` → status `waiting_human` + notificação + timer 5 min

### 6.4 Handoff humano

1. IA (ou pedido explícito) → `waiting_human`.
2. Notificação no sino: “Atendimento humano solicitado”.
3. Badge laranja em Conversas.
4. Atendente clica **Assumir** → `human_active` (RPC `assume_conversation`).
5. Se **ninguém assumir em 5 minutos**: cron `/api/cron/handoff-timeout` manda mensagem automática (“atendentes ocupados…”) e marca `handoff_busy_sent_at`.
6. **Devolver à IA** / **Resolver** existem nas actions.

### 6.5 Inbox ao vivo

- Supabase Realtime em `messages` / `conversations` / `app_notifications`.
- Poll de segurança ~8s.
- Filtros: Todas / Não lidas / Aguardando / Atendidas + **filtro por canal**.

### 6.6 Leads e funil

- **Leads:** lista de contacts + atributos + temperatura.
- **Funil:** deals por `deal_stages`.
- Deal nasce quando há dados/interesse; etapa sobe automaticamente em orçamento/qualificação (código local recente — pode ainda não estar em produção se não houve deploy).

### 6.7 Equipe

- **Configurações → Equipe:** convida nome+e-mail (agent/supervisor).
- Respeita `max_members`.
- Convidado só tem `user_tenant_roles` daquela empresa.

---

## 7. Variáveis de ambiente importantes

| Var | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Cliente |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/webhooks/IA |
| `TOKEN_ENCRYPTION_KEY` | Criptografa token WhatsApp |
| `NEXT_PUBLIC_META_APP_ID` | App Meta |
| `NEXT_PUBLIC_META_CONFIG_ID` | Embedded Signup (opcional) |
| `META_APP_SECRET` | OAuth + assinatura webhook |
| `META_WEBHOOK_VERIFY_TOKEN` | Verificação webhook |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | IA |
| `NEXT_PUBLIC_APP_URL` | Links de convite / redirects |
| `PLATFORM_ADMIN_EMAILS` | Seed super admin |
| `CRON_SECRET` | Protege cron de handoff |

Deploy típico: **Vercel** (`vira-chat.vercel.app`).

---

## 8. Pastas de código relevantes

```
src/app/app/...          → páginas do produto
src/app/platform/...     → super admin
src/app/api/webhooks/meta → webhook WhatsApp
src/app/api/cron/...     → timeout handoff
src/app/actions/...      → server actions
src/components/inbox/... → UI conversas
src/lib/ai/orchestrate.ts → cérebro da IA
src/lib/meta/whatsapp.ts → Graph API
src/lib/crm/...          → atributos, pricing, funil, playbook
src/lib/team/invite.ts   → convites
supabase/migrations/     → schema
track/PLANO.md           → plano original (escopo Eduardo)
track/Escopo-eduardo.txt → escopo cliente
```

---

## 9. O que já funciona bem (hoje)

- Multi-tenant + RLS
- WhatsApp Cloud API (token manual estável; Embedded Signup parcial)
- Inbox com realtime + filtros
- IA respondendo com playbook + catálogo + coleta de campos
- Funil e leads
- Handoff + notificação + timeout 5 min (código pronto)
- Equipe com limite de assentos (código pronto)
- Super admin provisiona empresas

---

## 10. Limitações / dívidas conhecidas (úteis p/ remodelar)

1. **Um usuário ≈ um tenant na prática** (UI usa o primeiro membership).
2. **Embedded Signup** ainda frágil (config Meta / Tech Provider / domínio).
3. **Inngest / follow-up automático** planejado no `PLANO.md`, **não implementado**.
4. **Áudio / STT** fora de escopo.
5. **PDF de proposta** descartado (proposta no WhatsApp).
6. Vários commits recentes podem estar **só locais** (sem push): funil auto, handoff UI, filtro canal, equipe — conferir o que já está em produção.
7. Temperatura do lead é heurística simples.
8. Tags/observações na lateral do inbox ainda são placeholder/demo em partes.
9. Signup público desligado de propósito.

---

## 11. Decisões de produto já tomadas (não reinventar sem querer)

Do `PLANO.md`:

- Follow-up futuro com **Inngest**
- Sem PDF de proposta
- Playbooks = **prompt estruturado**, não flowchart visual
- Sem STT por enquanto
- Tudo **genérico por tenant** (não hardcode KM Safety)

---

## 12. Como usar este doc para remodelar

Peça à IA algo nesta linha:

> Com base em `track/SISTEMA-ATUAL.md`, proponha uma remodelagem de [área: inbox / onboarding Meta / CRM / pricing / multi-tenant].  
> Preserve o que já funciona (webhook → IA → WhatsApp).  
> Liste: o que manter, o que fundir, o que cortar, schema novo e ordem de migração.

Áreas candidatas a remodel:

- Onboarding WhatsApp self-serve (Embedded Signup + Tech Provider)
- Modelo de permissões / vários tenants por usuário
- Automações (follow-up, SLA, filas)
- UX unificada Configurações vs IA vs Canais
- Billing / planos SaaS por `max_members` e canais

---

## 13. Diagrama mental rápido

```
                    ┌─────────────┐
                    │ Super admin │
                    │  /platform  │
                    └──────┬──────┘
                           │ cria tenant + assentos
                           ▼
┌──────────┐         ┌───────────┐         ┌────────────┐
│ WhatsApp │◄───────►│  ViraChat │◄───────►│ Operadores │
│  Cloud   │ webhook │  (Next)   │  /app   │ admin/agent│
└──────────┘         └─────┬─────┘         └────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Supabase      OpenAI       Meta Graph
         (dados)       (texto)      (enviar msg)
```

---

*Fim do mapa. Atualize este arquivo quando fluxos grandes mudarem (WhatsApp, IA, tenancy, billing).*
