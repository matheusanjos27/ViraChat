export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiReplyResult =
  | {
      action: "reply";
      text: string;
      collected?: Record<string, string>;
      deal_stage?: string;
    }
  | {
      action: "handoff";
      reason: string;
      text?: string;
      collected?: Record<string, string>;
    };

export type AiAttributeHint = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  current: string | null;
};

export interface AiProvider {
  id: string;
  generateReply(input: {
    agentName: string;
    instructions: string;
    history: AiChatMessage[];
    latestUserMessage: string;
    attributeBlock?: string;
    catalogBlock?: string;
  }): Promise<AiReplyResult>;
}
