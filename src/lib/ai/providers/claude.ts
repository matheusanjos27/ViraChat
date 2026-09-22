import Anthropic from "@anthropic-ai/sdk";
import { AI_LIMITS, instructionsForModel } from "@/lib/ai/limits";
import type { AiProvider, AiReplyResult } from "@/lib/ai/types";

const SYSTEM_RULES = `Atendente WhatsApp. PT-BR, curto (≤2 parágrafos).
Humano/atendente → action=handoff. Senão action=reply.
Não invente preços nem dados. Só JSON:
{"action":"reply","text":"..."}
ou {"action":"handoff","reason":"...","text":"..."}`;

function wantsHuman(text: string) {
  return /(atendente|humano|pessoa\s+real|falar\s+com\s+(algu[eé]m|voc[eê]s)|operador|suporte\s+humano)/i.test(
    text,
  );
}

export class ClaudeAiProvider implements AiProvider {
  id = "anthropic-claude";

  async generateReply(input: {
    agentName: string;
    instructions: string;
    presentation?: string | null;
    history: { role: "user" | "assistant"; content: string }[];
    latestUserMessage: string;
  }): Promise<AiReplyResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      if (wantsHuman(input.latestUserMessage)) {
        return {
          action: "handoff",
          reason: "Pedido explícito de humano (sem ANTHROPIC_API_KEY)",
          text: "Claro — vou te transferir para um atendente humano.",
        };
      }
      return {
        action: "reply",
        text: "Recebemos sua mensagem. Em breve um atendente responde. (IA ainda sem chave ANTHROPIC_API_KEY configurada.)",
      };
    }

    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
    const instructions = instructionsForModel(
      input.instructions,
      input.presentation,
    );

    const history = input.history.slice(-AI_LIMITS.historyTurnsMax).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await client.messages.create({
      model,
      max_tokens: AI_LIMITS.maxCompletionTokens,
      system: `${SYSTEM_RULES}\n\nNome do assistente: ${input.agentName}\nInstruções da empresa:\n${instructions}`,
      messages: [
        ...history,
        {
          role: "user",
          content: input.latestUserMessage,
        },
      ],
    });

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    const parsed = parseAiJson(raw);
    if (parsed) return parsed;

    if (wantsHuman(input.latestUserMessage)) {
      return {
        action: "handoff",
        reason: "Pedido explícito de humano",
        text: "Claro — vou te transferir para um atendente.",
      };
    }

    const safe =
      raw && !(raw.trim().startsWith("{") && raw.trim().endsWith("}"))
        ? raw
        : "Recebi sua mensagem. Pode me confirmar ou complementar o dado que pedi?";
    return { action: "reply", text: safe };
  }
}

function parseAiJson(raw: string): AiReplyResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]) as {
      action?: string;
      text?: string;
      reason?: string;
    };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (data.action === "handoff") {
      return {
        action: "handoff",
        reason: data.reason || "handoff",
        text: text || undefined,
      };
    }
    if (
      (data.action === "reply" || data.action === "collected" || text) &&
      text
    ) {
      return { action: "reply", text };
    }
  } catch {
    return null;
  }
  return null;
}

export function getDefaultAiProvider(): AiProvider {
  return new ClaudeAiProvider();
}
