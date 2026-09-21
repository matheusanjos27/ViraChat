import { getEvolutionMediaBase64 } from "@/lib/evolution/client";
import { kindFromMime, type AttachmentKind } from "@/lib/attachments/format";
import { ingestInboundTextMessage } from "@/lib/whatsapp/ingest";
import { notifyChannelDisconnected } from "@/lib/notifications";
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
  const doc = message.documentMessage as
    | { caption?: string; title?: string; fileName?: string }
    | undefined;
  if (doc?.caption) return doc.caption;
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

type MediaMeta = {
  kind: AttachmentKind;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  base64: string | null;
  placeholder: string;
};

function extractMedia(
  message: Record<string, unknown> | undefined,
  data: Record<string, unknown>,
): MediaMeta | null {
  if (!message) return null;

  const topBase64 =
    typeof data.base64 === "string"
      ? data.base64
      : typeof message.base64 === "string"
        ? message.base64
        : null;

  const image = message.imageMessage as
    | {
        mimetype?: string;
        fileLength?: number | string;
        caption?: string;
        jpegThumbnail?: string;
      }
    | undefined;
  if (image) {
    const size =
      typeof image.fileLength === "number"
        ? image.fileLength
        : Number(image.fileLength) || null;
    return {
      kind: "image",
      fileName: "imagem.jpg",
      mimeType: image.mimetype ?? "image/jpeg",
      sizeBytes: size,
      base64: topBase64,
      placeholder: image.caption?.trim()
        ? image.caption.trim()
        : "[Imagem]",
    };
  }

  const sticker = message.stickerMessage as
    | { mimetype?: string; fileLength?: number | string }
    | undefined;
  if (sticker) {
    const size =
      typeof sticker.fileLength === "number"
        ? sticker.fileLength
        : Number(sticker.fileLength) || null;
    return {
      kind: "sticker",
      fileName: "sticker.webp",
      mimeType: sticker.mimetype ?? "image/webp",
      sizeBytes: size,
      base64: topBase64,
      placeholder: "[Figurinha]",
    };
  }

  const audio = message.audioMessage as
    | { mimetype?: string; fileLength?: number | string; ptt?: boolean }
    | undefined;
  if (audio) {
    const size =
      typeof audio.fileLength === "number"
        ? audio.fileLength
        : Number(audio.fileLength) || null;
    return {
      kind: "audio",
      fileName: audio.ptt ? "audio.ogg" : "audio.mp3",
      mimeType: audio.mimetype ?? "audio/ogg",
      sizeBytes: size,
      base64: topBase64,
      placeholder: audio.ptt ? "[Áudio]" : "[Áudio]",
    };
  }

  const video = message.videoMessage as
    | {
        mimetype?: string;
        fileLength?: number | string;
        caption?: string;
        fileName?: string;
      }
    | undefined;
  if (video) {
    const size =
      typeof video.fileLength === "number"
        ? video.fileLength
        : Number(video.fileLength) || null;
    return {
      kind: "video",
      fileName: video.fileName ?? "video.mp4",
      mimeType: video.mimetype ?? "video/mp4",
      sizeBytes: size,
      base64: topBase64,
      placeholder: video.caption?.trim()
        ? video.caption.trim()
        : "[Vídeo]",
    };
  }

  const doc = message.documentMessage as
    | {
        mimetype?: string;
        fileLength?: number | string;
        fileName?: string;
        title?: string;
        caption?: string;
      }
    | undefined;
  if (doc) {
    const size =
      typeof doc.fileLength === "number"
        ? doc.fileLength
        : Number(doc.fileLength) || null;
    const name = doc.fileName || doc.title || "documento";
    return {
      kind: kindFromMime(doc.mimetype, "document"),
      fileName: name,
      mimeType: doc.mimetype ?? "application/octet-stream",
      sizeBytes: size,
      base64: topBase64,
      placeholder: doc.caption?.trim()
        ? doc.caption.trim()
        : `[Documento: ${name}]`,
    };
  }

  const docWithCaption = message.documentWithCaptionMessage as
    | { message?: { documentMessage?: typeof doc } }
    | undefined;
  if (docWithCaption?.message?.documentMessage) {
    return extractMedia(
      { documentMessage: docWithCaption.message.documentMessage },
      data,
    );
  }

  return null;
}

function jidToWaId(jid: string | undefined): string | null {
  if (!jid) return null;
  const user = jid.split("@")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  return digits || null;
}

async function loadBaileysAccount(instance: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("whatsapp_accounts")
    .select(
      "id, tenant_id, channel_id, display_phone, verified_name, connection_status, phone_number_id",
    )
    .eq("phone_number_id", instance)
    .eq("onboard_source", "baileys")
    .maybeSingle();
  return data;
}

async function maybeNotifyDisconnect(
  prevStatus: string | null | undefined,
  nextStatus: "pending_qr" | "open" | "close",
  account: {
    tenant_id: string;
    phone_number_id: string;
    display_phone: string | null;
    verified_name: string | null;
  },
) {
  if (prevStatus === nextStatus) return;
  const wasConnected = prevStatus === "open";
  const needsReconnect =
    (nextStatus === "close" && wasConnected) ||
    (nextStatus === "pending_qr" && wasConnected);
  if (!needsReconnect) return;

  await notifyChannelDisconnected({
    tenantId: account.tenant_id,
    instanceName: account.phone_number_id,
    displayName: account.verified_name,
    displayPhone: account.display_phone,
  });
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

    const account = await loadBaileysAccount(instance);
    const prevStatus = account?.connection_status;

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

    if (account) {
      await maybeNotifyDisconnect(prevStatus, connection_status, {
        ...account,
        display_phone: patch.display_phone ?? account.display_phone,
      });
    }

    return { handled: 1, conversationIds: [] as string[] };
  }

  if (event === "qrcode.updated") {
    const account = await loadBaileysAccount(instance);
    const prevStatus = account?.connection_status;

    await supabase
      .from("whatsapp_accounts")
      .update({
        connection_status: "pending_qr",
        last_webhook_at: new Date().toISOString(),
      })
      .eq("phone_number_id", instance)
      .eq("onboard_source", "baileys");

    if (account) {
      await maybeNotifyDisconnect(prevStatus, "pending_qr", account);
    }

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

  if (key.remoteJid?.endsWith("@g.us")) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const fromWaId = jidToWaId(key.remoteJid);
  if (!fromWaId || !key.id) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  const message = data.message as Record<string, unknown> | undefined;
  const media = extractMedia(message, data);
  let text = extractText(message);

  if (!text?.trim() && media) {
    text = media.placeholder;
  }

  if (!text?.trim()) {
    return { handled: 0, conversationIds: [] as string[] };
  }

  let attachment = media
    ? {
        kind: media.kind,
        fileName: media.fileName,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        base64: media.base64,
      }
    : undefined;

  if (media && !media.base64) {
    try {
      const downloaded = await getEvolutionMediaBase64({
        instanceName: instance,
        webhookData: data,
      });
      attachment = {
        kind: kindFromMime(
          downloaded.mimeType,
          downloaded.mediaType ?? media.kind,
        ),
        fileName: downloaded.fileName ?? media.fileName,
        mimeType: downloaded.mimeType ?? media.mimeType,
        sizeBytes: media.sizeBytes,
        base64: downloaded.base64,
      };
    } catch (err) {
      console.warn("[evolution] media download failed", err);
    }
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
    attachment,
  });

  const conversationIds =
    "conversationId" in result && result.conversationId
      ? [result.conversationId]
      : [];

  return { handled: 1, conversationIds };
}
