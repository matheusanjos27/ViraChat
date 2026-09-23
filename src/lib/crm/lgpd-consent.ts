/** Versão do texto — atualize se mudar a redação apresentada ao lead. */
export const AI_LGPD_CONSENT_VERSION = "v2";

/** Marcador em lgpd_consent_version quando o lead recusou. */
export const AI_LGPD_DECLINED_VERSION = "declined:v2";

export const AI_LGPD_CONSENT_ASK =
  "Antes de eu pedir os dados para montar o orçamento, preciso do seu ok (LGPD):\n\nVou usar nome, empresa, e-mail, CNPJ e demais informações que você enviar *somente* para elaborar a proposta e o atendimento comercial da empresa.\n\nPode me autorizar? Responde *autorizo* ou *não*.";

export const AI_LGPD_CONSENT_REMIND =
  "Para eu poder coletar os dados e montar o orçamento, preciso do seu *autorizo* ou *não* (LGPD).";

export const AI_LGPD_CONSENT_DECLINED =
  "Tudo bem — sem a autorização eu não posso coletar esses dados. Se mudar de ideia, responde *autorizo*. Se preferir falar com um atendente, é só pedir.";

export function isLgpdDeclinedVersion(version: string | null | undefined) {
  return Boolean(version && /^declined/i.test(version));
}

/**
 * Lead confirma ceder dados para orçamento.
 * NÃO aceita "ok"/"beleza"/"pode" sozinhos (bug: após recusar LGPD, "Ok" liberava a coleta).
 */
export function affirmsLgpdConsent(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(autorizo|autorizado|sim[,.]?\s*autorizo|sim|s+|concordo|aceito)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(^|\b)(autorizo|sim[,.]?\s*autorizo|concordo(\s+com\s+(a\s+)?(lgpd|coleta))?|aceito\s+(a\s+)?(lgpd|coleta|usar\s+os\s+dados)|autorizo\s+(os\s+)?dados|pode\s+(pedir|coletar)\s+(os\s+)?dados)(\b|$)/i.test(
    t,
  );
}

/** Após recusa, só reabre com autorização explícita (não "ok"). */
export function reaffirmsLgpdAfterDecline(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /^(autorizo|autorizado|sim[,.]?\s*autorizo)[\s!.?]*$/i.test(t) ||
    /(^|\b)(autorizo|mudei\s+de\s+ideia|quero\s+autorizar)(\b|$)/i.test(t);
}

/** Lead recusa o consentimento. */
export function declinesLgpdConsent(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(n[aã]o|nao|n+|negativo|agora\s+n[aã]o|melhor\s+n[aã]o|n[aã]o\s+autorizo)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(n[aã]o\s+(autorizo|aceito|quero|concordo)|sem\s+(autoriza[cç][aã]o|lgpd)|n[aã]o\s+(cedo|passo)\s+(os\s+)?dados)/i.test(
    t,
  );
}

/** A IA já pediu o ok LGPD (evita confundir com oferta de atendente). */
export function offersLgpdConsentAsk(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return (
    /\blgpd\b/i.test(t) ||
    /(autorizar|autoriza[cç][aã]o).{0,80}(dados|or[cç]amento)|pode\s+me\s+autorizar|antes\s+de\s+(eu\s+)?pedir\s+os\s+dados|responde\s*\*?autorizo/i.test(
      t,
    )
  );
}
