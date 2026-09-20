-- Handoff notifications + 5min busy timeout tracking

alter table public.conversations
  add column if not exists waiting_human_at timestamptz,
  add column if not exists handoff_busy_sent_at timestamptz;

create index if not exists conversations_waiting_human_at_idx
  on public.conversations (waiting_human_at)
  where status = 'waiting_human' and waiting_human_at is not null;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  type text not null default 'handoff',
  title text not null,
  body text,
  conversation_id uuid references public.conversations (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_tenant_unread_idx
  on public.app_notifications (tenant_id, created_at desc)
  where read_at is null;

create index if not exists app_notifications_tenant_created_idx
  on public.app_notifications (tenant_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists app_notifications_tenant_select on public.app_notifications;
create policy app_notifications_tenant_select
  on public.app_notifications for select
  using (public.is_tenant_member(tenant_id));

drop policy if exists app_notifications_tenant_update on public.app_notifications;
create policy app_notifications_tenant_update
  on public.app_notifications for update
  using (public.is_tenant_member(tenant_id));

grant select, update on public.app_notifications to authenticated;
grant select, insert, update, delete on public.app_notifications to service_role;

do $$
begin
  alter publication supabase_realtime add table public.app_notifications;
exception
  when duplicate_object then null;
end $$;

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
    waiting_human_at = null,
    handoff_busy_sent_at = null,
    updated_at = now()
  where c.id = p_conversation_id
    and public.is_tenant_member(c.tenant_id)
    and c.status in ('ai_active', 'waiting_human')
  returning * into v_conv;

  if v_conv.id is null then
    raise exception 'conversation not assumable';
  end if;

  update public.app_notifications n
  set read_at = now()
  where n.conversation_id = p_conversation_id
    and n.read_at is null;

  return v_conv;
end;
$$;
