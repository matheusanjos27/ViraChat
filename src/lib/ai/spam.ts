/**
 * Heurística leve anti-abuso: mensagens sem sentido / flood.
 * Conservadora — não marca "10", e-mail, CNPJ, sim/não, nomes curtos.
 */

export const AI_SPAM_FLAG_LIMIT = 5;

const LEGIT_SHORT =
  /^(oi|ol[aá]|oie|opa|ok+|okay|beleza|sim|n[aã]o|nao|claro|pode|quero|valeu|obrigad[oa]|bom\s*dia|boa\s*tarde|boa\s*noite|al+[oô]u?|t[aá]\s*a[ií]|e\s*a[ií]|fechamos|bora|vamos)[\s!.?]*$/i;

export function isLikelySpamMessage(
  text: string,
  opts?: {
    recentInboundBodies?: string[];
  },
): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;

  // Respostas legítimas curtas / dados
  if (LEGIT_SHORT.test(t)) return false;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(t)) return false;
  if (/^\d{1,5}$/.test(t)) return false; // colaboradores / qtd
  if (/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(t.replace(/\s/g, ""))) {
    return false; // CNPJ
  }
  if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(t.replace(/\s/g, ""))) {
    return false; // CPF
  }
  if (/^[\d\s().+-]{8,20}$/.test(t) && /\d{8,}/.test(t.replace(/\D/g, ""))) {
    return false; // telefone
  }

  // Nome curto razoável (2–4 palavras)
  if (
    t.length <= 60 &&
    /^[\p{L}\s'.-]+$/u.test(t) &&
    t.split(/\s+/).length <= 4 &&
    t.split(/\s+/).every((w) => w.length >= 2)
  ) {
    return false;
  }

  // Frase com palavras PT comuns
  if (
    /\b(quero|preciso|or[cç]amento|empresa|plano|pre[cç]o|valor|colabor|funcion|cnpj|email|e-mail|atendente|fechar|contratar|servi[cç]o|pgr|pcmso)\b/i.test(
      t,
    )
  ) {
    return false;
  }

  // Mesma mensagem repetida 3x seguidas
  const recent = (opts?.recentInboundBodies ?? [])
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);
  const norm = t.toLowerCase();
  if (recent.length >= 2) {
    const last3 = [...recent.slice(-2), norm];
    if (last3.length >= 3 && last3.every((x) => x === norm)) {
      return true;
    }
  }

  // Teclado smash / lixo
  if (/(.)\1{5,}/.test(t)) return true; // aaaaaaa
  if (/^(asdf|qwer|zxcv|hjkl|test+|aaa+|xxx+|kkk+)[\s!.?]*$/i.test(t)) {
    return true;
  }

  // Só símbolos / emojis longos
  const letters = t.replace(/[^\p{L}\p{N}]/gu, "");
  if (t.length >= 8 && letters.length < 2) return true;

  // Sem espaços, longo, poucas vogais → gibberish
  if (t.length >= 12 && !/\s/.test(t) && !/@/.test(t) && !/\d{4,}/.test(t)) {
    const lower = letters.toLowerCase();
    if (lower.length >= 10) {
      const vowels = (lower.match(/[aeiouáéíóúâêôãõ]/g) ?? []).length;
      if (vowels / lower.length < 0.18) return true;
    }
  }

  // Mensagem muito longa e aleatória (flood de lixo)
  if (t.length > 400 && letters.length / t.length < 0.4) return true;

  return false;
}
