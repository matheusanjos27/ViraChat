# ViraChat — Plano de Implementação
> Baseado no escopo do cliente KM Safety (Eduardo). Tudo implementado de forma genérica para atender qualquer empresa.

---

## Decisões tomadas
| Tema | Decisão |
|---|---|
| Follow-up automático | **Inngest** (background jobs) |
| Proposta em PDF | ❌ Não — proposta formatada no WhatsApp é suficiente |
| Playbooks | **Prompt-based** — admin escreve roteiro estruturado, IA segue |
| Áudio (STT) | ❌ Fora do escopo por ora |

---

## Arquitetura geral (novas tabelas no banco)

```
contacts
  └── contact_attribute_values   ← campos customizados preenchidos
contact_attributes               ← definição dos campos por tenant

deals                            ← oportunidades de venda
  └── deal_stage_id → deal_stages

services                         ← catálogo de serviços/produtos
service_pricing_rules            ← regras de preço

playbooks                        ← roteiros de conversa
  └── conversation_id (ativo)

scheduled_messages               ← fila de follow-up (processada pelo Inngest)
```

---

## FASE 1 — CRM Base *(sem background jobs, entrega imediata de valor)*

### DEV-02 — Campos customizados de contato
> Qualquer empresa define quais dados quer coletar do lead durante a conversa.

**Banco:**
- `contact_attributes(id, tenant_id, key, label, type: text|number|select|date, options, required, sort_order)`
- `contact_attribute_values(id, contact_id, tenant_id, attribute_key, value)`

**UI:**
- Página `/app/settings/fields` — admin cria/edita/remove campos
- Tela de Leads — exibe campos preenchidos no detalhe do contato
- IA instrução automática — o sistema injeta os campos no prompt da IA para ela coletar durante a conversa

**Exemplos de uso:**
- KM Safety: `cnpj`, `funcionarios`, `setor`, `responsavel`, `email`
- Clínica: `convenio`, `especialidade`, `porte`
- Qualquer empresa: qualquer coisa

---

### DEV-03 — Funil de vendas (Deal stages + Deals)
> Pipeline comercial configurável: cada tenant define suas etapas.

**Banco:**
- `deal_stages(id, tenant_id, name, color, sort_order, is_closed_won, is_closed_lost)`
- `deals(id, tenant_id, contact_id, conversation_id, stage_id, title, value, notes, created_at, updated_at)`

**UI:**
- Página `/app/deals` — kanban ou lista com os deals por etapa
- Detalhes do lead — deal associado visível no painel lateral
- Página `/app/settings/pipeline` — admin configura as etapas

**Estágios padrão criados ao criar o tenant:**
`Novo Lead → Qualificado → Orçamento → Proposta → Negociação → Fechado (ganho) / Fechado (perdido)`

**IA:** pode mover o deal de etapa via instrução (ex: "quando confirmar quantidade de funcionários, mover para Qualificado")

---

### DEV-04 — Classificação automática do lead (Hot/Warm/Cold)
> Score simples baseado em comportamento — sem IA extra, só heurística.

**Regras:**
- 🔴 **Quente:** pediu preço, confirmou dados, tempo de resposta < 10min, conversa ativa
- 🟡 **Morno:** recebeu orçamento, não respondeu há 1–3 dias
- 🔵 **Frio:** só pediu info, não respondeu há >3 dias, conversa resolvida sem deal

**UI:**
- Badge na tela de Leads
- Filtro por temperatura na tela de Leads

---

## FASE 2 — Motor Comercial

### DEV-05 — Catálogo de serviços + motor de precificação
> Admin cadastra serviços com regras de preço; IA monta propostas automaticamente.

**Banco:**
- `services(id, tenant_id, name, description, billing_type: fixed|per_unit|formula, unit_label, base_price, min_price, is_active)`
- `service_pricing_tiers(id, service_id, min_units, max_units, price_per_unit)` ← faixas (ex: até 15 = fixo R$300, acima = R$8,90/vida)

**UI:**
- Página `/app/settings/services` — CRUD de serviços
- Simulador de orçamento — admin testa o cálculo

**Como a IA usa:**
- O sistema serializa o catálogo de serviços + regras no prompt da IA
- A IA monta a proposta em texto formatado no WhatsApp
- Formato da proposta é configurável nas instruções do playbook

