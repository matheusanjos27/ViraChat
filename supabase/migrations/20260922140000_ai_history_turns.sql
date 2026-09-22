-- Quantas mensagens anteriores a IA mantém no prompt (por tenant).

alter table public.tenants
  add column if not exists ai_history_turns int not null default 24
    check (ai_history_turns >= 4 and ai_history_turns <= 40);

comment on column public.tenants.ai_history_turns is
  'Mensagens anteriores injetadas no prompt da IA (4–40). Default 24.';
