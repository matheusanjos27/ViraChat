/**
 * Caps and guards to keep OpenAI token spend bounded per tenant.
 */

export const AI_LIMITS = {
  /** Max chars of model-facing instructions (after stripping preview block). */
  instructions: 4_000,
  playbook: 2_500,
  about: 800,
  catalogBlock: 3_000,
  attributeBlock: 1_500,
  serviceDescription: 200,
  messageBody: 1_500,
  historyTurns: 8,
  /** Default monthly token budget when tenant has no override. */
  defaultMonthlyTokens: 2_000_000,
  /** Wait before running AI so bursts coalesce into one call. */
  debounceMs: 1_500,
  /** Max completion tokens (provider). */
  maxCompletionTokens: 600,
} as const;

const SEP = "\n---\n";

/** Prefer the "prompt inicial" half; drop WhatsApp presentation fluff. */
export function instructionsForModel(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text) return "";
  if (text.includes(SEP)) {
    const parts = text.split(SEP);
    const presentation = (parts[0] ?? "").trim();
    const prompt = parts.slice(1).join(SEP).trim();
    return truncate(prompt || presentation, AI_LIMITS.instructions);
  }
  return truncate(text, AI_LIMITS.instructions);
}

export function truncate(text: string, max: number): string {
  const t = text ?? "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function wantsHuman(text: string): boolean {
  return /(atendente|humano|pessoa\s+real|falar\s+com\s+(algu[eé]m|voc[eê]s)|operador|suporte\s+humano)/i.test(
    text,
  );
}

export function clampSavedText(
  value: string,
  max: number,
): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  return { value: truncate(value, max), truncated: true };
}
