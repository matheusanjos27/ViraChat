# Plano de segurança — ViraChat

> Endurecimento pós-piloto. Stack: VPS (Next + Evolution + Supabase self-host) + Caddy.
>
> Criado: 2026-09-21 · Status geral: **em aberto**

## Contexto

Hoje o produto está **ok para piloto** (Auth Supabase, RLS, convite sem signup público, secrets fora do Git). Ainda **não** está enterprise-hardening contra ataque sério.

## Prioridade

| Ordem | ID | Tarefa | Impacto | Esforço |
|------:|----|--------|---------|---------|
| 1 | [SEC-01](./SEC-01-https-portas.md) | HTTPS + só 80/443 na internet | Alto | Baixo* |
| 2 | [SEC-02](./SEC-02-firewall-ufw.md) | Firewall (ufw) — fechar 3000/8000/8080 | Alto | Baixo |
| 3 | [SEC-03](./SEC-03-ssh-chave.md) | SSH por chave (sem senha fraca) | Alto | Baixo |
| 4 | [SEC-04](./SEC-04-rodar-secrets.md) | Rotacionar senhas/keys que já circularam | Alto | Médio |
| 5 | [SEC-05](./SEC-05-backup-postgres.md) | Backup automático do Postgres | Alto | Baixo |
| 6 | [SEC-06](./SEC-06-rede-interna.md) | Evolution/Supabase só rede Docker | Médio | Médio |
| 7 | [SEC-07](./SEC-07-rate-limit.md) | Rate limit no login e APIs públicas | Médio | Médio |
| 8 | [SEC-08](./SEC-08-fail2ban.md) | fail2ban (SSH + scans) | Médio | Baixo |
| 9 | [SEC-09](./SEC-09-secrets-webhooks.md) | CRON_SECRET + secret nos webhooks | Médio | Baixo |
| 10 | [SEC-10](./SEC-10-camada-2.md) | Camada 2 (2FA, auditoria, WAF, monitor) | Baixo agora | Alto |

\*Se domínio + Caddy já estiverem no ar, SEC-01 vira **checklist de verificação**.

## Já ajuda (não reabrir)

- Auth Supabase (senha + sessão)
- RLS por tenant
- Sem signup público (só convite)
- Secrets em `.env` no servidor (não no Git)
- Stack em Docker

## Como usar

1. Pegar a próxima tarefa `pendente` pela ordem da tabela  
2. Marcar status no arquivo (`em progresso` → `feito`)  
3. Atualizar a tabela deste README quando fechar  

## Fora deste plano (produto / compliance)

- SSO corporativo  
- Multi-região / HA  
- Meta Cloud API como única via (Baileys ≠ SLA Meta)  
- Contrato de uptime / SOC2  
