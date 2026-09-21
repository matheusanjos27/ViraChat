-- AI token budget per tenant (platform-enforced)

alter table public.tenants
  add column if not exists monthly_ai_token_limit integer not null default 2000000
    check (monthly_ai_token_limit >= 0);

comment on column public.tenants.monthly_ai_token_limit is
  'Cota mensal de tokens OpenAI. 0 = ilimitado. Default 2_000_000 (~1 canal médio).';
