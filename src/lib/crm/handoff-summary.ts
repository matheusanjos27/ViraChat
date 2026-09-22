import { truncate } from "@/lib/ai/limits";

const NOTE_MARK = "--- Resumo IA";
const MAX_NOTES = 4_000;

export function buildDeterministicHandoffSummary(input: {
  reason: string;
  latestUserMessage?: string | null;
  values?: Record<string, string | null>;
  quotedTotal?: number | null;
}): string {
  const lines: string[] = [];
  const reasonLabel =
    input.reason === "explicit_human_request"
      ? "Cliente pediu atendente humano"
      : input.reason === "cliente_confirmou_atendente"
        ? "Cliente confirmou que quer atendente"
        : input.reason === "callback_agendado"
          ? "IA encerrou — equipe deve retornar depois"
          : input.reason === "cliente_quer_fechar"
            ? "Cliente quer fechar / contratar"
            : input.reason === "dados_coletados_fechamento"
              ? "Dados coletados — finalizar venda"
              : input.reason;

  lines.push(`Motivo: ${reasonLabel}`);

  const known = Object.entries(input.values ?? {})
    .filter(([, v]) => (v ?? "").trim())
    .map(([k, v]) => `${k}=${(v ?? "").trim()}`);
  if (known.length) {
    lines.push(`Dados: ${known.join("; ")}`);
  }

  if (input.quotedTotal != null && input.quotedTotal > 0) {
    lines.push(
      `Orçamento: R$ ${input.quotedTotal.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })}`,
    );
  }

  const last = input.latestUserMessage?.trim();
  if (last) {
    lines.push(`Última mensagem do cliente: ${truncate(last, 220)}`);
  }

  lines.push("Próximo passo: assumir a conversa e seguir com o cliente.");
  return lines.join("\n");
}

/** Anexa (substituindo o bloco IA anterior) o resumo nas observações do lead. */
export function mergeHandoffNote(
  existing: string | null | undefined,
  summary: string,
  at = new Date(),
): string {
  const when = at.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const block = `${NOTE_MARK} (${when}) ---\n${summary.trim()}`;

  let base = (existing ?? "").trim();
  const idx = base.lastIndexOf(NOTE_MARK);
  if (idx >= 0) base = base.slice(0, idx).trim();

  const merged = [base, block].filter(Boolean).join("\n\n");
  if (merged.length <= MAX_NOTES) return merged;
  return merged.slice(merged.length - MAX_NOTES).trim();
}

export function extractLatestHandoffSummary(
  notes: string | null | undefined,
): string | null {
  const text = notes ?? "";
  const idx = text.lastIndexOf(NOTE_MARK);
  if (idx < 0) return null;
  return text.slice(idx).trim();
}
