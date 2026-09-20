-- Company profile fields used by AI + settings UI

alter table public.tenants
  add column if not exists about text,
  add column if not exists website text,
  add column if not exists phone text;
