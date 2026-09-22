/** Validação de CNPJ em código (sem LLM). */

export const AI_CNPJ_ATTEMPT_LIMIT = 4;

export const CNPJ_SKIPPED_VALUE = "não informado";

export function digitsOnlyCnpj(value: string) {
  return value.replace(/\D/g, "");
}

function calcCheckDigit(digits: number[], weights: number[]) {
  const sum = digits.reduce((acc, d, i) => acc + d * weights[i], 0);
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/** Algoritmo oficial dos dígitos verificadores. */
export function isValidCnpj(value: string): boolean {
  const d = digitsOnlyCnpj(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const nums = d.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcCheckDigit(nums.slice(0, 12), w1);
  if (d1 !== nums[12]) return false;
  const d2 = calcCheckDigit(nums.slice(0, 13), w2);
  return d2 === nums[13];
}

export function formatCnpj(value: string) {
  const d = digitsOnlyCnpj(value);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export type CnpjAttemptStatus = "valid" | "incomplete" | "invalid";

/**
 * Mensagem parece resposta de CNPJ (não "não sei", não texto livre).
 * Ex.: "00045689", "12.345.678/0001-90", "09876543212345".
 */
export function looksLikeCnpjAttempt(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  if (
    /\b(n[aã]o\s+sei|nao\s+tenho|depois|pular|agora\s+n[aã]o|sem\s+cnpj)\b/i.test(
      t,
    )
  ) {
    return false;
  }
  const d = digitsOnlyCnpj(t);
  if (d.length < 5 || d.length > 14) return false;
  // Quase só dígitos / pontuação de CNPJ
  const nonDoc = t.replace(/[\d.\-\/\s]/g, "");
  return nonDoc.length <= 2;
}

export function classifyCnpjAttempt(text: string): CnpjAttemptStatus | null {
  if (!looksLikeCnpjAttempt(text)) return null;
  const d = digitsOnlyCnpj(text);
  if (d.length < 14) return "incomplete";
  if (isValidCnpj(d)) return "valid";
  return "invalid";
}

export function cnpjRetryText(status: "incomplete" | "invalid", attempt: number) {
  const left = Math.max(0, AI_CNPJ_ATTEMPT_LIMIT - attempt);
  const hint =
    left <= 1
      ? " Última tentativa — se não tiver o CNPJ agora, diga *não tenho*."
      : "";
  if (status === "incomplete") {
    return `O CNPJ parece incompleto (são 14 dígitos). Pode enviar o CNPJ completo?${hint}`;
  }
  return `Esse CNPJ não é válido. Pode conferir os números e enviar novamente?${hint}`;
}

export function looksLikeCnpjQuestion(body: string) {
  return /\bcnpj\b/i.test(body);
}
