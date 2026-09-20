import { createServiceClient } from "@/lib/supabase/admin";

type InboundText = {
  phoneNumberId: string;
  fromWaId: string;
  contactName?: string;
  messageId: string;
  text: string;
  timestamp?: string;
};

export async function ingestInboundTextMessage(msg: InboundText) {
  const supabase = createServiceClient();

  const { data: account, error: accountError } = await supabase
    .from("whatsapp_accounts")
    .select("id, tenant_id, channel_id")
    .eq("phone_number_id", msg.phoneNumberId)
    .maybeSingle();

  if (accountError) throw accountError;
  if (!account) {
    console.warn("[webhook] unknown phone_number_id", msg.phoneNumberId);
    return { skipped: true as const };
  }

  await supabase
    .from("whatsapp_accounts")
    .update({ last_webhook_at: new Date().toISOString() })
    .eq("id", account.id);

  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("tenant_id", account.tenant_id)
    .eq("provider_message_id", msg.messageId)
    .maybeSingle();

  if (existingMsg) {
    return { duplicate: true as const };
  }

  let contactId: string;
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("tenant_id", account.tenant_id)
    .eq("external_id", msg.fromWaId)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id;
    if (msg.contactName) {
      await supabase
        .from("contacts")
        .update({
          display_name: msg.contactName,
          phone_e164: `+${msg.fromWaId}`,
        })
        .eq("id", contactId);
    }
  } else {
    const { data: created, error: contactError } = await supabase
      .from("contacts")
      .insert({
        tenant_id: account.tenant_id,
        external_id: msg.fromWaId,
        phone_e164: `+${msg.fromWaId}`,
        display_name: msg.contactName ?? msg.fromWaId,
      })
      .select("id")
      .single();
    if (contactError) throw contactError;
    contactId = created.id;
  }

  let conversationId: string;
  const { data: openConv } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("tenant_id", account.tenant_id)
    .eq("channel_id", account.channel_id)
    .eq("contact_id", contactId)
    .neq("status", "resolved")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openConv) {
    conversationId = openConv.id;
  } else {
    const { data: resolved } = await supabase
      .from("conversations")
      .select("id")
      .eq("tenant_id", account.tenant_id)
      .eq("channel_id", account.channel_id)
      .eq("contact_id", contactId)
      .eq("status", "resolved")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resolved) {
      const { data: reopened, error: reopenError } = await supabase
        .from("conversations")
        .update({
          status: "ai_active",
          assigned_to: null,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", resolved.id)
        .select("id")
        .single();
      if (reopenError) throw reopenError;
      conversationId = reopened.id;
    } else {
      const { data: createdConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          tenant_id: account.tenant_id,
          channel_id: account.channel_id,
          contact_id: contactId,
          status: "ai_active",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (convError) throw convError;
      conversationId = createdConv.id;
    }
  }

  const createdAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { error: messageError } = await supabase.from("messages").insert({
    tenant_id: account.tenant_id,
    conversation_id: conversationId,
    direction: "inbound",
    sender_type: "contact",
    body: msg.text,
    provider_message_id: msg.messageId,
    created_at: createdAt,
  });
  if (messageError) throw messageError;

  await supabase
    .from("conversations")
    .update({ last_message_at: createdAt })
    .eq("id", conversationId);

  return {
    ok: true as const,
    tenantId: account.tenant_id,
    conversationId,
    contactId,
  };
}
