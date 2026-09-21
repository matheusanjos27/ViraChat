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
  maxCompletionTokens: 360,
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

/** Cliente confirma a oferta de falar com atendente (após a IA perguntar). */
export function affirmsHandoffOffer(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(sim|s+|quero|pode|pode\s+ser|claro|ok+|okay|beleza|isso|afirmativo|por\s+favor|pfv|manda|vai|transfer[ea]|pode\s+transfer)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(^|\b)(sim[,.]?\s*(quero|pode|por\s+favor)?|quero\s+(sim|falar|atendente|humano)|pode\s+(sim|transfer|passar)|pode\s+passar\s+pro?\s+atendente)(\b|$)/i.test(
    t,
  );
}

/** Cliente recusa a oferta de atendente. */
export function declinesHandoffOffer(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(n[aã]o|nao|n+|negativo|deixa|agora\s+n[aã]o|melhor\s+n[aã]o|obrigad[oa])[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(n[aã]o\s+(quero|preciso|agora|obrigad)|prefiro\s+(continuar|falar)\s+(com\s+)?(voc[eê]|a\s+ia)|continua\s+(voc[eê]|a[ií])|sem\s+atendente)/i.test(
    t,
  );
}

/** Texto da IA que já oferece / pede confirmação de handoff (evita perguntar 2x). */
export function offersHandoffConfirmation(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /(deseja|quer(e)?|posso|pode|gostaria).{0,40}(atendente|humano|especialista|equipe|algu[eé]m)|(falar|passar|transfer).{0,30}(atendente|humano)|(sim\s*ou\s*n[aã]o|responde\s*\*?sim)/i.test(
    t,
  );
}

export const HANDOFF_OFFER_QUESTION =
  "Posso te passar para um atendente humano agora? Responde *sim* ou *não*.";

/** Junta conteúdo útil + pergunta única de confirmação (sem duplicar). */
export function buildHandoffOfferText(priorText?: string | null): string {
  const raw = (priorText ?? "").trim();
  if (!raw) return HANDOFF_OFFER_QUESTION;
  // Já perguntou sim/não — não acrescenta outra frase.
  if (offersHandoffConfirmation(raw)) return raw;
  // Prometeu transferir direto — troca a promessa pela pergunta.
  if (/vou te transfer|transferir para um atendente/i.test(raw)) {
    const cleaned = raw
      .replace(
        /[^.!?\n]*(vou te transfer|transferir para um atendente)[^.!?\n]*[.!?]?\s*/gi,
        "",
      )
      .trim();
    return cleaned
      ? `${cleaned}\n\n${HANDOFF_OFFER_QUESTION}`
      : HANDOFF_OFFER_QUESTION;
  }
  return `${raw}\n\n${HANDOFF_OFFER_QUESTION}`;
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
    !/(or[cç]amento|pre[cç]o|plano|quero|preciso|contratar|servi[cç]o|produto|valor|empresa|email|e-mail|cat[aá]logo|vende|comprar|shampoo|tem\b|quais|lista)/i.test(
      msg,
    )
  ) {
    return true;
  }

  return false;
}

/** Cliente pediu para ver o que a empresa vende / listar catálogo. */
export function wantsCatalogList(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /(o\s+que\s+(voc[eê]s?\s+)?(t[eê]m|vende|oferece)|quais?\s+(s[aã]o\s+)?(os\s+)?(produtos?|servi[cç]os?|op[cç][oõ]es|itens)|lista(r)?\s+(de\s+)?(produtos?|servi[cç]os?|op[cç][oõ]es)|me\s+(mostra|passa|manda).{0,20}(produtos?|cat[aá]logo|op[cç][oõ]es)|cat[aá]logo|o\s+que\s+vende|tem\s+o\s+que|voc[eê]s?\s+t[eê]m\s+o\s+que)/i.test(
    t,
  );
}

export function clampSavedText(
  value: string,
  max: number,
): { value: string; truncated: boolean } {
  if (value.length <= max) return { value, truncated: false };
  return { value: truncate(value, max), truncated: true };
}
