# DEV-06 — Playbook de conversa

## Entregue

### Banco
- `playbooks` com trigger `new_contact | keyword | manual`
- Seed automático via `seed_tenant_crm` com template comercial genérico

### UI `/app/settings/playbook`
- Lista de roteiros + editor markdown com seções `#`
- Chips para inserir seções
- Preview do prompt
- Criar a partir do template / restaurar template

### IA
- Playbook ativo injetado no system prompt (antes de campos e catálogo)
- Keyword match tem prioridade sobre `new_contact`
- `deal_stage` no JSON move o deal no funil pelo nome da etapa

### Genérico
Template sem SST/PGR/NR — cada tenant adapta o texto ao próprio negócio.
