-- Anexos recebidos no WhatsApp (por lead/contato)

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  kind text not null
    check (kind in ('image', 'document', 'audio', 'video', 'sticker', 'other')),
  file_name text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  storage_key text,
  status text not null default 'pending'
    check (status in ('stored', 'rejected_too_large', 'failed', 'pending')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_contact_idx
  on public.message_attachments (tenant_id, contact_id, created_at desc);

create index if not exists message_attachments_conversation_idx
  on public.message_attachments (conversation_id, created_at desc);

alter table public.message_attachments enable row level security;

drop policy if exists message_attachments_tenant_select on public.message_attachments;
create policy message_attachments_tenant_select
  on public.message_attachments for select
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.user_tenant_roles utr
      where utr.tenant_id = message_attachments.tenant_id
        and utr.user_id = auth.uid()
    )
  );

grant select on public.message_attachments to authenticated;
grant select, insert, update, delete on public.message_attachments to service_role;

comment on table public.message_attachments is
  'Arquivos enviados pelo contato no WhatsApp (limite de tamanho aplicado na ingestão).';
