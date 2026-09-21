import {
  CreateTenantPlatformForm,
  TenantAiBudgetForm,
  TenantSeatsForm,
} from "@/components/platform/platform-forms";
import { formatBrlFromCents } from "@/lib/platform/usage";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformTenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select(
      "id, name, slug, created_at, max_members, monthly_fee_cents, billing_status, monthly_ai_token_limit, plan_id, custom_max_channels, custom_max_members, custom_max_ai_replies_month, plans(id, name, max_channels, max_members, is_custom)",
    )
    .order("created_at", { ascending: false });

  const tenantIds = (tenants ?? []).map((t) => t.id);
  const memberCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();

  if (tenantIds.length > 0) {
    const [{ data: roles }, { data: accounts }] = await Promise.all([
      supabase
        .from("user_tenant_roles")
        .select("tenant_id")
        .in("tenant_id", tenantIds),
      supabase
        .from("whatsapp_accounts")
        .select("tenant_id")
        .in("tenant_id", tenantIds),
    ]);
    for (const r of roles ?? []) {
      memberCounts.set(r.tenant_id, (memberCounts.get(r.tenant_id) ?? 0) + 1);
    }
    for (const a of accounts ?? []) {
      channelCounts.set(a.tenant_id, (channelCounts.get(a.tenant_id) ?? 0) + 1);
    }
  }

  const tenantRows = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    max_members: t.max_members ?? 2,
    member_count: memberCounts.get(t.id) ?? 0,
  }));

  const aiBudgetRows = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    monthly_ai_token_limit: t.monthly_ai_token_limit ?? 2_000_000,
  }));

  const statusLabel: Record<string, string> = {
    trial: "Trial",
    active: "Ativo",
    past_due: "Inadimplente",
    canceled: "Cancelado",
  };

  function planMeta(t: {
    max_members: number | null;
    custom_max_channels: number | null;
    custom_max_members: number | null;
    plans: unknown;
  }) {
    const planRaw = t.plans;
    const plan = Array.isArray(planRaw)
      ? (planRaw[0] as {
          name: string;
          max_channels: number;
          max_members: number;
          is_custom: boolean;
        } | null)
      : (planRaw as {
          name: string;
          max_channels: number;
          max_members: number;
          is_custom: boolean;
        } | null);
    const isCustom = Boolean(plan?.is_custom);
    const maxChannels =
      (isCustom ? t.custom_max_channels : null) ?? plan?.max_channels ?? 2;
    const maxMembers =
      (isCustom ? t.custom_max_members : null) ??
      plan?.max_members ??
      t.max_members ??
      2;
    return {
      planName: plan?.name ?? "Sem plano",
      maxChannels,
      maxMembers,
    };
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Clientes
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tenants</h1>
        <p className="mt-2 text-ink-muted">
          Crie empresas, acompanhe plano, canais, assentos e cota de IA.
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
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-muted">
                    <th className="pb-2 font-medium">Empresa</th>
                    <th className="pb-2 font-medium">Plano</th>
                    <th className="pb-2 font-medium">WhatsApps</th>
                    <th className="pb-2 font-medium">Assentos</th>
                    <th className="pb-2 font-medium">Cota IA</th>
                    <th className="pb-2 font-medium">Mensalidade</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Criado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(tenants ?? []).map((t) => {
                    const meta = planMeta(t);
                    const chUsed = channelCounts.get(t.id) ?? 0;
                    return (
                      <tr key={t.id}>
                        <td className="py-3">
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-ink-muted">{t.slug}</p>
                        </td>
                        <td className="py-3">{meta.planName}</td>
                        <td className="py-3 tabular-nums">
                          {chUsed}/{meta.maxChannels}
                        </td>
                        <td className="py-3 tabular-nums">
                          {memberCounts.get(t.id) ?? 0}/{meta.maxMembers}
                        </td>
                        <td className="py-3 tabular-nums">
                          {(t.monthly_ai_token_limit ?? 2_000_000) === 0
                            ? "∞"
                            : `${((t.monthly_ai_token_limit ?? 2_000_000) / 1_000_000).toFixed(1)}M`}
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
                    );
                  })}
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

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Cota mensal de IA (tokens)</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Padrão: 2M tokens/mês (~1 WhatsApp com volume médio). 0 = ilimitado.
          Ao estourar, a conversa vai para atendente humano sem chamar a OpenAI.
        </p>
        <div className="mt-4">
          <TenantAiBudgetForm tenants={aiBudgetRows} />
        </div>
      </section>
    </div>
  );
}
