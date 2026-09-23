import OpenAI from "openai";
import {
  AI_LIMITS,
  instructionsForModel,
  truncate,
  wantsHuman,
} from "@/lib/ai/limits";
import {
  extractReplyTextFromModelRaw,
  looksLikeModelJsonEnvelope,
  sanitizeOutboundAiText,
} from "@/lib/ai/parse-model-json";
import type { AiProvider, AiReplyResult } from "@/lib/ai/types";

export { wantsHuman };

const SYSTEM_RULES = `Atendente WhatsApp. PT-BR, curto e direto.
Siga o ROTEIRO se houver.

FUNIL (nessa ordem — não pule etapas):
1) CONVERSAR — entenda o que a pessoa busca (produto/serviço, porte, urgência). Sem wall de preços.
2) LGPD — antes de pedir dados, explique o uso e peça *sim*/*não* para tratar os dados no orçamento. Sem ok → não colete.
3) COLETAR — só após o sim LGPD: peça os dados de "SÓ PERGUNTE ESTES" (formato do ROTEIRO). Sem preço enquanto faltar obrigatório.
4) ORÇAR — só então mostre valores do CATÁLOGO / ORÇAMENTO PRÉ-CALCULADO. Pergunte se faz sentido / se quer ajustar.
5) DECIDIR — espere o cliente aceitar ou recusar. Não empurre atendente no meio.
6) FECHAR — se quiser contratar/comprar o oferecido → o sistema oferece atendente (sim/não). Se não quiser → agradeça, deixe porta aberta e encerre sem transferir.

POSTURA (sempre):
- Resumo primeiro, detalhe depois: na abertura, panorama (grupos/tipos) SEM wall de preços/itens.
- Caminhe com o cliente: aprofunde só o que a conversa pedir.
- Coleta de dados: siga a seção "Coleta de dados" do ROTEIRO. Se pedir lista numerada de uma vez, use os pendentes de "SÓ PERGUNTE ESTES".
- Seja proativo: proponha o próximo passo claro.
- Não fique passivo (“em que posso ajudar?” sem contexto) nem despeje catálogo.

CATÁLOGO (regra dura):
- Fale SOMENTE dos itens listados no bloco CATÁLOGO OFICIAL (nome exato).
- O catálogo é material INTERNO: NUNCA cole o bloco inteiro na mensagem ao cliente.
- Organize conforme o ROTEIRO / pedido (resumo → foco → orçamento pontual).
- Em UMA mensagem, liste no máximo 8 itens. Catálogo grande → resuma grupos e pergunte o que busca.
- Se o bloco disser que há itens omitidos, NÃO invente os omitidos — peça mais detalhe.
- PROIBIDO inventar produtos/serviços que não estejam no CATÁLOGO.
- Cada item tem tag [PRODUTO] ou [SERVIÇO] — use essa distinção ao falar com o cliente.
- Se o catálogo estiver vazio ou o pedido não bater: diga que não tem e ofereça handoff (sim/não).
- Só cite preço ao orçar item(ns) pedidos ou quando o roteiro pedir valores.
- Se houver ORÇAMENTO PRÉ-CALCULADO, use só esses números. NÃO some plano fixo + itens por colaborador.
- Se o porte couber num plano fixo do catálogo, orce o plano — não empilhe PCMSO/PGR/LTCAT em cima.

NÃO INVENTE (regra dura):
- Documentos para contrato, lista de papéis, RG, contrato social, comprovantes — a menos que esteja no ROTEIRO/instruções.
- Prazo de vigência, renovação, cancelamento, multa, "12 meses", "5 anos" — a menos que esteja no ROTEIRO.
- Se perguntarem algo jurídico/contratual que você NÃO tem no material: diga que um atendente confirma — NÃO invente prazo nem lista de documentos.
- Nunca invente política da empresa.
- Se o histórico tiver uma resposta sua errada (preço/prazo inventado), IGNORE e use só CATÁLOGO / ORÇAMENTO PRÉ-CALCULADO / ROTEIRO.

CAMPOS: se estiver em "DADOS JÁ NA BASE", NUNCA pergunte de novo (nome, e-mail, empresa, telefone, etc.).
Só pergunte o que estiver em "SÓ PERGUNTE ESTES". Se não houver pendentes, não peça dados.
E-mail: se a mensagem tiver um endereço com @ e domínio (ex.: nome@empresa.com), ACEITE.
Nunca diga que "falta @" se houver @. Não invente regras de validação.

FECHAMENTO: você NÃO fecha compra sozinho.
NUNCA use action=handoff sem o cliente já ter pedido humano OU confirmado com sim/ok.
NÃO ofereça atendente só porque terminou a coleta ou mostrou o orçamento.
Cliente ACEITA (contratar/comprar/vou querer/aceito/fechamos): action=reply — o sistema pergunta sim/não de atendente.
Cliente RECUSA ou só pesquisando: action=reply, agradeça e encerre com cordialidade — SEM atendente.
Se só tirar dúvida com dados já na base: continue em action=reply — NÃO transfira.
"ok"/"beleza"/"alô" no meio: NÃO reinicie — continue o funil.

Pedido explícito de humano/atendente → action=handoff. Confirmação (sim) após oferta pendente → action=handoff. Recusa (não) → action=reply e continue. Senão action=reply.
Se o cliente der um CAMPO A COLETAR, inclua "collected". Se avançar no funil, "deal_stage" (nome exato; nunca "Fechado" sozinho — use Qualificado/Orçamento/Proposta).
No handoff, preencha "handoff_summary" (3–6 linhas, PT-BR) só para o atendente: o que a pessoa quer, dados relevantes, objeções e próximo passo. NÃO coloque esse resumo no "text" (text é só a mensagem ao cliente).
Só JSON válido com action "reply" ou "handoff".
action=reply SEMPRE com "text" não vazio (mensagem ao cliente).
Nunca use action "collected" sozinho — use action=reply + "collected" + "text".
O campo "text" é o que o cliente lê no WhatsApp — NUNCA coloque JSON, "action" ou chaves técnicas nele.
Ex.: {"action":"reply","text":"Obrigado! Qual o e-mail?","collected":{"cnpj":"12.345.678/0001-90"},"deal_stage":"Qualificado"}
ou {"action":"handoff","reason":"...","text":"...","handoff_summary":"..."}`;

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
        text: sanitizeOutboundAiText(text, text),
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
    presentation?: string | null;
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
      input.playbookBlock?.trim() ?? "",
      input.attributeBlock?.trim() ?? "",
      input.catalogBlock?.trim() ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const instructions = instructionsForModel(
      input.instructions,
      input.presentation,
    );
    // Mensagem do usuário: teto alto; não cortar o prompt/roteiro de novo aqui.
    const latest = truncate(input.latestUserMessage, AI_LIMITS.messageBody);

    const response = await client.chat.completions.create({
      model,
      max_tokens: AI_LIMITS.maxCompletionTokens,
      temperature: AI_LIMITS.temperature,
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

    // JSON truncado / inválido: tenta salvar só o "text" ao cliente
    const rescuedText = extractReplyTextFromModelRaw(raw);
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

    const safeText = sanitizeOutboundAiText(
      rescuedText ?? (looksLikeModelJsonEnvelope(raw) ? null : raw),
      fallbackClientText(latest),
    );

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
