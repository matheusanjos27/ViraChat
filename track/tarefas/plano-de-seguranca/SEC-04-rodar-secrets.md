# SEC-04 — Rotacionar secrets que já circularam

**Status:** pendente  
**Área:** ops / secrets  
**Criado:** 2026-09-21

## Objetivo

Tratar como **comprometido** qualquer segredo que já apareceu em chat, log ou commit local compartilhado — e trocar.

## Escopo (checklist)

1. **SSH / root** da VPS — trocar senha; preferir chave (SEC-03)
2. **Painel KingHost** — senha nova + 2FA se disponível
3. **Postgres** (`POSTGRES_PASSWORD`) — gerar forte; atualizar `/opt/supabase/docker/.env` + compose
4. **Supabase** `ANON_KEY` / `SERVICE_ROLE_KEY` / `JWT_SECRET` — regenerar se vazaram; atualizar `docker/.env` do ViraChat
5. **Evolution** `AUTHENTICATION_API_KEY` — regenerar; atualizar app + Evolution
6. **OpenAI** (e outros LLM) — revogar key antiga no painel; nova no `.env`
7. **CRON_SECRET** / webhook secrets — novos valores (alinhar com SEC-09)
8. Confirmar que **nenhum** `.env` / key está no Git (`git log` / busca)

## Critérios de aceite

- [ ] Lista acima revisada item a item (marcar o que não vazou como N/A)
- [ ] App sobe e login funciona com os novos valores
- [ ] WhatsApp (Evolution) continua enviando/recebendo
- [ ] Keys antigas revogadas nos provedores (não só “paradas de usar”)

## Fora de escopo

- Rate limit (SEC-07)
- Política formal de rotação trimestral (SEC-10)
