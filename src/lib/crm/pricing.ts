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

  const plan = matchFixedPlanForUnits(active, units);
  const mention = opts?.mentionText ?? "";
  const chunks = mention
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const latest = chunks[0] ?? mention;

  let ids = (opts?.selectedIds ?? []).filter(Boolean);
  if (ids.length === 0 && mention) {
    // Última fala do cliente manda: se citar item, ignore menções antigas.
    const latestHits = matchCatalogIdsFromText(active, latest);
    ids =
      latestHits.length > 0
        ? latestHits
        : matchCatalogIdsFromText(active, mention);
  }
  if (ids.length === 0 && active.length === 1) {
    ids = [active[0].id];
  }

  // Há plano fixo que cobre este porte → NÃO some PCMSO/PGR/etc. em cima
  // (bug: "incluir todos" com 15 colaboradores virava plano + por vida).
  if (plan) {
    const latestNamesPerUnit =
      matchCatalogIdsFromText(active, latest).filter((id) => {
        const s = active.find((x) => x.id === id);
        return s?.billing_type === "per_unit";
      }).length > 0;

    if (!latestNamesPerUnit) {
      return quoteCatalog(services, units, [plan.id]);
    }
    const namedPerUnit = ids.filter((id) => {
      const s = active.find((x) => x.id === id);
      return s?.billing_type === "per_unit";
    });
    if (namedPerUnit.length > 0) {
      return quoteCatalog(services, units, namedPerUnit);
    }
  }

  if (ids.length === 0) {
    return { lines: [], total: 0, currency: "BRL" };
  }
  return quoteCatalog(services, units, ids);
}

/** Plano fixo cujo nome/descrição indica faixa de colaboradores (ex.: "11 a 15"). */
export function matchFixedPlanForUnits(
  services: ServiceForQuote[],
  units: number,
): ServiceForQuote | null {
  const u = Math.floor(units);
  if (!(u > 0)) return null;
  const fixed = services.filter(
    (s) => s.is_active && s.billing_type === "fixed",
  );
  for (const s of fixed) {
    const range = parseHeadcountRange(`${s.name} ${s.description ?? ""}`);
    if (range && u >= range.min && u <= range.max) return s;
  }
  return null;
}

function parseHeadcountRange(
  text: string,
): { min: number; max: number } | null {
  const t = normalizeQuoteText(text);
  let m = /ate\s*(\d+)/i.exec(t);
  if (m) return { min: 1, max: Number(m[1]) };
  m = /(\d+)\s*(?:a|ate|-|–)\s*(\d+)/i.exec(t);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  return null;
}

/**
 * Escolhe subset do catálogo para o prompt (match da mensagem primeiro).
 */
function pickCatalogSlice(
  active: ServiceForQuote[],
  maxItems: number,
  mentionText?: string,
): { shown: ServiceForQuote[]; total: number; omitted: number } {
  const total = active.length;
  if (total <= maxItems) {
    return { shown: active, total, omitted: 0 };
  }
  const matchedIds = new Set(
    mentionText ? matchCatalogIdsFromText(active, mentionText) : [],
  );
  const matched = active.filter((s) => matchedIds.has(s.id));
  const rest = active.filter((s) => !matchedIds.has(s.id));
  const shown = [...matched, ...rest].slice(0, maxItems);
  return { shown, total, omitted: total - shown.length };
}

function formatCatalogItemLine(s: ServiceForQuote): string {
  const kindLabel = s.offer_kind === "service" ? "SERVIÇO" : "PRODUTO";
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
    .slice(0, 6)
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
}

