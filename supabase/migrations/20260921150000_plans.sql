-- Plans + tenant assignment + AI reply metering

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  max_members int not null check (max_members >= 1 and max_members <= 500),
  max_channels int not null check (max_channels >= 1 and max_channels <= 100),
  max_ai_replies_month int not null check (max_ai_replies_month >= 0),
  is_custom boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plans is
  'Planos comerciais. is_custom=true = Personalizado (limites por tenant via overrides).';

insert into public.plans (slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom, sort_order)
values
  (
    'basico',
    'Básico',
    'Para começar: equipe enxuta, até 2 WhatsApps e 500 respostas de IA por mês.',
    2,
    2,
    500,
    false,
    10
  ),
  (
    'medio',
    'Médio',
    'Para crescer: até 5 pessoas, 5 WhatsApps e 2.000 respostas de IA por mês.',
    5,
    5,
    2000,
    false,
    20
  ),
  (
    'personalizado',
    'Personalizado',
    'Limites definidos sob medida para cada empresa.',
    10,
    10,
    5000,
    true,
    30
  )
on conflict (slug) do nothing;

alter table public.tenants
  add column if not exists plan_id uuid references public.plans (id);

alter table public.tenants
  add column if not exists custom_max_members int
    check (custom_max_members is null or (custom_max_members >= 1 and custom_max_members <= 500));

alter table public.tenants
  add column if not exists custom_max_channels int
    check (custom_max_channels is null or (custom_max_channels >= 1 and custom_max_channels <= 100));

alter table public.tenants
  add column if not exists custom_max_ai_replies_month int
    check (custom_max_ai_replies_month is null or custom_max_ai_replies_month >= 0);

comment on column public.tenants.custom_max_members is
  'Override quando plano Personalizado (ou ajuste pontual).';
comment on column public.tenants.custom_max_channels is
  'Conta todos os WhatsApps do tenant, inclusive desconectados.';
comment on column public.tenants.custom_max_ai_replies_month is
  'Teto de respostas IA/mês. Mudança de plano só altera o teto (não zera o uso).';

-- Default existing tenants to Básico
update public.tenants t
set plan_id = p.id,
    max_members = coalesce(t.max_members, p.max_members)
from public.plans p
where p.slug = 'basico'
  and t.plan_id is null;

create table if not exists public.ai_reply_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_reply_events_tenant_created_idx
  on public.ai_reply_events (tenant_id, created_at desc);

create table if not exists public.ai_test_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists ai_test_events_tenant_created_idx
  on public.ai_test_events (tenant_id, created_at desc);

alter table public.plans enable row level security;
alter table public.ai_reply_events enable row level security;
alter table public.ai_test_events enable row level security;

-- Authenticated can read plans (tenant UI); writes via service role / platform.
drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated on public.plans
  for select to authenticated
  using (true);
