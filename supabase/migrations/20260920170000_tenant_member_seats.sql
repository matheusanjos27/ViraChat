-- Seat limit per tenant: default = empresa + 1 colaborador (2)

alter table public.tenants
  add column if not exists max_members int not null default 2
    check (max_members >= 1 and max_members <= 500);

comment on column public.tenants.max_members is
  'Máximo de usuários no tenant (padrão 2 = empresa + 1 colaborador).';

-- Tenant admins can manage invites of their own tenant
drop policy if exists tenant_invites_tenant_admin_insert on public.tenant_invites;
create policy tenant_invites_tenant_admin_insert
  on public.tenant_invites for insert
  with check (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = tenant_invites.tenant_id
        and utr.user_id = auth.uid()
        and utr.role in ('admin', 'supervisor')
    )
  );

drop policy if exists tenant_invites_tenant_admin_update on public.tenant_invites;
create policy tenant_invites_tenant_admin_update
  on public.tenant_invites for update
  using (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = tenant_invites.tenant_id
        and utr.user_id = auth.uid()
        and utr.role in ('admin', 'supervisor')
    )
  );

create or replace function public.tenant_member_count(p_tenant_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.user_tenant_roles utr
  where utr.tenant_id = p_tenant_id;
$$;

grant execute on function public.tenant_member_count(uuid) to authenticated;

-- Allow tenant admins to remove collaborators
grant delete on public.user_tenant_roles to authenticated;

drop policy if exists utr_delete_admin on public.user_tenant_roles;
create policy utr_delete_admin
  on public.user_tenant_roles for delete
  using (
    exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = user_tenant_roles.tenant_id
        and utr.user_id = auth.uid()
        and utr.role in ('admin', 'supervisor')
    )
  );
