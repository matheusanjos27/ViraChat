import { kindFromMime } from "@/lib/attachments/format";
import {
  attachmentMaxBytes,
  decodeBase64Payload,
  saveAttachmentBytes,
  type AttachmentKind,
} from "@/lib/attachments/store";
import { createServiceClient } from "@/lib/supabase/admin";

type InboundText = {
  phoneNumberId: string;
  fromWaId: string;
  contactName?: string;
  messageId: string;
  text: string;
  timestamp?: string;
  attachment?: {
    kind?: AttachmentKind;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    base64?: string | null;
  };
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

  const { data: insertedMsg, error: messageError } = await supabase
    .from("messages")
    .insert({
      tenant_id: account.tenant_id,
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "contact",
      body: msg.text,
      provider_message_id: msg.messageId,
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (messageError) throw messageError;

  await supabase
    .from("conversations")
    .update({ last_message_at: createdAt })
    .eq("id", conversationId);

  if (msg.attachment) {
    await persistInboundAttachment({
      tenantId: account.tenant_id,
      contactId,
      conversationId,
      messageId: insertedMsg.id,
      providerMessageId: msg.messageId,
      attachment: msg.attachment,
    });
  }

  return {
    ok: true as const,
    tenantId: account.tenant_id,
    conversationId,
    contactId,
  };
}

async function persistInboundAttachment(params: {
  tenantId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  providerMessageId: string;
  attachment: NonNullable<InboundText["attachment"]>;
}) {
  const supabase = createServiceClient();
  const max = attachmentMaxBytes();
  const mime = params.attachment.mimeType ?? null;
  const fileName = params.attachment.fileName ?? null;
  const kindRaw =
    params.attachment.kind ??
    kindFromMime(mime, fileName ?? undefined);
  const kind: AttachmentKind =
    kindRaw === "image" ||
    kindRaw === "document" ||
    kindRaw === "audio" ||
    kindRaw === "video" ||
    kindRaw === "sticker" ||
    kindRaw === "other"
      ? kindRaw
      : "other";
  const declaredSize = Number(params.attachment.sizeBytes) || 0;

  const insertRow = async (
    status: "stored" | "rejected_too_large" | "failed" | "pending",
    extra: { storage_key?: string; size_bytes?: number } = {},
  ) => {
    const { error } = await supabase.from("message_attachments").insert({
      tenant_id: params.tenantId,
      contact_id: params.contactId,
      conversation_id: params.conversationId,
      message_id: params.messageId,
      kind,
      file_name: fileName,
      mime_type: mime,
      size_bytes: extra.size_bytes ?? declaredSize,
      storage_key: extra.storage_key ?? null,
      status,
      provider_message_id: params.providerMessageId,
    });
    if (error) {
      console.error("[attachments] db insert failed", status, error.message);
    }
  };

  if (declaredSize > max) {
    await insertRow("rejected_too_large", { size_bytes: declaredSize });
    return;
  }

  if (!params.attachment.base64) {
    await insertRow("pending");
    return;
  }

  try {
    const bytes = decodeBase64Payload(params.attachment.base64);
    if (!bytes.length) {
      await insertRow("failed", { size_bytes: declaredSize });
      console.error("[attachments] empty base64 payload");
      return;
    }
    if (bytes.length > max) {
      await insertRow("rejected_too_large", { size_bytes: bytes.length });
      return;
    }

    const saved = await saveAttachmentBytes({
      tenantId: params.tenantId,
      bytes,
      fileName,
      mimeType: mime,
    });

    await insertRow("stored", {
      storage_key: saved.storageKey,
      size_bytes: saved.sizeBytes,
    });
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    console.error("[attachments] save failed", {
      code,
      message: err instanceof Error ? err.message : err,
      dir: process.env.ATTACHMENTS_DIR ?? "(default)",
    });
    if (code === "TOO_LARGE") {
      await insertRow("rejected_too_large");
      return;
    }
    await insertRow("failed");
  }
}

export { formatBytes, attachmentMaxBytes } from "@/lib/attachments/format";
