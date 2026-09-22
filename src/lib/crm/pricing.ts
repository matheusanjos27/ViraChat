import { AI_LIMITS, truncate } from "@/lib/ai/limits";

export type BillingType = "fixed" | "per_unit" | "tiered";
export type TierPriceMode = "flat" | "per_unit";
export type OfferKind = "product" | "service";

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
  offer_kind: OfferKind;
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

function normalizeQuoteText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const WEAK_NAME_TOKENS = new Set([
  "plano",
  "para",
  "com",
  "ate",
  "até",
  "de",
  "da",
  "do",
  "em",
  "e",
  "ou",
  "colaboradores",
  "colaborador",
  "mensal",
  "basico",
  "básico",
  "trabalho",
  "treinamento",
  "servico",
  "serviço",
  "programa",
]);

/** Itens do catálogo citados no texto (ex.: "quero o plano X"). */
export function matchCatalogIdsFromText(
  services: ServiceForQuote[],
  text: string,
): string[] {
  const t = normalizeQuoteText(text ?? "");
  if (!t.trim()) return [];

  const hits: string[] = [];
  for (const s of services.filter((x) => x.is_active)) {
    const name = normalizeQuoteText(s.name);
    if (name.length >= 2 && t.includes(name)) {
      hits.push(s.id);
      continue;
    }
    const tokens = name
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !WEAK_NAME_TOKENS.has(w));
    for (const tok of tokens) {
      const re = new RegExp(`(?:^|[^a-z0-9])${tok}(?:[^a-z0-9]|$)`, "i");
      if (re.test(t)) {
        hits.push(s.id);
        break;
      }
    }
  }
  return [...new Set(hits)];
}

/**
 * Orça só quando a seleção é clara — evita somar o catálogo inteiro
 * (ex.: cliente pediu um item e o deal somava o catálogo inteiro).
 */
export function quoteCatalogFocused(
  services: ServiceForQuote[],
  units: number,
  opts?: { selectedIds?: string[]; mentionText?: string },
): QuoteResult {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0 || !(units > 0)) {
    return { lines: [], total: 0, currency: "BRL" };
  }

  let ids = (opts?.selectedIds ?? []).filter(Boolean);
  if (ids.length === 0 && opts?.mentionText) {
    // Última fala do cliente manda: se citar item, ignore menções antigas.
    const chunks = opts.mentionText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const latest = chunks[0] ?? "";
    const latestHits = matchCatalogIdsFromText(active, latest);
    ids =
      latestHits.length > 0
        ? latestHits
        : matchCatalogIdsFromText(active, opts.mentionText);
  }
  if (ids.length === 0 && active.length === 1) {
    ids = [active[0].id];
  }
  if (ids.length === 0) {
    return { lines: [], total: 0, currency: "BRL" };
  }
  return quoteCatalog(services, units, ids);
}

/**
 * Nomes do catálogo (sem preços) — material para a IA organizar a 1ª mensagem.
 * Preços ficam no CATÁLOGO OFICIAL completo nas demais voltas / orçamento.
 */
export function buildOpeningCatalogOutline(services: ServiceForQuote[]) {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0) {
    return truncate(
      `CATÁLOGO VAZIO: não há itens ativos.
NÃO invente produtos. Informe e ofereça handoff.`,
      AI_LIMITS.catalogBlock,
    );
  }

  const fixed = active.filter((s) => s.billing_type === "fixed");
  const tiered = active.filter((s) => s.billing_type === "tiered");
  const perUnit = active.filter((s) => s.billing_type === "per_unit");

  const line = (items: ServiceForQuote[]) =>
    items.map((s) => `- ${s.name}`).join("\n");

  const parts: string[] = [
    `CATÁLOGO OFICIAL (só NOMES — use para organizar a mensagem; NÃO cole esta lista crua; NÃO invente preços nesta abertura):`,
  ];
  if (fixed.length || tiered.length) {
    parts.push(`Valor fixo / faixas:\n${line([...fixed, ...tiered])}`);
  }
  if (perUnit.length) {
    parts.push(`Por unidade:\n${line(perUnit)}`);
  }
  parts.push(
    `Siga o ROTEIRO (Abertura). Resposta curta e organizada — sem wall de preços.`,
  );
  return truncate(parts.join("\n\n"), AI_LIMITS.catalogBlock);
}

