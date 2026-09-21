# SEC-03 — SSH por chave (sem senha fraca)

**Status:** pendente  
**Área:** infra / acesso VPS  
**Criado:** 2026-09-21

## Objetivo

Acesso administrativo à VPS só por **chave SSH**. Senha de root fraca ou compartilhada deixa de ser vetor.

## Escopo

1. Gerar chave no PC de deploy (ed25519) — privada **nunca** no chat/Git
2. Colocar a `.pub` em `/root/.ssh/authorized_keys` (ou user dedicado)
3. Testar login com chave (`ssh -i … root@IP`)
4. Desabilitar login por senha: `PasswordAuthentication no` em `sshd_config`
5. Opcional: usuário não-root + `PermitRootLogin prohibit-password`
6. Guardar chave de deploy no gerenciador de senhas / secrets do GitHub Actions (se reativar deploy auto)

## Critérios de aceite

- [ ] Login com chave funciona
- [ ] Login só com senha **falha**
- [ ] Há pelo menos 2 chaves autorizadas (principal + backup) ou procedimento de recovery via console KingHost documentado
- [ ] Agente/CI sem chave não consegue SSH (esperado)

## Fora de escopo

- fail2ban (SEC-08)
- 2FA no painel do provedor (SEC-10)
