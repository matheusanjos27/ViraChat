# SEC-09 — CRON_SECRET e secrets de webhook

**Status:** pendente  
**Área:** app / integrações  
**Criado:** 2026-09-21

## Objetivo

Rotas de cron e webhooks **não** aceitam chamada anônima da internet.

## Escopo

1. Garantir `CRON_SECRET` forte no `.env` de produção
2. Cron (`/api/cron/*`) exige `Authorization: Bearer <CRON_SECRET>`
3. Webhook Evolution: header/token compartilhado validado no handler
4. Webhook Meta (se ativo): `META_WEBHOOK_VERIFY_TOKEN` + validação de assinatura (`META_APP_SECRET`) quando aplicável
5. Recusar request sem secret com `401` (sem detalhe interno)
6. Agendar cron na VPS (`curl` com Bearer) ou scheduler equivalente — não deixar rota “aberta por esquecimento”

## Critérios de aceite

- [ ] `curl` sem secret no cron → 401
- [ ] `curl` com secret → 200 e job roda
- [ ] Webhook sem token/assinatura → rejeitado
- [ ] Valores não commitados; só no `.env` do servidor

## Fora de escopo

- Rate limit (SEC-07)
- Rotação periódica automática (SEC-10)
