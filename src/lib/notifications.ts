import { createServiceClient } from "@/lib/supabase/admin";

export type AppNotificationType =
  | "handoff"
  | "handoff_busy"
  | "system"
  | "channel_disconnected";

const DISCONNECT_DEBOUNCE_MS = 30 * 60 * 1000;

export async function createAppNotification(input: {
  tenantId: string;
  type: AppNotificationType;
  title: string;
  body?: string;
  conversationId?: string;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("app_notifications")
    .insert({
      tenant_id: input.tenantId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      conversation_id: input.conversationId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[notifications] create failed", error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Evita spam se o WhatsApp ficar oscilando close/open. */
export async function notifyChannelDisconnected(input: {
  tenantId: string;
  instanceName: string;
  displayName?: string | null;
  displayPhone?: string | null;
}) {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - DISCONNECT_DEBOUNCE_MS).toISOString();
  const marker = `instance:${input.instanceName}`;

  const { data: recent } = await supabase
    .from("app_notifications")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("type", "channel_disconnected")
    .ilike("body", `%${marker}%`)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (recent) return null;

  const label =
    input.displayPhone ||
    input.displayName ||
    input.instanceName;

  return createAppNotification({
    tenantId: input.tenantId,
    type: "channel_disconnected",
    title: "WhatsApp desconectado",
    body: `${label} perdeu a conexão. Reconecte em Canais. (${marker})`,
  });
}

export async function markConversationNotificationsRead(
  conversationId: string,
) {
  const supabase = createServiceClient();
  await supabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .is("read_at", null);
}
