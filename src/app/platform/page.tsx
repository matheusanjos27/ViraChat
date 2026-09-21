import Link from "next/link";
import { collectPlatformHealth } from "@/lib/platform/health";
import {
  estimateUsdCost,
  formatBrlFromCents,
} from "@/lib/platform/usage";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformHomePage() {
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: tenants }, { data: usageRows }, health] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, monthly_fee_cents, billing_status")
      .order("created_at", { ascending: false }),
    supabase
      .from("ai_usage_events")
      .select("prompt_tokens, completion_tokens, total_tokens")
      .gte("created_at", monthStart.toISOString()),
    collectPlatformHealth(),
  ]);

  const tenantCount = tenants?.length ?? 0;
  const mrrCents = (tenants ?? [])
    .filter((t) => t.billing_status === "active" || t.billing_status === "past_due")
    .reduce((sum, t) => sum + (t.monthly_fee_cents ?? 0), 0);
  const pastDue = (tenants ?? []).filter((t) => t.billing_status === "past_due")
    .length;

  let prompt = 0;
  let completion = 0;
  let total = 0;
  for (const u of usageRows ?? []) {
    prompt += u.prompt_tokens;
    completion += u.completion_tokens;
    total += u.total_tokens;
  }
  const estUsd = estimateUsdCost({
    prompt_tokens: prompt,
    completion_tokens: completion,
  });

  const healthLabel =
    health.overall === "healthy"
      ? "Saudável"
      : health.overall === "degraded"
        ? "Degradado"
        : "Problemas";
  const healthTone =
    health.overall === "healthy"
      ? "text-[#1f9d55]"
      : health.overall === "degraded"
        ? "text-[#b54708]"
        : "text-red-600";

  const cards = [
    {
      href: "/platform/health",
      label: "Saúde da VPS",
      value: healthLabel,
      hint: `${health.checks.filter((c) => c.ok).length}/${health.checks.length} checks OK`,
      tone: healthTone,
    },
    {
      href: "/platform/tenants",
      label: "Clientes",
      value: String(tenantCount),
      hint: "tenants ativos no sistema",
      tone: "text-ink",
    },
    {
      href: "/platform/finance",
      label: "MRR",
      value: formatBrlFromCents(mrrCents),
      hint:
        pastDue > 0
          ? `${pastDue} inadimplente(s)`
          : "receita recorrente mensal",
      tone: "text-ink",
    },
    {
      href: "/platform/usage",
      label: "Tokens IA (mês)",
      value: total.toLocaleString("pt-BR"),
      hint: `~US$ ${estUsd.toFixed(2)} estimado`,
      tone: "text-ink",
    },
  ];

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="max-w-none">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Plataforma
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Visão geral
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Operação da ViraChat: saúde do servidor, clientes, uso de IA e
          financeiro.
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition hover:border-brand/30"
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
              {c.label}
            </p>
            <p className={`mt-3 text-2xl font-semibold tracking-tight ${c.tone}`}>
              {c.value}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{c.hint}</p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Atalhos</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/platform/tenants"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Novo cliente
          </Link>
          <Link
            href="/platform/invites"
            className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold hover:bg-white"
          >
            Convidar usuário
          </Link>
          <Link
            href="/platform/health"
            className="rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold hover:bg-white"
          >
            Ver saúde
          </Link>
        </div>
      </section>
    </div>
  );
}
