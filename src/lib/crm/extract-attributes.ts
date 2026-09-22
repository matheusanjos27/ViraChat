import type { ContactAttribute } from "@/lib/crm/attributes";
import {
  digitsOnlyCnpj,
  formatCnpj,
  isValidCnpj,
  looksLikeCnpjQuestion,
} from "@/lib/crm/cnpj";

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

function normalizeEmailCandidates(text: string) {
  return text
    .replace(/\s*arroba\s*/gi, "@")
    .replace(/\s*[@＠]\s*/g, "@")
    .replace(/\s*\.\s*/g, ".");
}

function emailFrom(text: string) {
  const normalized = normalizeEmailCandidates(text);
  const match = normalized.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  if (match?.[0]) return match[0].toLowerCase();

  // Fallback: token with @ when AI just asked for email (tolerates missing TLD typos lightly)
  const loose = normalized.match(
    /(?:^|[\s,:;=])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z0-9.-]+)/i,
  );
  if (loose?.[1] && loose[1].includes(".")) {
    return loose[1].toLowerCase().replace(/[.,;:!?)]+$/, "");
  }
  return null;
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

/** Headcount only when the message explicitly mentions employees — never bare digit runs. */
function sizeFromExplicit(text: string) {
  const m = text.match(
    /(\d{1,5})\s*(?:funcion[aá]rios|pessoas|colaboradores|colabs|funcionarios|vidas)\b/i,
  );
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 50000) return null;
  return String(n);
}

function bareHeadcount(text: string) {
  const m = text.trim().match(/^(\d{1,5})$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 50000) return null;
  // Reject zero-padded junk like "00045" (CNPJ fragment)
  if (/^0{2,}/.test(m[1])) return null;
  return String(n);
}

function cnpjFrom(text: string) {
  const d = digitsOnlyCnpj(text);
  if (d.length === 14 && isValidCnpj(d)) return formatCnpj(d);
  const m = text.match(
    /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/,
  );
  if (!m) return null;
  const fromFmt = digitsOnlyCnpj(m[1]);
  return fromFmt.length === 14 && isValidCnpj(fromFmt)
    ? formatCnpj(fromFmt)
    : null;
}

function looksLikeDocumentDigits(text: string) {
  const d = digitsOnlyCnpj(text.trim());
  return d.length >= 8 && d.length <= 14;
}

const SIZE_KEYS = [
  "colaboradores",
  "funcionarios",
  "funcionario",
  "colabs",
  "tamanho",
  "porte",
  "vidas",
  "qtd_colaboradores",
  "numero_colaboradores",
] as const;

function isSizeAttributeKey(key: string) {
  const k = key.toLowerCase();
  return (
    SIZE_KEYS.includes(k as (typeof SIZE_KEYS)[number]) ||
    /colabor|funcion|porte|tamanho|vidas?/.test(k)
  );
}

function isCnpjAttributeKey(key: string) {
  return /cnpj/.test(key.toLowerCase());
}

function isSetorAttributeKey(key: string) {
  const k = key.toLowerCase();
  return k === "setor" || k === "ramo" || /ramo|setor|segmento|atividade/.test(k);
}

function looksLikeHeadcountQuestion(body: string) {
  return /colabor|funcion|pessoas|porte|tamanho|equipe|quant(os|as)\s+(s[aã]o\s+)?(os\s+)?(colabor|funcion|pessoas)|n[uú]mero\s+de\s+(colabor|funcion)|quantos\s+colabor/i.test(
    body,
  );
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
      (key === "responsavel" ||
        key === "nome" ||
        key === "nome_responsavel") &&
      /respons[aá]vel|seu\s+nome|nome\s+completo|como\s+voc[eê]\s+se\s+chama/.test(
        body,
      )
    ) {
      return key;
    }
    if (isSizeAttributeKey(key) && looksLikeHeadcountQuestion(body)) {
      return key;
    }
    if (isCnpjAttributeKey(key) && looksLikeCnpjQuestion(body)) {
      return key;
    }
    if (
      isSetorAttributeKey(key) &&
      /setor|ramo|segmento|área|area|atividade/.test(body)
    ) {
      return key;
    }
  }
  return null;
}

