import { decryptToken } from "@/lib/crypto/tokens";
import { createAppNotification } from "@/lib/notifications";
import { sendOutboundText } from "@/lib/whatsapp/send";
import { createServiceClient } from "@/lib/supabase/admin";

export const HANDOFF_TIMEOUT_MS = 5 * 60 * 1000;

export const HANDOFF_BUSY_MESSAGE =
  "Infelizmente neste momento todos os nossos atendentes estão ocupados. Assim que possível alguém vai te atender, ok? Obrigado pela compreensão.";

/** Process conversations waiting for a human longer than 5 minutes. */
export async function processHandoffTimeouts(now = new Date()) {
  const supabase = createServiceClient();
  const cutoff = new Date(now.getTime() - HANDOFF_TIMEOUT_MS).toISOString();

  const { data: overdue, error } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, contact_id, channel_id, waiting_human_at, contacts(phone_e164, external_id, display_name), channels(whatsapp_accounts(phone_number_id, access_token_encrypted, onboard_source))",
    )
    .eq("status", "waiting_human")
    .is("handoff_busy_sent_at", null)
    .not("waiting_human_at", "is", null)
    .lte("waiting_human_at", cutoff)
    .limit(50);

  if (error) {
    console.error("[handoff-timeout] query failed", error.message);
    return { processed: 0, error: error.message };
  }

  let processed = 0;
  for (const row of overdue ?? []) {
    const ok = await sendBusyMessageForConversation(row.id);
    if (ok) processed += 1;
  }

  return { processed };
}

export async function sendBusyMessageForConversation(conversationId: string) {
  const supabase = createServiceClient();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, status, waiting_human_at, handoff_busy_sent_at, contacts(phone_e164, external_id, display_name), channels(whatsapp_accounts(phone_number_id, access_token_encrypted))",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conversation) return false;
  if (conversation.status !== "waiting_human") return false;
  if (conversation.handoff_busy_sent_at) return false;
  if (!conversation.waiting_human_at) return false;

  const waitedMs =
    Date.now() - new Date(conversation.waiting_human_at).getTime();
  if (waitedMs < HANDOFF_TIMEOUT_MS) return false;

  const contact = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
  } | null;

  const channel = conversation.channels as unknown as {
    whatsapp_accounts:
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  if (!wa || !to) return false;

  const now = new Date().toISOString();

  // Claim first to avoid double-send under concurrent crons
  const { data: claimed, error: claimError } = await supabase
    .from("conversations")
    .update({ handoff_busy_sent_at: now })
    .eq("id", conversationId)
    .eq("status", "waiting_human")
    .is("handoff_busy_sent_at", null)
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) return false;

  try {
    const token = decryptToken(wa.access_token_encrypted);
    const providerMessageId = await sendOutboundText({
      channel: wa,
      accessToken: token,
      toE164: to,
      body: HANDOFF_BUSY_MESSAGE,
    });

    await supabase.from("messages").insert({
      tenant_id: conversation.tenant_id,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: "ai",
      body: HANDOFF_BUSY_MESSAGE,
      provider_message_id: providerMessageId,
      created_at: now,
    });

    await createAppNotification({
      tenantId: conversation.tenant_id,
      type: "handoff_busy",
      title: "Cliente aguardando há +5 min",
      body: `${contact?.display_name || contact?.phone_e164 || "Contato"} ainda sem atendente. Já avisamos que a equipe está ocupada.`,
      conversationId,
    });

    return true;
  } catch (err) {
    console.error("[handoff-timeout] send failed", conversationId, err);
    // Allow retry
    await supabase
      .from("conversations")
      .update({ handoff_busy_sent_at: null })
      .eq("id", conversationId);
    return false;
  }
}
