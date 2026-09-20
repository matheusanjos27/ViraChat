# DEV-05 — Catálogo de serviços + motor de precificação

## Entregue

### Banco
- `services` — fixed | per_unit | tiered
- `service_pricing_tiers` — faixas com preço flat ou por unidade
- `unit_attribute_key` — liga quantidade a um campo do lead (ex: `tamanho`)

### UI `/app/settings/services`
- CRUD de serviços
- Editor de faixas
- **Simulador ao vivo** com preview da mensagem de proposta

### Motor (`src/lib/crm/pricing.ts`)
- `quoteService` / `quoteCatalog`
- Serialização para prompt da IA
- Orçamento pré-calculado injetado quando a quantidade já foi coletada
- Valor do deal atualizado automaticamente

### Exemplo genérico (Eduardo / qualquer)
- Faixa 1–15: preço fixo do plano
- Faixa 16+: por unidade com mínimo
- Sem hardcode de PGR/PCMSO — cada tenant cadastra o próprio catálogo