/**
 * Nomes do catálogo (sem preços) — material para a IA organizar a 1ª mensagem.
 * Catálogo grande: amostra limitada + aviso (não cabe 200 nomes no prompt).
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

  const maxNames = AI_LIMITS.catalogOpeningMaxNames;
  const fixed = active.filter((s) => s.billing_type === "fixed");
  const tiered = active.filter((s) => s.billing_type === "tiered");
  const perUnit = active.filter((s) => s.billing_type === "per_unit");

  const take = (items: ServiceForQuote[], budget: { left: number }) => {
    if (budget.left <= 0 || items.length === 0) return [] as ServiceForQuote[];
    const slice = items.slice(0, budget.left);
    budget.left -= slice.length;
    return slice;
  };
  const budget = { left: maxNames };
  const shownFixed = take([...fixed, ...tiered], budget);
  const shownUnit = take(perUnit, budget);
  const shownCount = shownFixed.length + shownUnit.length;
  const omitted = active.length - shownCount;

  const line = (items: ServiceForQuote[]) =>
    items.map((s) => `- ${s.name}`).join("\n");

  const parts: string[] = [
    `CATÁLOGO INTERNO (${active.length} itens: ${fixed.length + tiered.length} fixo/faixa, ${perUnit.length} por unidade).`,
    `Abertura / visão geral: RESUMO do portfólio (grupos), SEM lista longa e SEM preços. Detalhe conforme a conversa.`,
    `Seja direto e proativo: 1 pergunta que avance (necessidade / porte / o que busca).`,
    `Na mensagem: no máx. ${AI_LIMITS.catalogReplyMaxItems} itens se for listar algo; preferir resumo a inventário.`,
  ];
  if (shownFixed.length) {
    parts.push(`Amostra fixo/faixa (não despejar):\n${line(shownFixed)}`);
  }
  if (shownUnit.length) {
    parts.push(`Amostra por unidade (não despejar):\n${line(shownUnit)}`);
  }
  if (omitted > 0) {
    parts.push(
      `+${omitted} itens omitidos do prompt. Não invente nomes omitidos — aprofunde quando o cliente disser o que quer.`,
    );
  }
  parts.push(`Siga o ROTEIRO. Resposta curta.`);
  return truncate(parts.join("\n\n"), AI_LIMITS.catalogBlock);
}

/** Serializa o catálogo para o prompt da IA (com teto de itens). */
export function buildCatalogPromptBlock(
  services: ServiceForQuote[],
  opts?: { mentionText?: string },
) {
  const active = services.filter((s) => s.is_active);
  if (active.length === 0) {
    return truncate(
      `CATÁLOGO VAZIO: não há produtos/serviços ativos cadastrados.
NÃO invente produtos, pacotes, preços nem descrições genéricas.
Informe que não há oferta cadastrada e faça handoff para um atendente.`,
      AI_LIMITS.catalogBlock,
    );
  }

  const { shown, total, omitted } = pickCatalogSlice(
    active,
    AI_LIMITS.catalogPromptMaxItems,
    opts?.mentionText,
  );
  const blocks = shown.map(formatCatalogItemLine);

  const header =
    omitted > 0
      ? `CATÁLOGO OFICIAL — ${total} itens ativos; mostrando ${shown.length} (prioridade: o que o cliente citou). ${omitted} omitidos.
NÃO invente os omitidos. NÃO liste os ${total} de uma vez. Na mensagem: no máx. ${AI_LIMITS.catalogReplyMaxItems} itens; se precisar de mais, pergunte filtro/categoria.
Lista FECHADA abaixo (copie nomes/preços daqui):`
      : `CATÁLOGO OFICIAL — lista FECHADA (${total} itens; copie nomes/preços daqui; é proibido inventar):
Na mensagem ao cliente: no máx. ${AI_LIMITS.catalogReplyMaxItems} itens por vez (não despeje o catálogo).`;

  return truncate(
    `${header}
${blocks.join("\n")}
Regras: (1) use SOMENTE estes itens; (2) tag [PRODUTO]/[SERVIÇO]; (3) fora da lista → diga que não tem e ofereça o mais próximo OU handoff; (4) nunca invente nomes.`,
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
