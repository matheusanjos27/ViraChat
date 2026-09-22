-- Fechamento da IA configurável + histórico global da plataforma.

do $$ begin
  create type public.ai_close_mode as enum ('handoff', 'callback');
exception
  when duplicate_object then null;
end $$;

alter table public.ai_configs
  add column if not exists close_mode public.ai_close_mode not null default 'handoff';

comment on column public.ai_configs.close_mode is
  'handoff = oferecer atendente; callback = encerrar e equipe retorna depois.';

create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  ai_history_turns int not null default 24
    check (ai_history_turns >= 4 and ai_history_turns <= 40),
  updated_at timestamptz not null default now()
);

comment on table public.platform_settings is
  'Configurações globais do super admin (uma linha).';

insert into public.platform_settings (id, ai_history_turns)
values (1, 24)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_admin_all on public.platform_settings;
create policy platform_settings_admin_all
  on public.platform_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, update on public.platform_settings to authenticated;
