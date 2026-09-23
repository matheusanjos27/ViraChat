/**
 * Extrai a mensagem ao cliente do JSON do modelo — inclusive se veio truncado
 * (estouro de max_tokens) e o JSON.parse falha.
 */

export function looksLikeModelJsonEnvelope(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /^\s*[\{\[]/.test(t) && /"action"\s*:/i.test(t);
}

/** Desescapa sequência JSON típica dentro de "text". */
function unescapeJsonStringChunk(chunk: string): string {
  return chunk
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Puxa o valor de "text" mesmo com JSON incompleto
 * (ex.: cortou no meio da string).
 */
export function extractReplyTextFromModelRaw(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  try {
    const data = JSON.parse(trimmed) as { text?: unknown };
    if (typeof data.text === "string" && data.text.trim()) {
      return data.text.trim();
    }
  } catch {
    /* continua — pode estar truncado */
  }

  const marker = trimmed.match(/"text"\s*:\s*"/);
  if (!marker || marker.index == null) return null;

  const start = marker.index + marker[0].length;
  let out = "";
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "\\" && i + 1 < trimmed.length) {
      const n = trimmed[i + 1];
      if (n === "n") {
        out += "\n";
        i++;
        continue;
      }
      if (n === "r") {
        out += "\r";
        i++;
        continue;
      }
      if (n === "t") {
        out += "\t";
        i++;
        continue;
      }
      if (n === '"') {
        out += '"';
        i++;
        continue;
      }
      if (n === "\\") {
        out += "\\";
        i++;
        continue;
      }
      out += n;
      i++;
      continue;
    }
    if (c === '"') break;
    out += c;
  }

  const text = out.trim();
  if (!text || looksLikeModelJsonEnvelope(text)) return null;
  return text;
}

/** Nunca devolver envelope JSON ao WhatsApp. */
export function sanitizeOutboundAiText(
  text: string | null | undefined,
  fallback: string,
): string {
  const raw = (text ?? "").trim();
  if (!raw) return fallback;
  // Resposta truncada típica (estouro de tokens) — não manda lixo ao cliente.
  if (/^(voc[eê]|ok|sim|n[aã]o)[\s.!?…]*$/i.test(raw) || raw.length < 3) {
    return fallback;
  }
  if (!looksLikeModelJsonEnvelope(raw) && !/^\s*[\{\[]/.test(raw)) {
    return raw;
  }
  const extracted = extractReplyTextFromModelRaw(raw);
  if (extracted) {
    const e = extracted.trim();
    if (/^(voc[eê]|ok|sim|n[aã]o)[\s.!?…]*$/i.test(e) || e.length < 3) {
      return fallback;
    }
    return e;
  }
  return fallback;
}
