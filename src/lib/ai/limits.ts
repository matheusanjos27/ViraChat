/**
 * Caps and guards to keep OpenAI token spend bounded per tenant.
 */

export const AI_LIMITS = {
  /** Max chars of model-facing instructions (after stripping preview block). */
  instructions: 2_000,
  /** Max chars kept when injecting playbook into the model prompt. */
  playbook: 2_200,
  /** Max chars the editor may save (must fit DEFAULT_PLAYBOOK_CONTENT). */
  playbookSaved: 4_500,
  about: 400,
  catalogBlock: 2_500,
  attributeBlock: 1_400,
  serviceDescription: 200,
  messageBody: 1_200,
  /** Turns of prior chat kept in the prompt (was 4 — caused re-asks). */
  historyTurns: 12,
  /** Default monthly token budget when tenant has no override. */
  defaultMonthlyTokens: 2_000_000,
  /** Wait before running AI so bursts coalesce into one call. */
  debounceMs: 1_500,
  /** Max completion tokens (provider). */
  maxCompletionTokens: 280,
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

/**
 * Early/short turns (ex.: "bom dia") — skip catalog, fields and funnel
 * so fixed overhead doesn't burn ~1k tokens on a greeting.
 */
export function isLightContextTurn(
  latestUserMessage: string,
  priorHistoryTurns: number,
): boolean {
  if (priorHistoryTurns > 2) return false;
  const msg = latestUserMessage.trim();
  if (!msg || msg.length > 48) return false;

  if (
    /^(oi|ol[aá]|oie|opa|eai|e\s*a[ií]|hey|hi|hello|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem\??|td\s*bem\??|obrigad[oa]|valeu|ok+|beleza|sim|nao|não)[\s!.?]*$/i.test(
      msg,
    )
  ) {
    return true;
  }

  if (
    msg.length <= 20 &&
    !/(or[cç]amento|pre[cç]o|plano|quero|preciso|contratar|servi[cç]o|valor|empresa|email|e-mail)/i.test(
      msg,
    )
  ) {
    return true;
  }

  return false;
}

export function clampSavedText(
  value: string,
  max: number,
): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  return { value: truncate(value, max), truncated: true };
}
