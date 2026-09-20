-- DEV-01: platform super admin + provisioned tenants (no self-serve)

create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Platform admins can see the list of platform admins (themselves / peers)
create policy platform_admins_select_self
  on public.platform_admins for select
  using (public.is_platform_admin());

-- Only service role / security definer flows insert; no direct client insert
revoke insert, update, delete on public.platform_admins from authenticated;
grant select on public.platform_admins to authenticated;

-- Replace create_tenant: only platform admins; do NOT auto-attach creator as tenant member
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

-- Attach a user to a tenant (platform admin only)
create or replace function public.platform_add_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role public.app_role default 'admin'
)
returns public.user_tenant_roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_tenant_roles;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Only platform admins can add tenant members';
  end if;

  insert into public.user_tenant_roles (user_id, tenant_id, role)
  values (p_user_id, p_tenant_id, p_role)
  on conflict (user_id, tenant_id) do update
    set role = excluded.role
  returning * into v_row;

  insert into public.audit_logs (tenant_id, user_id, action, metadata)
  values (
    p_tenant_id,
    auth.uid(),
    'tenant.member_added',
    jsonb_build_object('member_user_id', p_user_id, 'role', p_role)
  );

  return v_row;
end;
$$;

grant execute on function public.platform_add_tenant_member(uuid, uuid, public.app_role) to authenticated;

-- Pending invites (email not yet a user, or waiting accept)
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role public.app_role not null default 'admin',
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

alter table public.tenant_invites enable row level security;

create policy tenant_invites_platform_all
  on public.tenant_invites for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Tenant admins can see invites of their tenant (optional read)
create policy tenant_invites_tenant_admin_select
  on public.tenant_invites for select
  using (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = tenant_invites.tenant_id
        and utr.user_id = auth.uid()
        and utr.role = 'admin'
    )
  );

grant select, insert, update, delete on public.tenant_invites to authenticated;

-- Allow platform admins to list all tenants
create policy tenants_select_platform_admin
  on public.tenants for select
  using (public.is_platform_admin());

create policy tenants_insert_platform_admin
  on public.tenants for insert
  with check (public.is_platform_admin());
