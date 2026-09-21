-- Platform ops: billing fields + AI token usage

alter table public.tenants
  add column if not exists monthly_fee_cents integer not null default 0
    check (monthly_fee_cents >= 0);

alter table public.tenants
  add column if not exists billing_status text not null default 'active'
    check (billing_status in ('trial', 'active', 'past_due', 'canceled'));

comment on column public.tenants.monthly_fee_cents is
  'Valor mensal que o cliente paga à plataforma (centavos BRL).';
comment on column public.tenants.billing_status is
  'trial | active | past_due | canceled';

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'openai',
  model text not null default 'unknown',
  prompt_tokens integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens integer not null default 0 check (completion_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_tenant_created_idx
  on public.ai_usage_events (tenant_id, created_at desc);

create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists ai_usage_events_platform_select on public.ai_usage_events;
-- Platform admin reads via service role / RPC; tenant members don't need this table in UI.
-- Allow service_role full access (default). Authenticated: only platform admins via is_platform_admin().

drop policy if exists ai_usage_events_admin_select on public.ai_usage_events;
create policy ai_usage_events_admin_select
  on public.ai_usage_events for select
  using (public.is_platform_admin());

grant select on public.ai_usage_events to authenticated;
grant select, insert, update, delete on public.ai_usage_events to service_role;
