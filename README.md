# ViraChat

CRM/atendimento multi-tenant com IA no WhatsApp. Escopo comercial em [`track/Escopo-eduardo.txt`](./track/Escopo-eduardo.txt). Mapa do sistema: [`track/SISTEMA-ATUAL.md`](./track/SISTEMA-ATUAL.md).

## Stack

- **Next.js 16** (App Router) — VPS ou Vercel
- **Supabase** (Postgres + Auth + RLS + Realtime) — cloud ou self-host na VPS
- **WhatsApp via Evolution API (Baileys)** — QR Code, N números por tenant
- **OpenAI** (`gpt-4o-mini` por padrão)

> Meta Cloud API foi removida do produto por enquanto (pode voltar no futuro).

## WhatsApp

1. Suba a Evolution: [`docker/README.md`](./docker/README.md) / [`docker/DEPLOY-VPS.md`](./docker/DEPLOY-VPS.md)
2. Configure `EVOLUTION_API_URL` + `EVOLUTION_API_KEY`
3. Em **Canais** → gerar QR → escanear no celular

Webhook: `{NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`

## Setup local

```bash
cp .env.example .env.local
npm install
npx supabase db push
npm run dev
```

## Deploy VPS

Ver [`docker/DEPLOY-VPS.md`](./docker/DEPLOY-VPS.md). Push na `main` dispara deploy automático (GitHub Actions) quando os secrets da VPS estiverem configurados.
