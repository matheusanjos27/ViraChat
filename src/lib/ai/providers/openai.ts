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

CATÁLOGO (regra dura):
- Fale SOMENTE dos itens listados no bloco CATÁLOGO OFICIAL (nome exato, descrição e preço).
- PROIBIDO inventar produtos/serviços genéricos (ex.: "Shampoo Hidratante", "Anti-queda", "Sem Sulfato") se não estiverem no CATÁLOGO.
- Cada item tem tag [PRODUTO] ou [SERVIÇO] — use essa distinção ao falar com o cliente.
- Se o catálogo estiver vazio ou o pedido não bater com nada cadastrado: diga que não tem essa opção e ofereça handoff (pergunte sim/não; não invente alternativa).
- Ao listar o que vende, copie da lista oficial — nunca invente uma lista.

CAMPOS: se estiver em "DADOS JÁ NA BASE", NUNCA pergunte de novo (nome, e-mail, empresa, telefone, etc.).
Só pergunte o que estiver em "SÓ PERGUNTE ESTES". Se não houver pendentes, não peça dados.
E-mail: se a mensagem tiver um endereço com @ e domínio (ex.: nome@empresa.com), ACEITE.
Nunca diga que "falta @" se houver @. Não invente regras de validação.

FECHAMENTO: você NÃO fecha compra sozinho.
NUNCA use action=handoff sem o cliente já ter pedido humano OU confirmado com sim/ok.
Quando for a hora de fechar (dados + orçamento prontos, ou cliente quer contratar): use action=reply com o conteúdo útil (orçamento/próximo passo) e NÃO pergunte sobre atendente — o sistema pergunta sim/não em seguida.
Se os dados já estavam na base e o cliente só está tirando dúvida, continue em action=reply — NÃO transfira.
Se a conversa já está em andamento e o cliente manda "ok", "beleza", "alô", "tá aí?": NÃO reinicie nem cumprimente de novo — continue o fluxo.

Pedido explícito de humano/atendente → action=handoff. Confirmação (sim) após oferta pendente → action=handoff. Recusa (não) → action=reply e continue. Senão action=reply.
Se o cliente der um CAMPO A COLETAR, inclua "collected". Se avançar no funil, "deal_stage" (nome exato; nunca "Fechado" sozinho — use Qualificado/Orçamento/Proposta).
No handoff, preencha "handoff_summary" (3–6 linhas, PT-BR) só para o atendente: o que a pessoa quer, dados relevantes, objeções e próximo passo. NÃO coloque esse resumo no "text" (text é só a mensagem ao cliente).
Só JSON válido com action "reply" ou "handoff".
action=reply SEMPRE com "text" não vazio (mensagem ao cliente).
Nunca use action "collected" sozinho — use action=reply + "collected" + "text".
Ex.: {"action":"reply","text":"Obrigado! Qual o e-mail?","collected":{"cnpj":"12.345.678/0001-90"},"deal_stage":"Qualificado"}
ou {"action":"handoff","reason":"...","text":"...","handoff_summary":"..."}`;

function looksLikeJsonBlob(text: string): boolean {
  const t = text.trim();
  return (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  );
}

function fallbackClientText(latestUserMessage: string): string {
  if (wantsHuman(latestUserMessage)) {
    return "Claro — vou te transferir para um atendente.";
  }
  return "Recebi sua mensagem. Pode me confirmar ou complementar o dado que pedi?";
}

function parseAiJson(raw: string): AiReplyResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[0]) as {
      action?: string;
      text?: string;
      reason?: string;
      handoff_summary?: string;
      collected?: Record<string, string>;
      deal_stage?: string;
    };
    const collected =
      data.collected && typeof data.collected === "object"
        ? Object.fromEntries(
            Object.entries(data.collected)
              .filter(([, v]) => typeof v === "string" && v.trim())
              .map(([k, v]) => {
                const key =
                  k === "e_mail" || k === "e-mail" ? "email" : k;
                return [key, String(v).trim()];
              }),
          )
        : undefined;

    const text =
      typeof data.text === "string" ? data.text.trim() : "";

    if (data.action === "handoff") {
      return {
        action: "handoff",
        reason: data.reason || "handoff",
        text: text || undefined,
        handoff_summary:
          typeof data.handoff_summary === "string"
            ? data.handoff_summary.trim()
            : undefined,
        collected,
      };
    }

    // reply | collected | missing action — nunca devolver JSON vazio ao cliente
    if (
      data.action === "reply" ||
      data.action === "collected" ||
      collected ||
      text
    ) {
      if (!text) return null; // deixa o caller montar texto seguro + collected
      return {
        action: "reply",
        text,
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
      .slice(-AI_LIMITS.historyTurnsMax)
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

    // Modelo devolveu JSON inválido / action=collected sem text / {}
    let collectedFromRaw: Record<string, string> | undefined;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const data = JSON.parse(m[0]) as {
          collected?: Record<string, string>;
        };
        if (data.collected && typeof data.collected === "object") {
          collectedFromRaw = Object.fromEntries(
            Object.entries(data.collected)
              .filter(([, v]) => typeof v === "string" && v.trim())
              .map(([k, v]) => [k, String(v).trim()]),
          );
        }
      }
    } catch {
      /* ignore */
    }

    if (wantsHuman(latest)) {
      return {
        action: "handoff",
        reason: "Pedido explícito de humano",
        text: "Claro — vou te transferir para um atendente.",
        collected: collectedFromRaw,
        usage,
      };
    }

    const safeText =
      raw && !looksLikeJsonBlob(raw)
        ? raw
        : fallbackClientText(latest);

    return {
      action: "reply",
      text: safeText,
      collected: collectedFromRaw,
      usage,
    };
  }
}

export function getDefaultAiProvider(): AiProvider {
  return new OpenAiProvider();
}
