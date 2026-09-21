-- Sessão da IA: ao retomar após humano/resolvida, não reutilizar o histórico antigo
-- (evita loop de handoff por dados/contexto da venda anterior).

alter table public.conversations
  add column if not exists ai_session_started_at timestamptz;

comment on column public.conversations.ai_session_started_at is
  'Início da sessão atual da IA. Mensagens anteriores não entram no prompt.';

update public.conversations
set ai_session_started_at = coalesce(created_at, now())
where ai_session_started_at is null;

create or replace function public.release_conversation_to_ai(p_conversation_id uuid)
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
    status = 'ai_active',
    assigned_to = null,
    waiting_human_at = null,
    handoff_busy_sent_at = null,
    ai_session_started_at = now(),
    updated_at = now()
  where c.id = p_conversation_id
    and public.is_tenant_member(c.tenant_id)
    and c.status = 'human_active'
  returning * into v_conv;

  if v_conv.id is null then
    raise exception 'Conversation cannot be released to AI';
  end if;

  return v_conv;
end;
$$;
