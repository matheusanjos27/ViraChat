import { redirect } from "next/navigation";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import type { ConversationStatus } from "@/lib/conversations/status";
import type { InboxConversation, InboxMessage } from "@/lib/inbox/types";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");

  const tenantId = membership.tenant_id;

  const { data: rows } = await supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, assigned_to, contacts(id, display_name, phone_e164, external_id), channels(display_name)",
    )
    .eq("tenant_id", tenantId)
    .order("last_message_at", { ascending: false })
    .limit(80);

  type Row = {
    id: string;
    status: ConversationStatus;
    last_message_at: string | null;
    assigned_to: string | null;
    contacts: {
      id: string;
      display_name: string | null;
      phone_e164: string | null;
      external_id: string | null;
    } | null;
    channels: { display_name: string } | null;
  };

  const list = (rows ?? []) as unknown as Row[];
  const conversationIds = list.map((r) => r.id);

  const previewByConv = new Map<string, string | null>();
  if (conversationIds.length > 0) {
    const { data: recentMsgs } = await supabase
      .from("messages")
      .select("conversation_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(200);

    for (const m of recentMsgs ?? []) {
      if (!previewByConv.has(m.conversation_id)) {
        previewByConv.set(m.conversation_id, m.body);
      }
    }
  }

  const conversations: InboxConversation[] = list.map((r) => ({
    id: r.id,
    status: r.status,
    last_message_at: r.last_message_at,
    assigned_to: r.assigned_to,
    contact: r.contacts ?? {
      id: "unknown",
      display_name: null,
      phone_e164: null,
      external_id: null,
    },
    preview: previewByConv.get(r.id) ?? null,
    channel_name: r.channels?.display_name ?? null,
  }));

  const selectedId =
    (params.c && conversations.some((c) => c.id === params.c)
      ? params.c
      : conversations[0]?.id) ?? null;

  let initialMessages: InboxMessage[] = [];
  if (selectedId) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, body, direction, sender_type, created_at")
      .eq("conversation_id", selectedId)
      .order("created_at", { ascending: true });
    initialMessages = (msgs as InboxMessage[]) ?? [];
  }

  return (
    <InboxWorkspace
      tenantId={tenantId}
      initialConversations={conversations}
      initialMessages={initialMessages}
      initialSelectedId={selectedId}
    />
  );
}
