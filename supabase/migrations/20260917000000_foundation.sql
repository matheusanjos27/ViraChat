-- ViraChat Fase 1 — schema mínimo + RLS
-- Conversas/mensagens/canais entram nas Fases 2–3; estados já definidos para uso futuro.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'supervisor', 'agent');

create type public.conversation_status as enum (
  'ai_active',
  'waiting_human',
  'human_active',
  'resolved'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_tenant_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role public.app_role not null default 'admin',
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table public.providers (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.providers (id, name) values ('whatsapp', 'WhatsApp');

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider_id text not null references public.providers (id),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  channel_id uuid not null unique references public.channels (id) on delete cascade,
  phone_number_id text not null,
  waba_id text not null,
  access_token_encrypted text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  display_name text,
  phone_e164 text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contacts_tenant_external_idx
  on public.contacts (tenant_id, external_id)
  where external_id is not null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  status public.conversation_status not null default 'ai_active',
  assigned_to uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_tenant_status_idx
  on public.conversations (tenant_id, status, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('contact', 'ai', 'agent', 'system')),
  sender_user_id uuid references public.profiles (id) on delete set null,
  body text,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create table public.ai_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants (id) on delete cascade,
  name text not null default 'Assistente',
  instructions text not null default 'Você é um assistente de atendimento da empresa. Seja útil, claro e educado. Se o cliente pedir um humano, sinalize handoff.',
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger channels_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

create trigger whatsapp_accounts_updated_at
  before update on public.whatsapp_accounts
  for each row execute function public.set_updated_at();

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create trigger ai_configs_updated_at
  before update on public.ai_configs
  for each row execute function public.set_updated_at();

-- Membership helper used by RLS policies
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_tenant_roles utr
    where utr.tenant_id = p_tenant_id
      and utr.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create tenant + admin membership + default AI config
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

  insert into public.tenants (name, slug)
  values (p_name, lower(p_slug))
  returning * into v_tenant;

  insert into public.user_tenant_roles (user_id, tenant_id, role)
  values (auth.uid(), v_tenant.id, 'admin');

  insert into public.ai_configs (tenant_id)
  values (v_tenant.id);

  insert into public.audit_logs (tenant_id, user_id, action, metadata)
  values (
    v_tenant.id,
    auth.uid(),
    'tenant.created',
    jsonb_build_object('name', p_name, 'slug', lower(p_slug))
  );

  return v_tenant;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conversation lock helpers (Fase 5; definidos cedo para evitar drift)
-- ---------------------------------------------------------------------------

create or replace function public.assume_conversation(p_conversation_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  update public.conversations c
  set
    status = 'human_active',
    assigned_to = auth.uid(),
    updated_at = now()
  where c.id = p_conversation_id
    and public.is_tenant_member(c.tenant_id)
    and c.status in ('ai_active', 'waiting_human')
  returning * into v_conv;

  if v_conv.id is null then
    raise exception 'Conversation cannot be assumed';
  end if;

  return v_conv;
end;
$$;

create or replace function public.release_conversation_to_ai(p_conversation_id uuid)
returns public.conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
begin
  update public.conversations c
  set
    status = 'ai_active',
    assigned_to = null,
    updated_at = now()
  where c.id = p_conversation_id
    and public.is_tenant_member(c.tenant_id)
    and c.status = 'human_active'
  returning * into v_conv;

  if v_conv.id is null then
    raise exception 'Conversation cannot be released to AI';
  end if;

  return v_conv;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.user_tenant_roles enable row level security;
alter table public.providers enable row level security;
alter table public.channels enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_configs enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: user can read/update own profile; members can read peers in same tenant
create policy profiles_select_own_or_peer
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.user_tenant_roles mine
      join public.user_tenant_roles peer on peer.tenant_id = mine.tenant_id
      where mine.user_id = auth.uid()
        and peer.user_id = profiles.id
    )
  );

create policy profiles_update_own
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Tenants: members only
create policy tenants_select_member
  on public.tenants for select
  using (public.is_tenant_member(id));

create policy tenants_update_admin
  on public.tenants for update
  using (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = tenants.id
        and utr.user_id = auth.uid()
        and utr.role = 'admin'
    )
  );

-- Memberships
create policy utr_select_member
  on public.user_tenant_roles for select
  using (public.is_tenant_member(tenant_id));

create policy utr_insert_admin
  on public.user_tenant_roles for insert
  with check (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = user_tenant_roles.tenant_id
        and utr.user_id = auth.uid()
        and utr.role = 'admin'
    )
  );

-- Providers: readable by authenticated users
create policy providers_select_authenticated
  on public.providers for select
  to authenticated
  using (true);

-- Tenant-scoped tables
create policy channels_tenant_all
  on public.channels for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- whatsapp_accounts: members can select metadata rows but app must never return token
create policy whatsapp_accounts_tenant_all
  on public.whatsapp_accounts for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy contacts_tenant_all
  on public.contacts for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy conversations_tenant_all
  on public.conversations for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy messages_tenant_all
  on public.messages for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy ai_configs_tenant_all
  on public.ai_configs for all
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

create policy audit_logs_tenant_select
  on public.audit_logs for select
  using (tenant_id is not null and public.is_tenant_member(tenant_id));

create policy audit_logs_tenant_insert
  on public.audit_logs for insert
  with check (tenant_id is not null and public.is_tenant_member(tenant_id));

-- Realtime for conversations inbox (Fase 3)
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;

grant usage on schema public to authenticated;
grant select on public.providers to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.tenants to authenticated;
grant select, insert on public.user_tenant_roles to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.whatsapp_accounts to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.ai_configs to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant execute on function public.create_tenant(text, text) to authenticated;
grant execute on function public.assume_conversation(uuid) to authenticated;
grant execute on function public.release_conversation_to_ai(uuid) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
