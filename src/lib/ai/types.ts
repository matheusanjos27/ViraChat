export type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AiTokenUsage = {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type AiReplyResult =
  | {
      action: "reply";
      text: string;
      collected?: Record<string, string>;
      deal_stage?: string;
      usage?: AiTokenUsage;
    }
  | {
      action: "handoff";
      reason: string;
      text?: string;
      /** Resumo interno para o atendente humano (não enviado ao cliente). */
      handoff_summary?: string;
      collected?: Record<string, string>;
      usage?: AiTokenUsage;
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
    playbookBlock?: string;
  }): Promise<AiReplyResult>;
}
