# DEV-01 — SaaS com Super Admin (provisionamento de tenants)

**Status:** feito  


**Área:** plataforma / auth / multi-tenant  
**Criado:** 2026-09-20

## Objetivo

Transformar o ViraChat em SaaS operado por **super admin da plataforma**:

- Super admin cadastra **tenants**
- Super admin **convida usuários** para cada tenant
- **Não** existe self-serve: usuário comum não cria empresa sozinho
- Signup público de tenant é removido / bloqueado

## Modelo alvo

```
Super Admin (plataforma)
  └── cria Tenant
        └── convida User (admin/supervisor/agent do tenant)
              └── acesso isolado (RLS + tenant_id)
```

## Escopo técnico

1. Tabela `platform_admins` + helper `is_platform_admin()`
2. RPC / actions: criar tenant **somente** se platform admin
3. Painel `/platform` — listar tenants, criar tenant, convidar usuário
4. Convite via Supabase Auth Admin (`inviteUserByEmail`) + `user_tenant_roles`
5. Bootstrap do primeiro super admin via `PLATFORM_ADMIN_EMAILS` no env
6. Remover formulário de “criar empresa” do fluxo self-serve
7. Sem `/signup` público — redirect para login; novos users só por convite
8. Super admin seedado via `npm run seed:platform-admin` (Auth + `platform_admins`)

## Critérios de aceite

- [x] Usuário sem role de platform admin não consegue criar tenant
- [x] Super admin cria tenant sem virar membro automático (a menos que se convide)
- [x] Super admin convida e-mail e o usuário entra no tenant após aceitar
- [x] Login sem membership mostra “sem acesso / aguardando convite”
- [x] RLS continua isolando dados entre tenants

## Fora de escopo (agora)

- Billing / planos
- Multi-tenant de agências
- UI avançada de gestão de equipe dentro do tenant
