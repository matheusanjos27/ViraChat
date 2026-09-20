# DEV-02 / DEV-03 / DEV-04 — CRM Base

## Entregue

### Campos customizados (`/app/settings/fields`)
- Tenant define campos (texto, número, e-mail, telefone, data, seleção)
- Opção “Coletar via IA”
- Valores editáveis no painel lateral de Leads
- Seed genérico: empresa, email, responsável, setor, tamanho

### Funil (`/app/deals` + `/app/settings/pipeline`)
- Kanban com drag-and-drop
- Etapas configuráveis (cor, ganho/perdido)
- Seed: Novo lead → Qualificado → Orçamento → Proposta → Negociação → Fechado / Perdido
- Deal criado automaticamente quando a IA coleta ≥2 campos

### Temperatura (DEV-04)
- Heurística hot / warm / cold na listagem de Leads
- Persistida em `contacts.temperature`

### IA
- Prompt injeta campos pendentes
- JSON `collected` persiste valores
- Mapeia empresa/email/responsável para colunas nativas do contato

## Migration
`supabase/migrations/20260920120000_crm_base.sql`

Rodar no projeto Supabase antes de usar em produção.
