-- Demo layout: 1 contato + conversa + 4 mensagens (Cliente Exemplo)
-- Rode no SQL Editor do Supabase.
-- Pré-requisito: exista pelo menos 1 tenant (e você seja membro dele).

do $$
declare
  v_tenant_id uuid;
  v_channel_id uuid;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_now timestamptz := now();
begin
  select id into v_tenant_id
  from public.tenants
  order by created_at asc
  limit 1;

  if v_tenant_id is null then
    raise exception 'Nenhum tenant encontrado. Crie um tenant no /platform antes.';
  end if;

  select id into v_channel_id
  from public.channels
  where tenant_id = v_tenant_id
  order by created_at asc
  limit 1;

  if v_channel_id is null then
    insert into public.channels (tenant_id, provider_id, display_name, is_active)
    values (v_tenant_id, 'whatsapp', 'WhatsApp Demo', true)
    returning id into v_channel_id;
  end if;

  insert into public.contacts (tenant_id, display_name, phone_e164, external_id)
  values (
    v_tenant_id,
    'Cliente Exemplo',
    '+5511987654321',
    '5511987654321'
  )
  on conflict do nothing
  returning id into v_contact_id;

  if v_contact_id is null then
    select id into v_contact_id
    from public.contacts
    where tenant_id = v_tenant_id
      and (phone_e164 = '+5511987654321' or external_id = '5511987654321')
    limit 1;
  end if;

  -- Se o unique index não pegar (sem conflict), garante insert
  if v_contact_id is null then
    insert into public.contacts (tenant_id, display_name, phone_e164, external_id)
    values (v_tenant_id, 'Cliente Exemplo', '+5511987654321', '5511987654321')
    returning id into v_contact_id;
  end if;

  insert into public.conversations (
    tenant_id, channel_id, contact_id, status, last_message_at
  )
  values (
    v_tenant_id, v_channel_id, v_contact_id, 'ai_active', v_now
  )
  returning id into v_conversation_id;

  insert into public.messages (
    tenant_id, conversation_id, direction, sender_type, body, created_at
  ) values
    (
      v_tenant_id, v_conversation_id, 'inbound', 'contact',
      'Olá, tenho uma dúvida sobre o meu pedido.',
      v_now - interval '4 minutes'
    ),
    (
      v_tenant_id, v_conversation_id, 'outbound', 'ai',
      'Olá! Claro, pode me informar o número do seu pedido? Vou verificar aqui para você.',
      v_now - interval '3 minutes'
    ),
    (
      v_tenant_id, v_conversation_id, 'inbound', 'contact',
      'É o #4587. Obrigado!',
      v_now - interval '2 minutes'
    ),
    (
      v_tenant_id, v_conversation_id, 'outbound', 'ai',
      'Perfeito! Já localizei seu pedido. Ele está em separação e deve ser enviado ainda hoje. Qualquer outra dúvida, estou à disposição! 😉',
      v_now - interval '1 minute'
    );

  raise notice 'OK tenant=% conversation=% contact=%',
    v_tenant_id, v_conversation_id, v_contact_id;
end $$;
