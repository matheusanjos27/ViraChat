import type { ConversationStatus } from "@/lib/conversations/status";

export type InboxContact = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  external_id: string | null;
  notes?: string | null;
};

export type InboxMessage = {
  id: string;
  body: string | null;
  direction: "inbound" | "outbound";
  sender_type: "contact" | "ai" | "agent" | "system";
  created_at: string;
};

export type InboxConversation = {
  id: string;
  status: ConversationStatus;
  last_message_at: string | null;
  assigned_to: string | null;
  channel_id: string | null;
  contact: InboxContact;
  preview: string | null;
  channel_name: string | null;
};

export type InboxChannelOption = {
  id: string;
  display_name: string;
};

export function statusLabel(status: ConversationStatus) {
  switch (status) {
    case "ai_active":
      return "IA";
    case "waiting_human":
      return "Aguardando";
    case "human_active":
      return "Humano";
    case "resolved":
      return "Resolvida";
  }
}

export function statusTone(status: ConversationStatus) {
  switch (status) {
    case "ai_active":
      return "bg-[#eef1ff] text-[#3b5bdb]";
    case "waiting_human":
      return "bg-[#fff4e5] text-[#b54708]";
    case "human_active":
      return "bg-brand-soft text-brand-deep";
    case "resolved":
      return "bg-[#eef1f0] text-ink-muted";
  }
}
