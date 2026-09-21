# SEC-01 — HTTPS + portas públicas só 80/443

**Status:** pendente (verificar se já feito)  
**Área:** infra / Caddy / DNS  
**Criado:** 2026-09-21

## Objetivo

Todo tráfego externo do ViraChat, API Supabase e Evolution passa por **HTTPS**. Nenhuma porta de app (`3000`, `8000`, `8080`) fica exposta na internet.

## Escopo

1. Domínio `virachat.com.br` (e subdomínios) com DNS A apontando pra VPS
2. Caddy com certificados Let’s Encrypt nos hosts:
   - app / www → `virachat`
   - `api.` → Kong/Supabase
   - `wa.` → Evolution
3. Confirmar que acesso por `http://IP:3000` (e similares) **não** é necessário em produção
4. Cookies/auth só em HTTPS (Secure) quando o app estiver atrás do Caddy

## Critérios de aceite

- [ ] `https://virachat.com.br` (ou www) abre o app com cadeado válido
- [ ] `https://api.virachat.com.br` responde health do Auth/Kong
- [ ] `https://wa.virachat.com.br` só via HTTPS (se Evolution for público)
- [ ] Não depende de `:3000` / `:8000` / `:8080` no browser do cliente
- [ ] SEC-02 pode fechar essas portas no firewall sem derrubar o site

## Fora de escopo

- Firewall detalhado (SEC-02)
- Rede Docker interna (SEC-06)
