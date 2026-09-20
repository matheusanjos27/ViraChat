import type { createServiceClient } from "@/lib/supabase/admin";

type Stage = { id: string; name: string; sort_order: number };
type Supabase = ReturnType<typeof createServiceClient>;

export function buildFunnelPromptBlock(stages: { name: string }[]) {
  if (stages.length === 0) return "";
  const names = stages.map((s) => s.name).join(" → ");
  return `
FUNIL DE VENDAS (atualize deal_stage no JSON quando o lead avançar):
Etapas: ${names}

Regras:
- Interesse comercial / pediu info ou orçamento → "Qualificado" (ou equivalente)
- Você apresentou preço/orçamento com base no catálogo → "Orçamento"
- Cliente pediu proposta formal / fechamento → "Proposta"
- Negociando valor/prazo → "Negociação"
- Confirmou compra → etapa de ganho (ex: "Fechado")
- Desistiu / sem interesse → etapa de perda (ex: "Perdido")
Inclua "deal_stage" com o NOME EXATO de uma etapa acima sempre que avançar.
`.trim();
}

/** Infer stage from conversation signals when the model omits deal_stage. */
export function inferDealStageHint(input: {
  latestUserMessage: string;
  aiReplyText?: string;
  collectedKeys: string[];
  filledAttrCount: number;
  quotedThisTurn: boolean;
}): string | null {
  const user = input.latestUserMessage.toLowerCase();
  const ai = (input.aiReplyText ?? "").toLowerCase();
  const blob = `${user}\n${ai}`;

  if (
    /n[aã]o\s+tenho\s+interesse|desisti|cancel[ae]|n[aã]o\s+quero|pode\s+parar/.test(
      user,
    )
  ) {
    return "Perdido";
  }

  if (
    /fechamos|pode\s+contratar|vamos\s+fechar|aceito|pode\s+seguir|quero\s+contratar/.test(
      user,
    )
  ) {
    return "Fechado";
  }

  if (
    /desconto|mais\s+barato|negoci|parcel|condi[cç][aã]o/.test(user) ||
    /negoci/.test(ai)
  ) {
    return "Negociação";
  }

  if (
    input.quotedThisTurn ||
    /r\$\s*\d|valor\s+total|or[cç]amento/.test(ai) ||
    (/or[cç]amento|pre[cç]o|quanto\s+custa|valores?/.test(user) &&
      /r\$\s*\d|por\s+r\$|valor/.test(ai))
  ) {
    return "Orçamento";
  }

  if (
    /proposta|contrato|proposta\s+formal/.test(blob) &&
    !/or[cç]amento/.test(ai)
  ) {
    return "Proposta";
  }

  if (
    input.filledAttrCount >= 2 ||
    input.collectedKeys.length >= 2 ||
    /or[cç]amento|interessad|quero\s+saber|preciso\s+de|planos?/.test(user)
  ) {
    return "Qualificado";
  }

  return null;
}

function scoreStageMatch(stageName: string, hint: string) {
  const a = stageName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const b = hint.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  // common aliases
  const aliases: Record<string, string[]> = {
    orcamento: ["orcamento", "quote", "pricing", "preco"],
    qualificado: ["qualificado", "qualified", "interesse"],
    proposta: ["proposta", "proposal"],
    negociacao: ["negociacao", "negotiation", "negoci"],
    fechado: ["fechado", "ganho", "won", "closed won"],
    perdido: ["perdido", "lost", "closed lost"],
    novo: ["novo", "new", "lead"],
  };
  for (const [canon, list] of Object.entries(aliases)) {
    if (list.some((x) => a.includes(x) || b.includes(x)) && a.includes(canon)) {
      return 60;
    }
    if (
      list.some((x) => b.includes(x)) &&
      list.some((x) => a.includes(x) || a.includes(canon))
    ) {
      return 55;
    }
  }
  return 0;
}

export function resolveStageId(stages: Stage[], hint: string) {
  let best: Stage | null = null;
  let bestScore = 0;
  for (const s of stages) {
    const score = scoreStageMatch(s.name, hint);
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return bestScore >= 55 ? best : null;
}

/** Only advance forward in the funnel (never go backwards), except Perdido. */
export async function ensureDealAndAdvanceStage(input: {
  supabase: Supabase;
  tenantId: string;
  contactId: string;
  conversationId: string;
  contactName: string | null;
  stageHint: string | null;
  dealValue?: number | null;
}) {
  const { supabase, tenantId, contactId, conversationId } = input;

  const { data: stagesRaw } = await supabase
    .from("deal_stages")
    .select("id, name, sort_order, is_closed_lost")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const stages = (stagesRaw ?? []) as (Stage & { is_closed_lost?: boolean })[];
  if (stages.length === 0) return;

  let { data: deal } = await supabase
    .from("deals")
    .select("id, stage_id, value")
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();

  if (!deal) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("display_name, company_name, phone_e164")
      .eq("id", contactId)
      .maybeSingle();

    const title =
      contact?.company_name ||
      contact?.display_name ||
      input.contactName ||
      contact?.phone_e164 ||
      "Novo lead";

    const first = stages[0];
    const { data: created } = await supabase
      .from("deals")
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        conversation_id: conversationId,
        stage_id: first.id,
        title,
        value: input.dealValue ?? null,
      })
      .select("id, stage_id, value")
      .maybeSingle();
    deal = created;
  }

  if (!deal) return;

  const patch: { stage_id?: string; value?: number } = {};
  if (input.dealValue != null && input.dealValue > 0) {
    patch.value = input.dealValue;
  }

  if (input.stageHint) {
    const target = resolveStageId(stages, input.stageHint);
    if (target) {
      const current = stages.find((s) => s.id === deal!.stage_id);
      const isLost = Boolean(
        stages.find((s) => s.id === target.id && (s as { is_closed_lost?: boolean }).is_closed_lost) ||
          /perdido|lost/i.test(target.name),
      );
      const canAdvance =
        isLost ||
        !current ||
        target.sort_order >= current.sort_order;
      if (canAdvance && target.id !== deal.stage_id) {
        patch.stage_id = target.id;
      }
    }
  }

  if (Object.keys(patch).length === 0) return;

  await supabase.from("deals").update(patch).eq("id", deal.id);
}
