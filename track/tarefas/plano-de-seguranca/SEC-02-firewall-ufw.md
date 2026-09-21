# SEC-02 — Firewall ufw (fechar portas de app)

**Status:** pendente  
**Área:** infra / VPS  
**Criado:** 2026-09-21  
**Depende de:** SEC-01 (senão corta o acesso atual por IP:porta)

## Objetivo

Na borda da VPS, só **22** (SSH), **80** e **443** aceitam conexão da internet. App, Kong e Evolution ficam atrás do Caddy / rede Docker.

## Escopo

1. Instalar/ativar `ufw` (ou equivalente)
2. Allow: `22/tcp`, `80/tcp`, `443/tcp`
3. Deny (ou não publicar): `3000`, `8000`, `8080`, Postgres `5432`, Redis, etc.
4. Testar de fora da VPS: portas fechadas não respondem; HTTPS continua ok
5. Documentar regra no `docker/DEPLOY-VPS.md` (comando de referência)

## Critérios de aceite

- [ ] Scan externo não vê `3000`/`8000`/`8080` abertos
- [ ] Site e APIs via HTTPS seguem funcionando
- [ ] SSH continua acessível (de preferência só com chave — SEC-03)
- [ ] Reboot da VPS mantém regras (`ufw enable` + default deny incoming)

## Fora de escopo

- fail2ban (SEC-08)
- Bind só em `127.0.0.1` nos compose (SEC-06)
