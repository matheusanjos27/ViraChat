-- Tentativas de CNPJ inválido/incompleto (validação em código, sem LLM).

alter table public.conversations
  add column if not exists ai_cnpj_attempts int not null default 0
    check (ai_cnpj_attempts >= 0 and ai_cnpj_attempts <= 20);

comment on column public.conversations.ai_cnpj_attempts is
  'Quantas vezes o cliente enviou CNPJ inválido/incompleto nesta sessão.';

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
    handoff_offer_pending_at = null,
    ai_spam_flags = 0,
    ai_spam_blocked_at = null,
    ai_cnpj_attempts = 0,
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
