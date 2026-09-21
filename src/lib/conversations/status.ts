export type ConversationStatus =
  | "ai_active"
  | "waiting_human"
  | "human_active"
  | "resolved";

export type AppRole = "admin" | "supervisor" | "agent";

/** Who may auto-reply for a given conversation status. */
export function canAiReply(status: ConversationStatus): boolean {
  return status === "ai_active";
}

export function canAgentReply(status: ConversationStatus): boolean {
  return status === "human_active";
}

export const CONVERSATION_TRANSITIONS: Record<
  ConversationStatus,
  ConversationStatus[]
> = {
  ai_active: ["waiting_human", "human_active", "resolved"],
  waiting_human: ["human_active", "resolved"],
  human_active: ["ai_active", "resolved"],
  resolved: ["ai_active"],
};

export function canTransition(
  from: ConversationStatus,
  to: ConversationStatus,
): boolean {
  return CONVERSATION_TRANSITIONS[from].includes(to);
}

type SessionMessage = {
  body: string | null;
  direction: string;
  sender_type?: string | null;
  created_at?: string | null;
};

const HANDOFF_OUTBOUND_RE =
  /transfer|atendente\s+humano|finalizar\s+o\s+atendimento|passar\s+para\s+um\s+atendente/i;

/**
 * Corta o histórico para a sessão atual da IA (após humano / reabertura).
 * Sem isso a IA vê o handoff antigo e volta a transferir em loop.
 */
export function sliceMessagesForAiSession<T extends SessionMessage>(
  messages: T[],
  aiSessionStartedAt: string | null | undefined,
): { messages: T[]; resumedAfterHuman: boolean } {
  if (!messages.length) {
    return { messages, resumedAfterHuman: false };
  }

  let cut = 0;
  let resumed = false;

  if (aiSessionStartedAt) {
    const startMs = new Date(aiSessionStartedAt).getTime();
    if (Number.isFinite(startMs)) {
      const idx = messages.findIndex((m) => {
        const t = m.created_at ? new Date(m.created_at).getTime() : 0;
        return t >= startMs;
      });
      if (idx > 0) {
        cut = idx;
        resumed = true;
      } else if (idx === -1) {
        // Clock skew: sessão começou depois de todas as msgs — mantém só a última.
        cut = Math.max(0, messages.length - 1);
        resumed = messages.length > 1;
      }
    }
  }

  if (cut === 0) {
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.sender_type === "agent") {
        cut = i + 1;
        resumed = true;
      } else if (
        m.direction === "outbound" &&
        (m.sender_type === "ai" || !m.sender_type) &&
        m.body &&
        HANDOFF_OUTBOUND_RE.test(m.body)
      ) {
        cut = i + 1;
        resumed = true;
      }
    }
  }

  return {
    messages: cut > 0 ? messages.slice(cut) : messages,
    resumedAfterHuman: resumed,
  };
}
