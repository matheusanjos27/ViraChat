-- DEV-02 / DEV-03 / DEV-04 — CRM base genérico
-- Campos customizados, funil de deals, temperatura do lead

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.attribute_type as enum ('text', 'number', 'select', 'date', 'email', 'phone');
create type public.lead_temperature as enum ('hot', 'warm', 'cold');

-- ---------------------------------------------------------------------------
-- Contact custom attributes (definition per tenant)
-- ---------------------------------------------------------------------------

create table public.contact_attributes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  label text not null,
  type public.attribute_type not null default 'text',
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  collect_via_ai boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  constraint contact_attributes_key_format check (key ~ '^[a-z][a-z0-9_]{0,47}$')
);

create index contact_attributes_tenant_sort_idx
  on public.contact_attributes (tenant_id, sort_order);

create table public.contact_attribute_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  attribute_id uuid not null references public.contact_attributes (id) on delete cascade,
  value text,
  updated_at timestamptz not null default now(),
  unique (contact_id, attribute_id)
);

create index contact_attribute_values_contact_idx
  on public.contact_attribute_values (contact_id);

-- ---------------------------------------------------------------------------
-- Lead temperature on contacts
-- ---------------------------------------------------------------------------

alter table public.contacts
  add column if not exists temperature public.lead_temperature not null default 'warm',
  add column if not exists temperature_updated_at timestamptz,
  add column if not exists email text,
  add column if not exists company_name text,
  add column if not exists notes text;

-- ---------------------------------------------------------------------------
-- Deal pipeline
-- ---------------------------------------------------------------------------

create table public.deal_stages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  color text not null default '#0c6b5c',
  sort_order int not null default 0,
  is_closed_won boolean not null default false,
  is_closed_lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deal_stages_tenant_sort_idx
  on public.deal_stages (tenant_id, sort_order);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  stage_id uuid not null references public.deal_stages (id) on delete restrict,
  title text not null,
  value numeric(12, 2),
  currency text not null default 'BRL',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deals_tenant_stage_idx
  on public.deals (tenant_id, stage_id, updated_at desc);

create index deals_contact_idx
  on public.deals (contact_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger contact_attributes_updated_at
  before update on public.contact_attributes
  for each row execute function public.set_updated_at();

create trigger deal_stages_updated_at
  before update on public.deal_stages
  for each row execute function public.set_updated_at();

create trigger deals_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger contact_attribute_values_updated_at
  before update on public.contact_attribute_values
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed default pipeline + starter fields for a tenant
-- ---------------------------------------------------------------------------

create or replace function public.seed_tenant_crm(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Default deal stages (only if none)
  if not exists (select 1 from public.deal_stages where tenant_id = p_tenant_id) then
    insert into public.deal_stages (tenant_id, name, color, sort_order, is_closed_won, is_closed_lost)
    values
      (p_tenant_id, 'Novo lead',     '#64748b', 0, false, false),
      (p_tenant_id, 'Qualificado',   '#3b82f6', 1, false, false),
      (p_tenant_id, 'Orçamento',     '#8b5cf6', 2, false, false),
      (p_tenant_id, 'Proposta',      '#f59e0b', 3, false, false),
      (p_tenant_id, 'Negociação',    '#ef4444', 4, false, false),
      (p_tenant_id, 'Fechado',       '#16a34a', 5, true,  false),
      (p_tenant_id, 'Perdido',       '#94a3b8', 6, false, true);
  end if;

  -- Starter generic fields (only if none)
  if not exists (select 1 from public.contact_attributes where tenant_id = p_tenant_id) then
    insert into public.contact_attributes
      (tenant_id, key, label, type, required, collect_via_ai, sort_order)
    values
      (p_tenant_id, 'empresa',      'Empresa',           'text',   true,  true, 0),
      (p_tenant_id, 'email',        'E-mail',            'email',  false, true, 1),
      (p_tenant_id, 'responsavel',  'Nome do responsável','text',  true,  true, 2),
      (p_tenant_id, 'setor',        'Setor / ramo',      'text',   false, true, 3),
      (p_tenant_id, 'tamanho',      'Porte (ex: nº pessoas)', 'number', false, true, 4);
  end if;
end;
$$;

grant execute on function public.seed_tenant_crm(uuid) to authenticated;

-- Seed for all existing tenants
do $$
declare
  r record;
begin
  for r in select id from public.tenants loop
    perform public.seed_tenant_crm(r.id);
  end loop;
end;
$$;

-- Hook into create_tenant (platform admin version)
create or replace function public.create_tenant(p_name text, p_slug text)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant public.tenants;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_platform_admin() then
    raise exception 'Only platform admins can create tenants';
  end if;

  insert into public.tenants (name, slug)
  values (p_name, lower(p_slug))
  returning * into v_tenant;

  insert into public.ai_configs (tenant_id)
  values (v_tenant.id);

  perform public.seed_tenant_crm(v_tenant.id);

  insert into public.audit_logs (tenant_id, user_id, action, metadata)
  values (
    v_tenant.id,
    auth.uid(),
    'tenant.created_by_platform',
    jsonb_build_object('name', p_name, 'slug', lower(p_slug))
  );

  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.contact_attributes enable row level security;
alter table public.contact_attribute_values enable row level security;
alter table public.deal_stages enable row level security;
alter table public.deals enable row level security;

create policy contact_attributes_tenant_all
  on public.contact_attributes for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy contact_attribute_values_tenant_all
  on public.contact_attribute_values for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy deal_stages_tenant_all
  on public.deal_stages for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy deals_tenant_all
  on public.deals for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.contact_attributes to authenticated;
grant select, insert, update, delete on public.contact_attribute_values to authenticated;
grant select, insert, update, delete on public.deal_stages to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
