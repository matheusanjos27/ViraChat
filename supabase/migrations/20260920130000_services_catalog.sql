-- DEV-05 — Catálogo de serviços + regras de preço (genérico)

create type public.billing_type as enum ('fixed', 'per_unit', 'tiered');
create type public.tier_price_mode as enum ('flat', 'per_unit');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  description text,
  billing_type public.billing_type not null default 'fixed',
  unit_label text not null default 'unidade',
  -- chave do contact_attribute que alimenta a quantidade (ex: tamanho)
  unit_attribute_key text,
  base_price numeric(12, 2) not null default 0,
  min_price numeric(12, 2),
  currency text not null default 'BRL',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_tenant_sort_idx
  on public.services (tenant_id, sort_order);

create table public.service_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  min_units int not null default 1,
  max_units int, -- null = sem teto
  price numeric(12, 2) not null,
  price_mode public.tier_price_mode not null default 'flat',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint service_pricing_tiers_range check (
    max_units is null or max_units >= min_units
  )
);

create index service_pricing_tiers_service_idx
  on public.service_pricing_tiers (service_id, sort_order);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.service_pricing_tiers enable row level security;

create policy services_tenant_all
  on public.services for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy service_pricing_tiers_tenant_all
  on public.service_pricing_tiers for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.service_pricing_tiers to authenticated;
