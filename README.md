# ViraChat

Plataforma SaaS multi-tenant de atendimento empresarial com IA no WhatsApp (API oficial Meta). Escopo completo em [`escopo.txt`](./escopo.txt).

## Stack

- **Next.js 16** (App Router) na **Vercel**
- **Supabase** (Postgres + Auth + RLS + Realtime)
- **WhatsApp Cloud API** (oficial) — Embedded Signup + webhooks HMAC
- Processamento assíncrono (Fase 4+): **Inngest**
- LLM (Fase 4+): **Claude (Anthropic)**
- Tokens Meta: **AES-256-GCM** (`TOKEN_ENCRYPTION_KEY`)

## Números Business vs comuns

Só a **Cloud API oficial** é suportada:

| Tipo | Como conectar |
|---|---|
| WhatsApp Business (app) | Embedded Signup com migração (`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`) |
| Número comum / pessoal | Só se migrar para Cloud API — **para de funcionar no celular** |
| Já na Cloud API / sandbox | Conectar com token (dev) ou Embedded Signup |

Não há suporte a WhatsApp Web / QR / automações não oficiais.

## Setup local

```bash
cp .env.example .env.local
# Preencha Supabase + TOKEN_ENCRYPTION_KEY (+ Meta quando for testar API)
npm install
npx supabase db push
npm run dev
```

Abra `/app/channels` após login/criar empresa.

Webhook Meta (precisa de URL pública, ex. ngrok ou Vercel):

`{APP_URL}/api/webhooks/meta`

Variáveis Meta: `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.

## Status

- [x] Fase 1 — Fundação (auth, tenant, RLS)
- [x] Fase 2 — Canais WhatsApp (webhook, ingest, connect)
- [x] Fase 3 — Central de conversas
- [x] Fase 4 — IA (Claude + handoff + config)
- [ ] Deploy Vercel (quando houver repo)

## Roadmap

1. Fundação
2. WhatsApp (parcialmente feito)
3. Central de conversas + Realtime
4. IA (Inngest + Claude)
5. Handoff humano