---

### DEV-06 — Playbook de conversa (roteiro estruturado)
> Admin escreve o roteiro em texto estruturado; a IA segue a lógica durante a conversa.

**Banco:**
- `playbooks(id, tenant_id, name, trigger: new_contact|keyword|manual, is_active, content)`
  - `content` = texto estruturado com seções: Objetivo, Dados a coletar, Diagnóstico, Orçamento, Objeções, Fechamento, Transferir para humano quando

**UI:**
- Página `/app/settings/playbook` — editor de texto com template pré-preenchido
- Preview de como a IA interpretará o roteiro

**Como funciona:**
```
Sistema injeta no prompt:
  [ROTEIRO ATIVO]
  Objetivo: qualificar lead e gerar orçamento
  Dados a coletar: nome, empresa, CNPJ, setor, nº funcionários
  Lógica de preço: [catálogo serializado]
  Transferir para humano quando: pedir desconto, empresa >100 funcionários
  ...
```

---

## FASE 3 — Automação (Inngest)

### DEV-07 — Follow-up automático
> Sequência de mensagens agendadas quando lead para de responder.

**Banco:**
- `followup_sequences(id, tenant_id, name, is_active)`
- `followup_steps(id, sequence_id, delay_hours, message_template)`
- `followup_enrollments(id, conversation_id, sequence_id, current_step, next_run_at, status: active|paused|completed)`

**Inngest functions:**
- `followup/check` — roda a cada hora, verifica `next_run_at <= now`, envia mensagem via WhatsApp
- `followup/enroll` — acionado quando conversa entra em status `waiting_human` por >X horas sem resposta
- `followup/cancel` — acionado quando cliente responde (cancela sequência ativa)

**UI:**
- Página `/app/settings/followup` — configura sequências e steps
- Badge no lead mostrando se está em follow-up ativo

---

## FASE 4 — Analytics

### DEV-08 — Dashboard de métricas
> Funil, origens, conversão, valor em pipeline.

**UI — Página `/app/analytics`:**

**Cards de hoje:**
- Leads recebidos, Orçamentos gerados, Propostas enviadas, Fechamentos

**Gráficos:**
- Funil de conversão (Novo → Fechado)
- Leads por dia (últimos 30 dias)
- Origem dos leads (campanha/canal)
- Distribuição por temperatura (quente/morno/frio)

**Tabela:**
- Top leads quentes do dia

---

## FASE 5 — Polimento

### DEV-09 — Configurações gerais do tenant
- Nome da empresa, logo, timezone, idioma
- Gestão de usuários (convidar, remover, trocar papel)
- Página `/app/settings`

### DEV-10 — Notificações internas
- Badge no sidebar quando há lead quente novo
- Notificação quando deal muda de etapa
- Alerta quando follow-up não pôde ser enviado

---

## Ordem de implementação sugerida

```
DEV-02  Campos customizados         ← desbloqueia coleta de dados estruturada
DEV-03  Funil / Deals               ← dá visão comercial imediata
DEV-04  Lead scoring (hot/warm)     ← pequeno, alto impacto visual
DEV-05  Catálogo de serviços        ← habilita orçamento automático
DEV-06  Playbook de conversa        ← IA vira consultor de verdade
DEV-07  Follow-up (Inngest)         ← retenção automática
DEV-08  Analytics                   ← fechamento do ciclo comercial
DEV-09  Configurações               ← polimento
DEV-10  Notificações                ← polimento
```

---

## Status

| Task | Status |
|---|---|
| DEV-01 | ✅ Concluído (plataforma multi-tenant, convites, IA OpenAI) |
| DEV-02 | ✅ Concluído (campos customizados + coleta via IA) |
| DEV-03 | ✅ Concluído (funil / deals kanban) |
| DEV-04 | ✅ Concluído (temperatura hot/warm/cold) |
| DEV-05 | ✅ Concluído (catálogo + motor de preço + simulador) |
| DEV-06 | 🔲 Aguardando |
| DEV-07 | 🔲 Aguardando |
| DEV-08 | 🔲 Aguardando |
| DEV-09 | 🔲 Aguardando |
| DEV-10 | 🔲 Aguardando |
