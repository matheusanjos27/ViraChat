import Link from "next/link";
import { notFound } from "next/navigation";
import { TenantManagePanel } from "@/components/platform/tenants-workspace";
import { createServiceClient } from "@/lib/supabase/admin";
import { getTenantUsageSummary } from "@/lib/platform/tenant-summary";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformTenantManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createServiceClient();

  const [{ data: tenant }, { data: plans }, summary, { data: invites }, { data: roles }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select(
          "id, name, slug, created_at, max_members, monthly_fee_cents, billing_status, monthly_ai_token_limit, plan_id, custom_max_channels, custom_max_members, custom_max_ai_replies_month, plans(id, name, max_channels, max_members, is_custom)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("plans")
        .select(
          "id, slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom",
        )
        .order("sort_order", { ascending: true }),
      getTenantUsageSummary(id),
      supabase
        .from("tenant_invites")
        .select("id, email, role, accepted_at, created_at")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("user_tenant_roles")
        .select("user_id, role")
        .eq("tenant_id", id)
        .order("created_at", { ascending: true }),
    ]);

  if (!tenant) notFound();

  const userIds = (roles ?? []).map((r) => r.user_id);
  const [{ count: channelCount }, { data: profiles }] = await Promise.all([
    supabase
      .from("whatsapp_accounts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id),
    userIds.length > 0
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({
          data: [] as {
            id: string;
            full_name: string | null;
            email: string | null;
          }[],
        }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const members = (roles ?? []).map((r) => {
    const profile = profileById.get(r.user_id);
    return {
      userId: r.user_id,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      role: r.role,
    };
  });

  const planRaw = tenant.plans as unknown;
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
    (isCustom ? tenant.custom_max_channels : null) ?? plan?.max_channels ?? 2;
  const maxMembers =
    (isCustom ? tenant.custom_max_members : null) ??
    plan?.max_members ??
    tenant.max_members ??
    2;

  const row = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    created_at: tenant.created_at,
    plan_id: tenant.plan_id,
    plan_name: plan?.name ?? "Sem plano",
    is_custom_plan: isCustom,
    max_members: maxMembers,
    max_channels: maxChannels,
    member_count: members.length,
    channel_count: channelCount ?? 0,
    monthly_fee_cents: tenant.monthly_fee_cents ?? 0,
    billing_status: tenant.billing_status ?? "trial",
    monthly_ai_token_limit: tenant.monthly_ai_token_limit ?? 2_000_000,
    custom_max_members: tenant.custom_max_members,
    custom_max_channels: tenant.custom_max_channels,
    custom_max_ai_replies_month: tenant.custom_max_ai_replies_month,
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-4">
        <Link
          href="/platform/tenants"
          className="text-sm font-medium text-brand hover:underline"
        >
          ← Clientes
        </Link>
      </div>
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Gerenciar
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {tenant.name}
        </h1>
        <p className="mt-2 text-ink-muted">
          {tenant.slug} · {plan?.name ?? "Sem plano"} · {members.length}/
          {maxMembers} assentos · {channelCount ?? 0}/{maxChannels} WhatsApps
        </p>
      </header>

      <TenantManagePanel
        tenant={row}
        plans={plans ?? []}
        summary={summary}
        invites={invites ?? []}
        members={members}
      />
    </div>
  );
}
