# SEC-06 — Evolution e Supabase só na rede Docker

**Status:** pendente  
**Área:** docker / rede  
**Criado:** 2026-09-21  
**Depende de:** SEC-01, SEC-02

## Objetivo

Mesmo com firewall, serviços sensíveis **não publicam** portas no host. Só o Caddy (ou proxy) fala com eles na rede interna.

## Escopo

1. Revisar `docker-compose.prod.yml` e compose do Supabase:
   - Remover ou comentar `ports:` de Evolution (`8080`), Kong (`8000`), Postgres (`5432`) para o host — manter só exposição interna
2. Caddy continua alcançando `virachat:3000`, `evolution-api:8080`, `supabase-kong:8000` pela rede Docker
3. Webhooks externos (Meta/Evolution, se houver) entram só pelo domínio HTTPS
4. Documentar como acessar Studio/debug **só via SSH tunnel** se precisar

## Critérios de aceite

- [ ] `ss -tlnp` / `docker ps` não mostra 8000/8080/5432 em `0.0.0.0`
- [ ] App em produção usa URLs públicas HTTPS (não `localhost:8000` no browser)
- [ ] Inbox / login / WhatsApp ok após o change
- [ ] Procedimento de tunnel SSH documentado pra debug

## Fora de escopo

- Separar Evolution em outra VPS (fase futura)
- WAF (SEC-10)
