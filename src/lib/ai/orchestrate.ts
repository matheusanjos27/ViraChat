import { getDefaultAiProvider } from "@/lib/ai/providers/openai";
import type { AiChatMessage } from "@/lib/ai/types";
import { decryptToken } from "@/lib/crypto/tokens";
import { canAiReply } from "@/lib/conversations/status";
import { sendWhatsAppText } from "@/lib/meta/whatsapp";
import { createServiceClient } from "@/lib/supabase/admin";

export async function runAiForConversation(conversationId: string) {
  const supabase = createServiceClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, status, channel_id, contact_id, contacts(phone_e164, external_id), channels(id, whatsapp_accounts(phone_number_id, access_token_encrypted))",
    )
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.warn("[ai] conversation missing", conversationId, convError);
    return { skipped: "missing_conversation" as const };
  }

  // Lock: re-read status before answering
  if (!canAiReply(conversation.status)) {
    return { skipped: "not_ai_active" as const, status: conversation.status };
  }

  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("name, instructions, is_enabled")
    .eq("tenant_id", conversation.tenant_id)
    .maybeSingle();

  if (!aiConfig?.is_enabled) {
    return { skipped: "ai_disabled" as const };
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("body, direction, sender_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(30);

  const latestInbound = [...(messages ?? [])]
    .reverse()
    .find((m) => m.direction === "inbound" && m.body);
  if (!latestInbound?.body) {
    return { skipped: "no_inbound" as const };
  }

  const history: AiChatMessage[] = (messages ?? [])
    .filter((m) => m.body)
    .slice(0, -1)
    .map((m) => ({
      role:
        m.direction === "inbound"
          ? ("user" as const)
          : ("assistant" as const),
      content: m.body as string,
    }));

  const provider = getDefaultAiProvider();
  const result = await provider.generateReply({
    agentName: aiConfig.name,
    instructions: aiConfig.instructions,
    history,
    latestUserMessage: latestInbound.body,
  });

  // Re-check lock after LLM latency
  const { data: fresh } = await supabase
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();

  if (!fresh || !canAiReply(fresh.status)) {
    return { skipped: "status_changed" as const, status: fresh?.status };
  }

  const contact = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
  } | null;

  const channel = conversation.channels as unknown as {
    whatsapp_accounts:
      | { phone_number_id: string; access_token_encrypted: string }
      | { phone_number_id: string; access_token_encrypted: string }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  if (!wa || !to) {
    return { skipped: "missing_channel_or_contact" as const };
  }

  const outboundText =
    result.action === "handoff"
      ? result.text ||
        "Vou te transferir para um atendente humano. Aguarde um momento."
      : result.text;

  let providerMessageId: string | null = null;
  try {
    const token = decryptToken(wa.access_token_encrypted);
    providerMessageId = await sendWhatsAppText({
      phoneNumberId: wa.phone_number_id,
      accessToken: token,
      toE164: to,
      body: outboundText,
    });
  } catch (err) {
    console.error("[ai] send failed", err);
    return {
      error: err instanceof Error ? err.message : "send_failed",
    };
  }

  const now = new Date().toISOString();
  await supabase.from("messages").insert({
    tenant_id: conversation.tenant_id,
    conversation_id: conversationId,
    direction: "outbound",
    sender_type: "ai",
    body: outboundText,
    provider_message_id: providerMessageId,
    created_at: now,
  });

  if (result.action === "handoff") {
    await supabase
      .from("conversations")
      .update({
        status: "waiting_human",
        last_message_at: now,
      })
      .eq("id", conversationId)
      .eq("status", "ai_active");
  } else {
    await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);
  }

  return {
    ok: true as const,
    action: result.action,
    conversationId,
  };
}
