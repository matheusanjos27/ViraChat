-- WhatsApp via Evolution API (Baileys): QR multi-número por tenant

alter table public.whatsapp_accounts
  drop constraint if exists whatsapp_accounts_onboard_source_check;

alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_onboard_source_check
  check (
    onboard_source in (
      'manual',
      'embedded_signup',
      'business_app',
      'baileys'
    )
  );

alter table public.whatsapp_accounts
  add column if not exists connection_status text not null default 'open'
    check (connection_status in ('pending_qr', 'open', 'close'));

comment on column public.whatsapp_accounts.onboard_source is
  'manual/embedded_signup/business_app = Meta Cloud API; baileys = Evolution/Baileys (QR)';

comment on column public.whatsapp_accounts.connection_status is
  'pending_qr = aguardando scan; open = conectado; close = desconectado';

comment on column public.whatsapp_accounts.phone_number_id is
  'Meta: Phone Number ID. Baileys: nome da instância Evolution.';

comment on column public.whatsapp_accounts.waba_id is
  'Meta: WABA ID. Baileys: literal ''evolution''.';
