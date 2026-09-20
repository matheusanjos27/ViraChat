import { ingestInboundTextMessage } from "@/lib/whatsapp/ingest";
import { createServiceClient } from "@/lib/supabase/admin";

type EvolutionWebhookBody = {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
};

function eventName(raw?: string) {
  return (raw ?? "").toLowerCase().replace(/_/g, ".");
}

function extractText(message: Record<string, unknown> | undefined): string | null {
  if (!message) return null;
  if (typeof message.conversation === "string") return message.conversation;
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;
  const image = message.imageMessage as { caption?: string } | undefined;
  if (image?.caption) return image.caption;
  const video = message.videoMessage as { caption?: string } | undefined;
  if (video?.caption) return video.caption;
  const buttons = message.buttonsResponseMessage as
    | { selectedDisplayText?: string }
    | undefined;
  if (buttons?.selectedDisplayText) return buttons.selectedDisplayText;
  const list = message.listResponseMessage as
    | { title?: string; singleSelectReply?: { selectedRowId?: string } }
    | undefined;
  if (list?.title) return list.title;
  return null;
}

function jidToWaId(jid: string | undefined): string | null {
  if (!jid) return null;
  // 5511999999999@s.whatsapp.net or 1234567890@lid
  const user = jid.split("@")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  return digits || null;
}

export async function processEvolutionWebhook(payload: EvolutionWebhookBody) {
  const event = eventName(payload.event);
  const instance = payload.instance?.trim();
  if (!instance) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const supabase = createServiceClient();

  if (event === "connection.update") {
    const data = payload.data ?? {};
    const state = String(
      data.state ?? (data as { connection?: string }).connection ?? "",
    ).toLowerCase();

    let connection_status: "pending_qr" | "open" | "close" = "close";
    if (state === "open") connection_status = "open";
    else if (state === "connecting") connection_status = "pending_qr";

    const phone =
      typeof data.wuid === "string"
        ? jidToWaId(data.wuid)
        : typeof (data as { owner?: string }).owner === "string"
          ? jidToWaId((data as { owner: string }).owner)
          : null;

    const patch: {
      connection_status: typeof connection_status;
      last_webhook_at: string;
      display_phone?: string;
    } = {
      connection_status,
      last_webhook_at: new Date().toISOString(),
    };
    if (phone) patch.display_phone = `+${phone}`;

    await supabase
      .from("whatsapp_accounts")
      .update(patch)
      .eq("phone_number_id", instance)
      .eq("onboard_source", "baileys");

    return { handled: 1, conversationIds: [] as string[] };
  }

  if (event === "qrcode.updated") {
    await supabase
      .from("whatsapp_accounts")
      .update({
        connection_status: "pending_qr",
        last_webhook_at: new Date().toISOString(),
      })
      .eq("phone_number_id", instance)
      .eq("onboard_source", "baileys");
    return { handled: 1, conversationIds: [] as string[] };
  }

  if (event !== "messages.upsert") {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const data = payload.data ?? {};
  const key = data.key as
    | { remoteJid?: string; fromMe?: boolean; id?: string }
    | undefined;

  if (!key || key.fromMe) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  // Ignora grupos
  if (key.remoteJid?.endsWith("@g.us")) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const fromWaId = jidToWaId(key.remoteJid);
  if (!fromWaId || !key.id) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const message = data.message as Record<string, unknown> | undefined;
  const text = extractText(message);
  if (!text?.trim()) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const pushName =
    typeof data.pushName === "string" ? data.pushName : undefined;
  const ts =
    typeof data.messageTimestamp === "number"
      ? String(data.messageTimestamp)
      : typeof data.messageTimestamp === "string"
        ? data.messageTimestamp
        : undefined;

  const result = await ingestInboundTextMessage({
    phoneNumberId: instance,
    fromWaId,
    contactName: pushName,
    messageId: key.id,
    text: text.trim(),
    timestamp: ts,
  });

  const conversationIds =
    "conversationId" in result && result.conversationId
      ? [result.conversationId]
      : [];

  return { handled: 1, conversationIds };
}
