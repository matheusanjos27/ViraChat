-- Contatos vindos da landing (LGPD)

create table if not exists public.site_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  lgpd_consent boolean not null default false,
  lgpd_consent_at timestamptz,
  lgpd_text_version text not null default 'v1',
  source text not null default 'landing',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists site_contacts_created_idx
  on public.site_contacts (created_at desc);

create index if not exists site_contacts_email_idx
  on public.site_contacts (email);

comment on table public.site_contacts is
  'Leads do site. Consentimento LGPD obrigatório para contato comercial.';

alter table public.site_contacts enable row level security;

-- Somente service role / platform admin lê; insert via service role na API.
drop policy if exists site_contacts_platform_select on public.site_contacts;
create policy site_contacts_platform_select on public.site_contacts
  for select to authenticated
  using (public.is_platform_admin());
