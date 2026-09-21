import Link from "next/link";
import {
  estimateUsdCost,
  formatBrlFromCents,
} from "@/lib/platform/usage";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: tenantFilter } = await searchParams;
  const supabase = await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name");

  let eventsQuery = supabase
    .from("ai_usage_events")
    .select(
      "tenant_id, prompt_tokens, completion_tokens, total_tokens, model, created_at",
    )
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);

  if (tenantFilter) {
    eventsQuery = eventsQuery.eq("tenant_id", tenantFilter);
  }

  const { data: events } = await eventsQuery;

  const byTenant = new Map<
    string,
    { prompt: number; completion: number; total: number; calls: number }
  >();

  let prompt = 0;
  let completion = 0;
  let total = 0;
  for (const e of events ?? []) {
    prompt += e.prompt_tokens;
    completion += e.completion_tokens;
    total += e.total_tokens;
    const cur = byTenant.get(e.tenant_id) ?? {
      prompt: 0,
      completion: 0,
      total: 0,
      calls: 0,
    };
    cur.prompt += e.prompt_tokens;
    cur.completion += e.completion_tokens;
    cur.total += e.total_tokens;
    cur.calls += 1;
    byTenant.set(e.tenant_id, cur);
  }

  const nameById = new Map((tenants ?? []).map((t) => [t.id, t.name]));
  const selectedName = tenantFilter
    ? nameById.get(tenantFilter) ?? "Cliente"
    : null;

  const rows = [...byTenant.entries()]
    .map(([id, u]) => ({
      id,
      name: nameById.get(id) ?? id.slice(0, 8),
      ...u,
      usd: estimateUsdCost({
        prompt_tokens: u.prompt,
        completion_tokens: u.completion,
      }),
      avgPerCall: u.calls > 0 ? Math.round(u.total / u.calls) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const estUsd = estimateUsdCost({
    prompt_tokens: prompt,
    completion_tokens: completion,
  });
  const avgPerCall =
    (events?.length ?? 0) > 0
      ? Math.round(total / (events?.length ?? 1))
      : 0;

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Custos
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Uso de IA
          </h1>
          <p className="mt-2 text-ink-muted">
            Tokens deste mês (estimativa gpt-4o-mini em USD)
            {selectedName ? (
              <>
                {" "}
                · filtrado:{" "}
                <span className="font-medium text-ink">{selectedName}</span>
              </>
            ) : null}
            .
          </p>
        </div>

        <form method="get" className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="tenant">
            Cliente
          </label>
          <select
            id="tenant"
            name="tenant"
            defaultValue={tenantFilter ?? ""}
            className="min-w-[200px] rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Todos os clientes</option>
            {(tenants ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Filtrar
          </button>
          {tenantFilter ? (
            <Link
              href="/platform/usage"
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-ink"
            >
              Limpar
            </Link>
          ) : null}
        </form>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Total tokens
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {total.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Prompt / completion
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {prompt.toLocaleString("pt-BR")}
            <span className="text-base font-normal text-ink-muted"> / </span>
            {completion.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Média / chamada
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {avgPerCall.toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {events?.length ?? 0} chamadas no filtro
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Custo estimado
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            US$ {estUsd.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            ≈ {formatBrlFromCents(Math.round(estUsd * 550))} (câmbio ~5,50)
          </p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">
          {selectedName ? "Resumo do cliente" : "Por cliente"}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Nenhum uso registrado este mês
            {selectedName ? ` para ${selectedName}` : ""}. Novas respostas da IA
            passam a aparecer aqui.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-muted">
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Chamadas</th>
                  <th className="pb-2 font-medium">Tokens</th>
                  <th className="pb-2 font-medium">Média/chamada</th>
                  <th className="pb-2 font-medium">Estimativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 font-medium">
                      <Link
                        href={`/platform/usage?tenant=${r.id}`}
                        className="text-brand hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 tabular-nums">{r.calls}</td>
                    <td className="py-3 tabular-nums">
                      {r.total.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 tabular-nums">
                      {r.avgPerCall.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-3 tabular-nums">
                      US$ {r.usd.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
