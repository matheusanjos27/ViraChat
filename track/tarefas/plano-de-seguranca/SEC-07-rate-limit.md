# SEC-07 — Rate limit no login e APIs públicas

**Status:** pendente  
**Área:** app / edge  
**Criado:** 2026-09-21

## Objetivo

Mitigar força bruta no login e abuso em rotas públicas (webhooks, contact form, cron exposto por engano).

## Escopo

1. **Login** (`/login` / Auth): limite por IP (e opcionalmente por e-mail) — via middleware Next, Caddy `rate_limit`, ou provedor
2. **Formulário de contato** da landing: limite por IP
3. **Webhooks** (`/api/webhooks/*`): validar assinatura/secret **e** rate limit básico
4. Resposta clara `429` sem vazar se o user existe
5. Logar picos anômalos (mesmo que só `console`/arquivo no início)

## Critérios de aceite

- [ ] N tentativas rápidas de login a partir do mesmo IP passam a ser bloqueadas/atrasadas
- [ ] Contact form não aceita flood óbvio
- [ ] Webhooks legítimos (Evolution/Meta) não quebram com o limite normal
- [ ] Documentar valores (ex.: 10/min login, 5/min contact)

## Fora de escopo

- WAF cloud (SEC-10)
- CAPTCHA (avaliar só se abuse real)
