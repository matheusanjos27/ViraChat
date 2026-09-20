import type { ContactAttribute } from "@/lib/crm/attributes";

type ChatLine = {
  direction: "inbound" | "outbound";
  body: string | null;
  sender_type?: string;
};

function pendingKeys(
  attributes: ContactAttribute[],
  currentValues: Record<string, string | null>,
) {
  return attributes.filter(
    (a) => a.collect_via_ai && !(currentValues[a.key] ?? "").trim(),
  );
}

function emailFrom(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function companyFrom(text: string) {
  const patterns = [
    /(?:minha\s+)?empresa\s+(?:se\s+)?chama\s+[:\-]?\s*([^\n,.!?]+)/i,
    /empresa\s*[:=]\s*([^\n,.!?]+)/i,
    /(?:trabalho|sou)\s+(?:na|da|do)\s+([A-ZÀ-Ú][\wÀ-ú&.\- ]{1,60})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 120);
  }
  return null;
}

function sizeFrom(text: string) {
  const m = text.match(
    /(\d{1,5})\s*(?:funcion[aá]rios|pessoas|colaboradores|colabs|funcionarios)?/i,
  );
  if (!m) return null;
  // Prefer explicit employee wording; still accept bare numbers in short messages
  if (
    /funcion|pessoas|colabor|equipe|time|porte|tamanho/i.test(text) ||
    text.trim().length < 12
  ) {
    return m[1];
  }
  return null;
}

function looksLikePersonName(text: string) {
  const t = text.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/@|\d|http|www\./i.test(t)) return false;
  if (
    /^(oi|ol[aá]|bom\s+dia|boa\s+tarde|boa\s+noite|ok|obrigad|sim|n[aã]o)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  const parts = t.split(/\s+/);
  return parts.length >= 1 && parts.length <= 4;
}

function lastAiAskedFor(
  messages: ChatLine[],
  keys: string[],
): string | null {
  const lastAi = [...messages]
    .reverse()
    .find((m) => m.direction === "outbound" && m.body);
  if (!lastAi?.body) return null;
  const body = lastAi.body.toLowerCase();
  for (const key of keys) {
    if (key === "email" && /e-?mail|email/.test(body)) return key;
    if (
      (key === "empresa" || key === "company" || key === "company_name") &&
      /empresa|raz[aã]o\s+social|nome\s+da\s+empresa/.test(body)
    ) {
      return key;
    }
    if (
      (key === "responsavel" || key === "nome") &&
      /respons[aá]vel|seu\s+nome|nome\s+completo|como\s+voc[eê]\s+se\s+chama/.test(
        body,
      )
    ) {
      return key;
    }
    if (
      (key === "tamanho" || key === "porte") &&
      /funcion|pessoas|porte|tamanho|equipe|quantas\s+pessoas/.test(body)
    ) {
      return key;
    }
    if (key === "setor" && /setor|ramo|segmento|área|area/.test(body)) {
      return key;
    }
  }
  return null;
}

/**
 * Deterministic extraction so CRM fields fill even when the model
 * forgets to return "collected" in JSON.
 */
export function extractCollectedFromMessages(
  attributes: ContactAttribute[],
  currentValues: Record<string, string | null>,
  messages: ChatLine[],
  latestUserMessage: string,
): Record<string, string> {
  const pending = pendingKeys(attributes, currentValues);
  if (pending.length === 0) return {};

  const byKey = new Map(pending.map((a) => [a.key, a]));
  const out: Record<string, string> = {};

  const inboundTexts = [
    ...messages
      .filter((m) => m.direction === "inbound" && m.body)
      .map((m) => m.body as string),
    latestUserMessage,
  ];
  const blob = inboundTexts.join("\n");

  const emailAttr =
    byKey.get("email") ?? pending.find((a) => a.type === "email");
  if (emailAttr) {
    const email = emailFrom(blob);
    if (email) out[emailAttr.key] = email;
  }

  const companyAttr =
    byKey.get("empresa") ??
    byKey.get("company") ??
    byKey.get("company_name");
  if (companyAttr) {
    for (const text of inboundTexts) {
      const company = companyFrom(text);
      if (company) {
        out[companyAttr.key] = company;
        break;
      }
    }
  }

  const sizeAttr = byKey.get("tamanho") ?? byKey.get("porte");
  if (sizeAttr) {
    for (const text of inboundTexts) {
      const size = sizeFrom(text);
      if (size) {
        out[sizeAttr.key] = size;
        break;
      }
    }
  }

  const nameAttr = byKey.get("responsavel") ?? byKey.get("nome");
  if (nameAttr && !out[nameAttr.key]) {
    const asked = lastAiAskedFor(messages, [nameAttr.key]);
    if (asked === nameAttr.key && looksLikePersonName(latestUserMessage)) {
      out[nameAttr.key] = latestUserMessage.trim();
    }
  }

  const setorAttr = byKey.get("setor");
  if (setorAttr && !out[setorAttr.key]) {
    const asked = lastAiAskedFor(messages, ["setor"]);
    if (asked === "setor" && latestUserMessage.trim().length >= 2) {
      const t = latestUserMessage.trim();
      if (!emailFrom(t) && !/^\d+$/.test(t)) {
        out[setorAttr.key] = t.slice(0, 120);
      }
    }
  }

  return out;
}

export function mergeCollected(
  ...parts: Array<Record<string, string> | undefined>
) {
  const out: Record<string, string> = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [k, v] of Object.entries(part)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
  }
  return out;
}
