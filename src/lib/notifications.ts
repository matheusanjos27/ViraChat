import { createServiceClient } from "@/lib/supabase/admin";

export type AppNotificationType = "handoff" | "handoff_busy" | "system";

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
