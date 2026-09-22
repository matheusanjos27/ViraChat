-- Consentimento LGPD no contato do CRM (WhatsApp / IA)
alter table public.contacts
  add column if not exists lgpd_consent boolean not null default false,
  add column if not exists lgpd_consent_at timestamptz,
  add column if not exists lgpd_consent_version text;

comment on column public.contacts.lgpd_consent is
  'Lead autorizou tratamento de dados para orçamento/atendimento (LGPD).';
comment on column public.contacts.lgpd_consent_version is
  'Versão do texto de consentimento apresentado pela IA.';
