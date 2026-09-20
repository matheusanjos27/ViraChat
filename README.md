# ViraChat

CRM/atendimento multi-tenant com IA no WhatsApp. Escopo comercial em [`track/Escopo-eduardo.txt`](./track/Escopo-eduardo.txt). Mapa do sistema: [`track/SISTEMA-ATUAL.md`](./track/SISTEMA-ATUAL.md).

## Stack

- **Next.js 16** (App Router) — Vercel ou VPS
- **Supabase** (Postgres + Auth + RLS + Realtime)
- **WhatsApp via Evolution API (Baileys)** — QR Code, N números por tenant
- **OpenAI** (`gpt-4o-mini` por padrão)
- Meta Cloud API ainda existe como legado (opcional)

## WhatsApp (caminho recomendado)

1. Suba a Evolution no VPS: ver [`docker/README.md`](./docker/README.md)
2. Configure `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` no app
3. Em **Canais** → **Gerar QR Code** → escanear no celular
4. Repita para quantos números o tenant precisar; a IA responde em todos

Webhook Evolution: `{NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`

## Setup local

```bash
cp .env.example .env.local
# Supabase + TOKEN_ENCRYPTION_KEY + Evolution (se for testar WhatsApp)
npm install
npx supabase db push
npm run dev
```

Evolution local (opcional):

```bash
cd docker && cp .env.example .env && docker compose up -d
```

## Custo enxuto (referência)

| Peça | ~US$/mês |
|---|---|
| VPS (Evolution + opcional Next) | 8–15 |
| Supabase (Free → Pro) | 0–25 |
| OpenAI | 5–10 |
| **Total típico** | **~15–50** |

## Status

- [x] Auth, tenant, RLS, CRM, inbox, IA, handoff
- [x] WhatsApp Baileys (Evolution) + QR multi-número
- [x] Meta Cloud API (legado)
