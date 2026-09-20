import OpenAI from "openai";
import type { AiProvider, AiReplyResult } from "@/lib/ai/types";

const SYSTEM_RULES = `Você é um atendente de WhatsApp de uma empresa.
Responda em português do Brasil, de forma curta e clara (no máximo ~3 parágrafos curtos).
Se o cliente pedir falar com humano, atendente, pessoa real, ou se o assunto for sensível demais para você resolver, use action=handoff.
Caso contrário use action=reply com a mensagem final para o cliente.
Nunca invente preços, políticas ou dados que não estejam nas instruções.
Responda APENAS com JSON válido no formato:
{"action":"reply","text":"..."}
ou
{"action":"handoff","reason":"...","text":"mensagem opcional ao cliente antes da transferência"}`;

function wantsHuman(text: string) {
  return /(atendente|humano|pessoa\s+real|falar\s+com\s+(algu[eé]m|voc[eê]s)|operador|suporte\s+humano)/i.test(
    text,
  );
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
    if (data.action === "handoff") {
      return {
        action: "handoff",
        reason: data.reason || "handoff",
        text: data.text,
      };
    }
    if (data.action === "reply" && data.text) {
      return { action: "reply", text: data.text };
    }
  } catch {
    return null;
  }
  return null;
}

export class OpenAiProvider implements AiProvider {
  id = "openai";

  async generateReply(input: {
    agentName: string;
    instructions: string;
    history: { role: "user" | "assistant"; content: string }[];
    latestUserMessage: string;
  }): Promise<AiReplyResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (wantsHuman(input.latestUserMessage)) {
        return {
          action: "handoff",
          reason: "Pedido explícito de humano (sem OPENAI_API_KEY)",
          text: "Claro — vou te transferir para um atendente humano.",
        };
      }
      return {
        action: "reply",
        text: "Recebemos sua mensagem. Em breve um atendente responde. (IA ainda sem OPENAI_API_KEY configurada.)",
      };
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const history = input.history.slice(-12).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await client.chat.completions.create({
      model,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `${SYSTEM_RULES}\n\nNome do assistente: ${input.agentName}\nInstruções da empresa:\n${input.instructions}`,
        },
        ...history,
        { role: "user", content: input.latestUserMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseAiJson(raw);
    if (parsed) return parsed;

    if (wantsHuman(input.latestUserMessage)) {
      return {
        action: "handoff",
        reason: "Pedido explícito de humano",
        text: "Claro — vou te transferir para um atendente.",
      };
    }

    return { action: "reply", text: raw || "Desculpe, não entendi. Pode repetir?" };
  }
}

export function getDefaultAiProvider(): AiProvider {
  return new OpenAiProvider();
}
