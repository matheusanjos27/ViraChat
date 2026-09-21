import {
  CreateTenantPlatformForm,
  TenantSeatsForm,
} from "@/components/platform/platform-forms";
import { formatBrlFromCents } from "@/lib/platform/usage";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformTenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, created_at, max_members, monthly_fee_cents, billing_status",
    )
    .order("created_at", { ascending: false });

  const tenantIds = (tenants ?? []).map((t) => t.id);
  const counts = new Map<string, number>();
  if (tenantIds.length > 0) {
    const { data: roles } = await supabase
      .from("user_tenant_roles")
      .select("tenant_id")
      .in("tenant_id", tenantIds);
    for (const r of roles ?? []) {
      counts.set(r.tenant_id, (counts.get(r.tenant_id) ?? 0) + 1);
    }
  }

  const tenantRows = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    max_members: t.max_members ?? 2,
    member_count: counts.get(t.id) ?? 0,
  }));

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
          Clientes
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tenants</h1>
        <p className="mt-2 text-ink-muted">
          Crie empresas, limite assentos e acompanhe status.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Novo cliente</h2>
          <div className="mt-4">
            <CreateTenantPlatformForm />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Lista</h2>
          {(tenants ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nenhum tenant ainda.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-muted">
                    <th className="pb-2 font-medium">Empresa</th>
                    <th className="pb-2 font-medium">Assentos</th>
                    <th className="pb-2 font-medium">Mensalidade</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Criado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(tenants ?? []).map((t) => (
                    <tr key={t.id}>
                      <td className="py-3">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-ink-muted">{t.slug}</p>
                      </td>
                      <td className="py-3 tabular-nums">
                        {counts.get(t.id) ?? 0}/{t.max_members ?? 2}
                      </td>
                      <td className="py-3 tabular-nums">
                        {formatBrlFromCents(t.monthly_fee_cents ?? 0)}
                      </td>
                      <td className="py-3">
                        {statusLabel[t.billing_status] ?? t.billing_status}
                      </td>
                      <td className="py-3 text-ink-muted">
                        {new Date(t.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Limite de colaboradores</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Padrão: 2 (empresa + 1). Ajuste por tenant.
        </p>
        <div className="mt-4">
          <TenantSeatsForm tenants={tenantRows} />
        </div>
      </section>
    </div>
  );
}
