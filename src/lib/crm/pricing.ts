import { AI_LIMITS, truncate } from "@/lib/ai/limits";

export type BillingType = "fixed" | "per_unit" | "tiered";
export type TierPriceMode = "flat" | "per_unit";

export type PricingTier = {
  id?: string;
  min_units: number;
  max_units: number | null;
  price: number;
  price_mode: TierPriceMode;
  sort_order?: number;
};

export type ServiceForQuote = {
  id: string;
  name: string;
  description: string | null;
  billing_type: BillingType;
  unit_label: string;
  unit_attribute_key: string | null;
  base_price: number;
  min_price: number | null;
  is_active: boolean;
  tiers: PricingTier[];
};

export type QuoteLine = {
  serviceId: string;
  serviceName: string;
  units: number;
  unitLabel: string;
  amount: number;
  explanation: string;
};

export type QuoteResult = {
  lines: QuoteLine[];
  total: number;
  currency: string;
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Calcula o valor de um serviço para N unidades. */
export function quoteService(
  service: ServiceForQuote,
  units: number,
): QuoteLine | null {
  if (!service.is_active) return null;
  const u = Math.max(0, Math.floor(units) || 0);

  if (service.billing_type === "fixed") {
    const amount = Number(service.base_price) || 0;
    return {
      serviceId: service.id,
      serviceName: service.name,
      units: u,
      unitLabel: service.unit_label,
      amount,
      explanation: `Valor fixo ${money(amount)}`,
    };
  }

  if (service.billing_type === "per_unit") {
    const raw = u * (Number(service.base_price) || 0);
    const min = service.min_price != null ? Number(service.min_price) : 0;
    const amount = Math.max(raw, min);
    const explanation =
      min > 0 && raw < min
        ? `${u} × ${money(Number(service.base_price))} = ${money(raw)} → mínimo ${money(min)}`
        : `${u} × ${money(Number(service.base_price))} = ${money(amount)}`;
    return {
      serviceId: service.id,
      serviceName: service.name,
      units: u,
      unitLabel: service.unit_label,
      amount,
      explanation,
    };
  }

  // tiered
  const tiers = [...(service.tiers ?? [])].sort(
    (a, b) => a.min_units - b.min_units,
  );
  const tier = tiers.find(
    (t) => u >= t.min_units && (t.max_units == null || u <= t.max_units),
  );

  if (!tier) {
    // fallback: última faixa aberta ou per_unit base
    const last = tiers[tiers.length - 1];
    if (last && last.max_units == null && u >= last.min_units) {
      const amount =
        last.price_mode === "per_unit" ? u * Number(last.price) : Number(last.price);
      return {
        serviceId: service.id,
        serviceName: service.name,
        units: u,
        unitLabel: service.unit_label,
        amount,
        explanation:
          last.price_mode === "per_unit"
            ? `Faixa ${last.min_units}+: ${u} × ${money(Number(last.price))}`
            : `Faixa ${last.min_units}+: ${money(Number(last.price))}`,
      };
    }
    return null;
  }

  const amount =
    tier.price_mode === "per_unit"
      ? u * Number(tier.price)
      : Number(tier.price);
  const range =
    tier.max_units == null
      ? `${tier.min_units}+`
      : `${tier.min_units}–${tier.max_units}`;
  const explanation =
    tier.price_mode === "per_unit"
      ? `Faixa ${range}: ${u} × ${money(Number(tier.price))} = ${money(amount)}`
      : `Faixa ${range}: ${money(amount)} (fixo)`;

  return {
    serviceId: service.id,
    serviceName: service.name,
    units: u,
    unitLabel: service.unit_label,
    amount,
    explanation,
  };
}

/** Orça uma lista de serviços para a mesma quantidade. */
export function quoteCatalog(
  services: ServiceForQuote[],
  units: number,
  selectedIds?: string[],
): QuoteResult {
  const selected = selectedIds?.length
    ? services.filter((s) => selectedIds.includes(s.id))
    : services.filter((s) => s.is_active);

  const lines = selected
    .map((s) => quoteService(s, units))
    .filter((l): l is QuoteLine => l != null && l.amount >= 0);

  return {
    lines,
    total: lines.reduce((acc, l) => acc + l.amount, 0),
    currency: "BRL",
  };
}

/** Serializa o catálogo para o prompt da IA. */
export function buildCatalogPromptBlock(services: ServiceForQuote[]) {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0) return "";

  const blocks = active.map((s) => {
    const desc = s.description
      ? ` — ${truncate(s.description, AI_LIMITS.serviceDescription)}`
      : "";
    if (s.billing_type === "fixed") {
      return `- ${s.name}: valor fixo ${money(Number(s.base_price))}${desc}`;
    }
    if (s.billing_type === "per_unit") {
      const min =
        s.min_price != null ? `, mínimo ${money(Number(s.min_price))}` : "";
      return `- ${s.name}: ${money(Number(s.base_price))} por ${s.unit_label}${min}${desc}`;
    }
    const tiers = [...s.tiers]
      .sort((a, b) => a.min_units - b.min_units)
      .map((t) => {
        const range =
          t.max_units == null
            ? `${t.min_units}+`
            : `${t.min_units}–${t.max_units}`;
        const price =
          t.price_mode === "per_unit"
            ? `${money(Number(t.price))}/${s.unit_label}`
            : `${money(Number(t.price))} fixo`;
        return `  · ${range}: ${price}`;
      })
      .join("\n");
    return `- ${s.name} (por faixas de ${s.unit_label})${desc}:\n${tiers}`;
  });

  return truncate(
    `
CATÁLOGO DE SERVIÇOS E PREÇOS (use estes valores — nunca invente preços):
${blocks.join("\n")}

Quando o cliente pedir orçamento e você souber a quantidade (${active[0]?.unit_label ?? "unidades"}), calcule com as regras acima e apresente a proposta de forma clara, separando mensalidade de serviços avulsos se fizer sentido.
Se faltar a quantidade, pergunte antes de precificar.
`.trim(),
    AI_LIMITS.catalogBlock,
  );
}

/** Formata um QuoteResult para exibir no WhatsApp / UI. */
export function formatQuoteMessage(quote: QuoteResult, units: number) {
  if (quote.lines.length === 0) return "Nenhum serviço ativo para orçar.";
  const lines = quote.lines
    .map((l) => `✅ ${l.serviceName}\n${l.explanation}`)
    .join("\n\n");
  return `📊 PROPOSTA (${units} un.)\n\n${lines}\n\n💰 Total: ${money(quote.total)}`;
}
