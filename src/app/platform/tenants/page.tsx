import { TenantsListWorkspace } from "@/components/platform/tenants-workspace";
import { getTenantsMonthUsageMap } from "@/lib/platform/tenant-summary";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformTenantsPage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: plans }] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "id, name, slug, created_at, max_members, monthly_fee_cents, billing_status, monthly_ai_token_limit, plan_id, custom_max_channels, custom_max_members, custom_max_ai_replies_month, plans(id, name, max_channels, max_members, is_custom)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("plans")
      .select(
        "id, slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom",
      )
      .order("sort_order", { ascending: true }),
  ]);

  const tenantIds = (tenants ?? []).map((t) => t.id);
  const memberCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  let usageMap = new Map<string, { replies: number; tokens: number }>();

  if (tenantIds.length > 0) {
    const [{ data: roles }, { data: accounts }, usage] = await Promise.all([
      supabase
        .from("user_tenant_roles")
        .select("tenant_id")
        .in("tenant_id", tenantIds),
      supabase
        .from("whatsapp_accounts")
        .select("tenant_id")
        .in("tenant_id", tenantIds),
      getTenantsMonthUsageMap(tenantIds),
    ]);
    usageMap = usage;
    for (const r of roles ?? []) {
      memberCounts.set(r.tenant_id, (memberCounts.get(r.tenant_id) ?? 0) + 1);
    }
    for (const a of accounts ?? []) {
      channelCounts.set(a.tenant_id, (channelCounts.get(a.tenant_id) ?? 0) + 1);
    }
  }

  const rows = (tenants ?? []).map((t) => {
    const planRaw = t.plans as unknown;
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
    const usage = usageMap.get(t.id);

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      created_at: t.created_at,
      plan_id: t.plan_id,
      plan_name: plan?.name ?? "Sem plano",
      is_custom_plan: isCustom,
      max_members: maxMembers,
      max_channels: maxChannels,
      member_count: memberCounts.get(t.id) ?? 0,
      channel_count: channelCounts.get(t.id) ?? 0,
      monthly_fee_cents: t.monthly_fee_cents ?? 0,
      billing_status: t.billing_status ?? "trial",
      monthly_ai_token_limit: t.monthly_ai_token_limit ?? 2_000_000,
      custom_max_members: t.custom_max_members,
      custom_max_channels: t.custom_max_channels,
      custom_max_ai_replies_month: t.custom_max_ai_replies_month,
      replies_month: usage?.replies ?? 0,
      tokens_month: usage?.tokens ?? 0,
    };
  });

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Clientes
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Lista de empresas. Abra <strong>Gerenciar</strong> para plano,
          convites, cobrança e resumo de uso da IA.
        </p>
      </header>

      <TenantsListWorkspace tenants={rows} plans={plans ?? []} />
    </div>
  );
}
