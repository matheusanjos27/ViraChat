-- Fase 2: WhatsApp Cloud API — campos extras e unicidade global do phone_number_id

alter table public.whatsapp_accounts
  add column if not exists display_phone text,
  add column if not exists verified_name text,
  add column if not exists quality_rating text,
  add column if not exists onboard_source text not null default 'manual'
    check (onboard_source in ('manual', 'embedded_signup', 'business_app')),
  add column if not exists meta_business_id text,
  add column if not exists last_webhook_at timestamptz;

create unique index if not exists whatsapp_accounts_phone_number_id_uidx
  on public.whatsapp_accounts (phone_number_id);

create unique index if not exists messages_provider_message_id_uidx
  on public.messages (tenant_id, provider_message_id)
  where provider_message_id is not null;

comment on column public.whatsapp_accounts.onboard_source is
  'manual = token/IDs colados; embedded_signup = fluxo Meta; business_app = migração do app WhatsApp Business';
