/** Versão do texto — atualize se mudar a redação apresentada ao lead. */
export const AI_LGPD_CONSENT_VERSION = "v1";

export const AI_LGPD_CONSENT_ASK =
  "Antes de eu pedir os dados para montar o orçamento, preciso do seu ok (LGPD):\n\nVou tratar nome, empresa, e-mail, CNPJ e demais informações que você enviar *somente* para elaborar a proposta e o atendimento comercial. Você pode pedir a exclusão depois.\n\nPode me autorizar? Responde *sim* ou *não*.";

export const AI_LGPD_CONSENT_DECLINED =
  "Tudo bem — sem a autorização eu não posso coletar esses dados. Se mudar de ideia ou preferir falar com um atendente, é só chamar.";

/** Lead confirma ceder dados para orçamento. */
export function affirmsLgpdConsent(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(sim|s+|autorizo|autorizado|pode|pode\s+ser|claro|ok+|okay|beleza|concordo|aceito|pode\s+pedir|pode\s+coletar)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(^|\b)(sim[,.]?\s*(autorizo|pode|quero)?|autorizo|concordo|aceito\s+(a\s+)?(lgpd|coleta|usar\s+os\s+dados)|pode\s+(pedir|coletar|usar)|autorizo\s+(os\s+)?dados)(\b|$)/i.test(
    t,
  );
}

/** Lead recusa o consentimento. */
export function declinesLgpdConsent(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (
    /^(n[aã]o|nao|n+|negativo|agora\s+n[aã]o|melhor\s+n[aã]o)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return /(n[aã]o\s+(autorizo|aceito|quero|concordo)|sem\s+(autoriza[cç][aã]o|lgpd)|n[aã]o\s+(cedo|passo)\s+(os\s+)?dados)/i.test(
    t,
  );
}

/** A IA já pediu o ok LGPD (evita repetir a cada mensagem). */
export function offersLgpdConsentAsk(text: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  return /(lgpd|autorizar|autoriza[cç][aã]o).{0,80}(dados|or[cç]amento|sim\s*ou\s*n[aã]o)|(pode\s+me\s+autorizar|antes\s+de\s+(eu\s+)?pedir\s+os\s+dados)/i.test(
    t,
  );
}