/** Serializa o catálogo para o prompt da IA. */
export function buildCatalogPromptBlock(services: ServiceForQuote[]) {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0) {
    return truncate(
      `CATÁLOGO VAZIO: não há produtos/serviços ativos cadastrados.
NÃO invente produtos, pacotes, preços nem descrições genéricas.
Informe que não há oferta cadastrada e faça handoff para um atendente.`,
      AI_LIMITS.catalogBlock,
    );
  }

  const blocks = active.map((s) => {
    const kindLabel =
      s.offer_kind === "service" ? "SERVIÇO" : "PRODUTO";
    const desc = s.description
      ? ` — ${truncate(s.description, AI_LIMITS.serviceDescription)}`
      : "";
    if (s.billing_type === "fixed") {
      return `- [${kindLabel}] ${s.name}: valor fixo ${money(Number(s.base_price))}${desc}`;
    }
    if (s.billing_type === "per_unit") {
      const min =
        s.min_price != null ? `, mínimo ${money(Number(s.min_price))}` : "";
      return `- [${kindLabel}] ${s.name}: ${money(Number(s.base_price))} por ${s.unit_label}${min}${desc}`;
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
    return `- [${kindLabel}] ${s.name} (por faixas de ${s.unit_label})${desc}:\n${tiers}`;
  });

  return truncate(
    `CATÁLOGO OFICIAL — lista FECHADA (copie nomes/preços daqui; é proibido inventar item genérico):
${blocks.join("\n")}
Regras: (1) ao listar o que vende, use SOMENTE estes itens; (2) diga se é PRODUTO ou SERVIÇO conforme a tag; (3) se o cliente pedir algo fora da lista, diga que não tem cadastrado e ofereça o item mais próximo da lista OU handoff; (4) nunca invente nomes que não estejam acima.`,
    AI_LIMITS.catalogBlock,
  );
}

/** Lista determinística do catálogo (WhatsApp) — evita alucinação da IA. */
export function formatCatalogListMessage(services: ServiceForQuote[]) {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0) {
    return "No momento não tenho produtos/serviços ativos no catálogo. Posso te passar para um atendente?";
  }

  const products = active.filter((s) => s.offer_kind !== "service");
  const servicesOnly = active.filter((s) => s.offer_kind === "service");

  const linesFor = (items: ServiceForQuote[]) =>
    items
      .map((s, i) => {
        const price =
          s.billing_type === "fixed"
            ? money(Number(s.base_price))
            : s.billing_type === "per_unit"
              ? `${money(Number(s.base_price))}/${s.unit_label}`
              : `a partir das faixas de ${s.unit_label}`;
        const desc = s.description
          ? ` — ${truncate(s.description, 120)}`
          : "";
        return `${i + 1}. *${s.name}*${desc}\n   ${price}`;
      })
      .join("\n\n");

  const parts: string[] = ["No nosso catálogo temos:"];
  if (products.length) {
    parts.push(`*Produtos*\n${linesFor(products)}`);
  }
  if (servicesOnly.length) {
    parts.push(`*Serviços*\n${linesFor(servicesOnly)}`);
  }
  parts.push("Qual te interessa?");
  return parts.join("\n\n");
}

/** Formata um QuoteResult para exibir no WhatsApp / UI. */
export function formatQuoteMessage(quote: QuoteResult, units: number) {
  if (quote.lines.length === 0) return "Nenhum item ativo para orçar.";
  const lines = quote.lines
    .map((l) => `✅ ${l.serviceName}\n${l.explanation}`)
    .join("\n\n");
  return `📊 PROPOSTA (${units} un.)\n\n${lines}\n\n💰 Total: ${money(quote.total)}`;
}