function findAttr(
  attributes: ContactAttribute[],
  pred: (a: ContactAttribute) => boolean,
) {
  return attributes.find((a) => a.collect_via_ai && pred(a));
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
  const collectable = attributes.filter((a) => a.collect_via_ai);
  if (collectable.length === 0) return {};

  const pending = pendingKeys(attributes, currentValues);
  const byKey = new Map(collectable.map((a) => [a.key, a]));
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
  if (emailAttr && !(currentValues[emailAttr.key] ?? "").trim()) {
    const email = emailFrom(blob);
    if (email) {
      out[emailAttr.key] = email;
    } else {
      const asked = lastAiAskedFor(messages, [emailAttr.key, "email"]);
      if (asked) {
        const fromLatest = emailFrom(latestUserMessage);
        if (fromLatest) out[emailAttr.key] = fromLatest;
      }
    }
  }

  const companyAttr =
    byKey.get("empresa") ??
    byKey.get("company") ??
    byKey.get("company_name");
  if (companyAttr) {
    const empty = !(currentValues[companyAttr.key] ?? "").trim();
    if (empty) {
      for (const text of inboundTexts) {
        const company = companyFrom(text);
        if (company) {
          out[companyAttr.key] = company;
          break;
        }
      }
    }
    if (!out[companyAttr.key]) {
      const asked = lastAiAskedFor(messages, [
        companyAttr.key,
        "empresa",
        "company",
        "company_name",
      ]);
      if (asked) {
        const t = latestUserMessage.trim();
        if (
          t.length >= 2 &&
          t.length <= 120 &&
          !emailFrom(t) &&
          !/^\d+$/.test(t) &&
          !looksLikeDocumentDigits(t)
        ) {
          out[companyAttr.key] = t.replace(/\s+/g, " ");
        }
      }
    }
  }

  const cnpjAttr =
    findAttr(collectable, (a) => isCnpjAttributeKey(a.key)) ??
    byKey.get("cnpj");
  if (cnpjAttr) {
    const askedCnpj = lastAiAskedFor(messages, [cnpjAttr.key, "cnpj"]);
    // Allow overwrite when AI re-asks (correction after incomplete CNPJ)
    if (askedCnpj) {
      const fromLatest = cnpjFrom(latestUserMessage);
      if (fromLatest) out[cnpjAttr.key] = fromLatest;
    } else if (!(currentValues[cnpjAttr.key] ?? "").trim()) {
      for (const text of inboundTexts) {
        const cnpj = cnpjFrom(text);
        if (cnpj) {
          out[cnpjAttr.key] = cnpj;
          break;
        }
      }
    }
  }

  const sizeAttr =
    pending.find((a) => isSizeAttributeKey(a.key)) ??
    findAttr(collectable, (a) => isSizeAttributeKey(a.key)) ??
    findAttr(
      collectable,
      (a) =>
        a.type === "number" &&
        /colabor|funcion|porte|tamanho|qtd|quantidade|vidas?/.test(
          a.key + a.label,
        ),
    );
  if (sizeAttr) {
    const askedSize = lastAiAskedFor(messages, [
      sizeAttr.key,
      ...SIZE_KEYS,
    ]);
    // Bare "10" only right after the IA asked for headcount (allows correcting junk)
    if (askedSize) {
      const bare = bareHeadcount(latestUserMessage);
      if (bare) out[sizeAttr.key] = bare;
    }
    if (!out[sizeAttr.key] && !(currentValues[sizeAttr.key] ?? "").trim()) {
      for (const text of inboundTexts) {
        const size = sizeFromExplicit(text);
        if (size) {
          out[sizeAttr.key] = size;
          break;
        }
      }
    }
  }

  const nameAttr =
    byKey.get("responsavel") ??
    byKey.get("nome_responsavel") ??
    byKey.get("nome");
  if (nameAttr && !out[nameAttr.key] && !(currentValues[nameAttr.key] ?? "").trim()) {
    const asked = lastAiAskedFor(messages, [nameAttr.key]);
    if (asked === nameAttr.key && looksLikePersonName(latestUserMessage)) {
      out[nameAttr.key] = latestUserMessage.trim();
    }
  }

  const setorAttr =
    byKey.get("setor") ??
    byKey.get("ramo") ??
    findAttr(collectable, (a) => isSetorAttributeKey(a.key));
  if (
    setorAttr &&
    !out[setorAttr.key] &&
    !(currentValues[setorAttr.key] ?? "").trim()
  ) {
    const asked = lastAiAskedFor(messages, [
      setorAttr.key,
      "setor",
      "ramo",
    ]);
    if (asked && latestUserMessage.trim().length >= 2) {
      const t = latestUserMessage.trim();
      if (
        !emailFrom(t) &&
        !/^\d+$/.test(t) &&
        !looksLikeDocumentDigits(t) &&
        !cnpjFrom(t)
      ) {
        out[setorAttr.key] = t.slice(0, 120);
      }
    }
  }

  return out;
}

