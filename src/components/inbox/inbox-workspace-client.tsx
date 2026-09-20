"use client";

import dynamic from "next/dynamic";
import type { InboxConversation, InboxMessage } from "@/lib/inbox/types";

const InboxWorkspace = dynamic(
  () =>
    import("@/components/inbox/inbox-workspace").then((m) => m.InboxWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#eef1f0] text-sm text-ink-muted">
        Carregando conversas…
      </div>
    ),
  },
);

export function InboxWorkspaceClient(props: {
  tenantId: string;
  channels: { id: string; display_name: string }[];
  initialConversations: InboxConversation[];
  initialMessages: InboxMessage[];
  initialSelectedId: string | null;
}) {
  return <InboxWorkspace {...props} />;
}
