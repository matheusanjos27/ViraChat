-- Tipo do item no catálogo: produto (bem físico/digital) ou serviço.

do $$ begin
  create type public.offer_kind as enum ('product', 'service');
exception
  when duplicate_object then null;
end $$;

alter table public.services
  add column if not exists offer_kind public.offer_kind not null default 'product';

comment on column public.services.offer_kind is
  'product = produto; service = serviço. Usado no prompt da IA.';
