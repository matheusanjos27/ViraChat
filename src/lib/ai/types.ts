export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiReplyResult =
  | { action: "reply"; text: string }
  | { action: "handoff"; reason: string; text?: string };

export interface AiProvider {
  id: string;
  generateReply(input: {
    agentName: string;
    instructions: string;
    history: AiChatMessage[];
    latestUserMessage: string;
  }): Promise<AiReplyResult>;
}
