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