/** Last AI outbound asked for CNPJ (for code-side validation gate). */
export function lastOutboundAskedCnpj(messages: ChatLine[]) {
  const lastAi = [...messages]
    .reverse()
    .find((m) => m.direction === "outbound" && m.body);
  return Boolean(lastAi?.body && looksLikeCnpjQuestion(lastAi.body));
}

/**
 * Drop model hallucinations (CNPJ fragment → ramo/colaboradores, incomplete docs).
 */
export function sanitizeCollected(
  attributes: ContactAttribute[],
  collected: Record<string, string>,
): Record<string, string> {
  const byKey = new Map(attributes.map((a) => [a.key, a]));
  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(collected)) {
    if (!byKey.has(key)) continue;
    const value = raw.trim();
    if (!value) continue;

    if (isCnpjAttributeKey(key)) {
      if (value.toLowerCase() === "não informado" || value.toLowerCase() === "nao informado") {
        out[key] = "não informado";
        continue;
      }
      const d = digitsOnlyCnpj(value);
      if (!isValidCnpj(d)) continue;
      out[key] = formatCnpj(d);
      continue;
    }

    if (isSizeAttributeKey(key)) {
      const bare = bareHeadcount(value) ?? sizeFromExplicit(value);
      if (!bare) continue;
      out[key] = bare;
      continue;
    }

    if (isSetorAttributeKey(key)) {
      // Nunca gravar "5" / pedaço de porte em ramo
      if (
        /^\d+$/.test(value) ||
        looksLikeDocumentDigits(value) ||
        /^\d{1,5}\s*(colabor|funcion|pessoas|vidas)?/i.test(value)
      ) {
        continue;
      }
      if (value.length < 3) continue;
      out[key] = value.slice(0, 120);
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Required (or all collectable) fields filled → ready for human to close. */
export function requiredAttributesFilled(
  attributes: ContactAttribute[],
  currentValues: Record<string, string | null>,
) {
  const collectable = attributes.filter((a) => a.collect_via_ai);
  if (collectable.length === 0) return false;
  const required = collectable.filter((a) => a.required);
  const check = required.length > 0 ? required : collectable;
  return check.every((a) => (currentValues[a.key] ?? "").trim().length > 0);
}

/** Cliente quer fechar / comprar / contratar o que foi oferecido (não só pedir orçamento). */
export function wantsToCloseSale(text: string) {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (declinesPurchase(t)) return false;
  // Pedido de preço/info sem fechar — não conta como compra.
  if (
    /(or[cç]amento|pre[cç]o|valor|quanto\s+custa|me\s+passa|saber\s+mais|informa[cç][aã]o|d[uú]vida)/i.test(
      t,
    ) &&
    !/(contratar|comprar|fechar|aceito|contrato|vou\s+querer)/i.test(t)
  ) {
    return false;
  }
  return /\b((quero|vamos|vou|bora|pode)\s+(contratar|comprar|fechar)|quero\s+(esse|isso|a\s+proposta|o\s+servi[cç]o|o\s+pacote)|vou\s+querer|(vamos|bora)\s+(fechar|seguir|em\s+frente|com\s+(isso|a\s+proposta))|pode\s+(seguir|fechar|contratar|enviar\s+o\s+contrato|mandar\s+o\s+contrato)|(aceito|fechamos|topa)|(manda|envia|enviar)\s+(o\s+)?contrato|fechar\s+(a\s+)?compra|(contratar|comprar)\s+(agora|isso|esse|com\s+voc)|quero\s+fechar\s+(a\s+compra|com\s+voc))\b/i.test(
    t,
  );
}

/** Cliente recusou o orçamento / não quer seguir agora. */
export function declinesPurchase(text: string) {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /(n[aã]o\s+(quero|vou|preciso|tenho\s+interesse)|agora\s+n[aã]o|depois\s+(eu\s+)?(vejo|volto|decido)|s[oó]\s+pesquisando|vou\s+pensar|deixa\s+pra\s+l[aá]|obrigad[oa],?\s*(mas\s+)?n[aã]o|n[aã]o\s+rola|fica\s+pra\s+(outra|depois))/i.test(
    t,
  );
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
