import { TenantBillingForm } from "@/components/platform/platform-forms";
import { formatBrlFromCents } from "@/lib/platform/usage";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformFinancePage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, monthly_fee_cents, billing_status, created_at")
    .order("name", { ascending: true });

  const list = tenants ?? [];
  const mrr = list
    .filter((t) => t.billing_status === "active" || t.billing_status === "past_due")
    .reduce((s, t) => s + (t.monthly_fee_cents ?? 0), 0);
  const trial = list.filter((t) => t.billing_status === "trial").length;
  const pastDue = list.filter((t) => t.billing_status === "past_due").length;
  const active = list.filter((t) => t.billing_status === "active").length;

  const statusLabel: Record<string, string> = {
    trial: "Trial",
    active: "Ativo",
    past_due: "Inadimplente",
    canceled: "Cancelado",
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Financeiro
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Finanças
        </h1>
        <p className="mt-2 text-ink-muted">
          Quanto cada cliente te paga por mês (controle manual — sem gateway).
        </p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">MRR</p>
          <p className="mt-2 text-2xl font-semibold">
            {formatBrlFromCents(mrr)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Ativos
          </p>
          <p className="mt-2 text-2xl font-semibold">{active}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Trial
          </p>
          <p className="mt-2 text-2xl font-semibold">{trial}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-[0.12em] text-ink-muted">
            Inadimplentes
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#b54708]">{pastDue}</p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Editar mensalidades</h2>
        <div className="mt-4">
          <TenantBillingForm
            tenants={list.map((t) => ({
              id: t.id,
              name: t.name,
              monthly_fee_cents: t.monthly_fee_cents ?? 0,
              billing_status: t.billing_status ?? "active",
            }))}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Resumo</h2>
        {list.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Sem clientes.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-muted">
                  <th className="pb-2 font-medium">Cliente</th>
                  <th className="pb-2 font-medium">Mensalidade</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 font-medium">{t.name}</td>
                    <td className="py-3 tabular-nums">
                      {formatBrlFromCents(t.monthly_fee_cents ?? 0)}
                    </td>
                    <td className="py-3">
                      {statusLabel[t.billing_status] ?? t.billing_status}
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
