import OpenAI from "openai";
import {
  AI_LIMITS,
  instructionsForModel,
  truncate,
  wantsHuman,
} from "@/lib/ai/limits";
import type { AiProvider, AiReplyResult } from "@/lib/ai/types";

export { wantsHuman };

const SYSTEM_RULES = `Atendente WhatsApp. PT-BR, curto (≤2 parágrafos).
Siga o ROTEIRO se houver.

CATÁLOGO: fale SOMENTE de produtos/serviços listados no CATÁLOGO (nome, descrição, preço).
Nunca invente ofertas genéricas, pacotes ou preços. Se o catálogo estiver vazio ou o pedido não bater com nada cadastrado, diga que não tem essa opção e faça handoff.

CAMPOS: se estiver em "DADOS JÁ NA BASE", NUNCA pergunte de novo (nome, e-mail, empresa, telefone, etc.).
Só pergunte o que estiver em "SÓ PERGUNTE ESTES". Se não houver pendentes, não peça dados.
E-mail: se a mensagem tiver um endereço com @ e domínio (ex.: nome@empresa.com), ACEITE.
Nunca diga que "falta @" se houver @. Não invente regras de validação.

FECHAMENTO: você NÃO fecha compra sozinho. Depois de coletar os dados obrigatórios e apresentar o orçamento (ou quando o cliente quiser contratar), action=handoff para um atendente humano finalizar. Não diga que a compra/contrato já foi fechado.

Humano/atendente → action=handoff. Senão action=reply.
Se o cliente der um CAMPO A COLETAR, inclua "collected". Se avançar no funil, "deal_stage" (nome exato; nunca "Fechado" sozinho — use Qualificado/Orçamento/Proposta e handoff).
Só JSON: {"action":"reply","text":"...","collected":{},"deal_stage":"..."}
ou {"action":"handoff","reason":"...","text":"..."}`;

function parseAiJson(raw: string): AiReplyResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]) as {
      action?: string;
      text?: string;
      reason?: string;
      collected?: Record<string, string>;
      deal_stage?: string;
    };
    const collected =
      data.collected && typeof data.collected === "object"
        ? Object.fromEntries(
            Object.entries(data.collected)
              .filter(([, v]) => typeof v === "string" && v.trim())
              .map(([k, v]) => [k, String(v).trim()]),
          )
        : undefined;

    if (data.action === "handoff") {
      return {
        action: "handoff",
        reason: data.reason || "handoff",
        text: data.text,
        collected,
      };
    }
    if (data.action === "reply" && data.text) {
      return {
        action: "reply",
        text: data.text,
        collected,
        deal_stage: data.deal_stage,
      };
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
    attributeBlock?: string;
    catalogBlock?: string;
    playbookBlock?: string;
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

    const history = input.history
      .slice(-AI_LIMITS.historyTurns)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: truncate(m.content, AI_LIMITS.messageBody),
      }));

    const extras = [
      input.playbookBlock
        ? truncate(input.playbookBlock, AI_LIMITS.playbook + 200)
        : "",
      input.attributeBlock
        ? truncate(input.attributeBlock, AI_LIMITS.attributeBlock)
        : "",
      input.catalogBlock
        ? truncate(input.catalogBlock, AI_LIMITS.catalogBlock)
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const instructions = instructionsForModel(input.instructions);
    const latest = truncate(input.latestUserMessage, AI_LIMITS.messageBody);

    const response = await client.chat.completions.create({
      model,
      max_tokens: AI_LIMITS.maxCompletionTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM_RULES}\n\nNome do assistente: ${input.agentName}\nInstruções da empresa:\n${instructions}${extras ? `\n\n${extras}` : ""}`,
        },
        ...history,
        { role: "user", content: latest },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const usage =
      response.usage != null
        ? {
            model,
            prompt_tokens: response.usage.prompt_tokens ?? 0,
            completion_tokens: response.usage.completion_tokens ?? 0,
            total_tokens: response.usage.total_tokens ?? 0,
          }
        : undefined;

    const parsed = parseAiJson(raw);
    if (parsed) return { ...parsed, usage };

    if (wantsHuman(latest)) {
      return {
        action: "handoff",
        reason: "Pedido explícito de humano",
        text: "Claro — vou te transferir para um atendente.",
        usage,
      };
    }

    return {
      action: "reply",
      text: raw || "Desculpe, não entendi. Pode repetir?",
      usage,
    };
  }
}

export function getDefaultAiProvider(): AiProvider {
  return new OpenAiProvider();
}
