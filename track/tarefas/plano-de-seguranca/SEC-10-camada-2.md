# SEC-10 — Camada 2 (depois do básico)

**Status:** backlog  
**Área:** produto / compliance / ops  
**Criado:** 2026-09-21  
**Depende de:** SEC-01 … SEC-09 (básico fechado)

## Objetivo

Itens “enterprise” que **não** bloqueiam vender piloto, mas entram quando cliente/compliance pedir.

## Escopo (lista, não tudo de uma vez)

1. **2FA** no login (Supabase MFA) e no painel do provedor VPS
2. **Auditoria**: log de ações admin (quem convidou, quem alterou IA, quem exportou)
3. **WAF** / proteção DDoS na borda (Cloudflare ou similar na frente do Caddy)
4. **Monitoramento + alerta**: uptime, disco, RAM, container down (Uptime Kuma, Prometheus, etc.)
5. **Política de secrets**: rotação trimestral; acesso least-privilege ao `SERVICE_ROLE`
6. **Separação de hosts**: Evolution e/ou DB em máquina distinta
7. **SSO** (SAML/OIDC) se cliente enterprise exigir
8. Caminho **Meta Cloud API** oficial quando Baileys não passar em due diligence

## Critérios de aceite (por item, quando puxar)

- [ ] Item escolhido tem subtarefa própria ou PR com checklist
- [ ] Não mistura com SEC-01–09 sem necessidade

## Fora de escopo deste arquivo

- Implementar tudo de uma vez — este é o **backlog**, não o sprint atual
