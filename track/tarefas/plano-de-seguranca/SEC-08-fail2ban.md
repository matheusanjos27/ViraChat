# SEC-08 — fail2ban (SSH e scans)

**Status:** pendente  
**Área:** infra / VPS  
**Criado:** 2026-09-21  
**Depende de:** SEC-03 (SSH estável)

## Objetivo

Banir IPs que martelam SSH (e, se útil, auth HTTP) automaticamente.

## Escopo

1. Instalar `fail2ban` na VPS
2. Jail `sshd` ativo (maxretry / bantime razoáveis)
3. Opcional: jail olhando access log do Caddy para 401/404 em massa
4. Whitelist do IP fixo da equipe (se houver)
5. Confirmar que ban não trava o próprio deploy (cuidado com IP dinâmico)

## Critérios de aceite

- [ ] `fail2ban-client status sshd` mostra jail ativo
- [ ] Tentativa repetida de senha errada resulta em ban (teste controlado)
- [ ] Equipe ainda consegue entrar (chave + whitelist se necessário)
- [ ] Persistência após reboot

## Fora de escopo

- WAF gerenciado (SEC-10)
- Rate limit na aplicação (SEC-07)
