import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AiSettingsWorkspace } from "@/components/settings/ai-settings-workspace";
import type { Playbook } from "@/lib/crm/playbook";
import type { ServiceForQuote } from "@/lib/crm/pricing";
import {
  getAiReplyUsageThisMonth,
  getTenantPlanLimits,
} from "@/lib/plans/limits";
import { createClient } from "@/lib/supabase/server";

export default async function AiSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app/conversations");
  if (!["admin", "supervisor"].includes(membership.role)) {
    redirect("/app/conversations");
  }

  await supabase.rpc("seed_tenant_crm", { p_tenant_id: membership.tenant_id });

  const planLimits = await getTenantPlanLimits(membership.tenant_id);
  const aiLimit = planLimits?.maxAiRepliesMonth ?? 500;
  const usage = await getAiReplyUsageThisMonth(
    membership.tenant_id,
    aiLimit,
  );

  const [
    { data: config },
    { data: playbookRows },
    { data: attributes },
    { data: services },
    { data: tiers },
  ] = await Promise.all([
    supabase
      .from("ai_configs")
      .select("name, instructions, is_enabled, close_mode")
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle(),
    supabase
      .from("playbooks")
      .select("id, name, trigger, trigger_keyword, is_active, content")
      .eq("tenant_id", membership.tenant_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("contact_attributes")
      .select("id, key, label, type, required, collect_via_ai, sort_order")
      .eq("tenant_id", membership.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("services")
      .select(
        "id, name, description, offer_kind, billing_type, unit_label, unit_attribute_key, base_price, min_price, is_active, sort_order",
      )
      .eq("tenant_id", membership.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_pricing_tiers")
      .select(
        "id, service_id, min_units, max_units, price, price_mode, sort_order",
      )
      .eq("tenant_id", membership.tenant_id)
      .order("sort_order", { ascending: true }),
  ]);

  const tiersByService = new Map<string, NonNullable<typeof tiers>>();
  for (const t of tiers ?? []) {
    const list = tiersByService.get(t.service_id) ?? [];
    list.push(t);
    tiersByService.set(t.service_id, list);
  }

  const catalog: ServiceForQuote[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    offer_kind: s.offer_kind === "service" ? "service" : "product",
    billing_type: s.billing_type,
    unit_label: s.unit_label,
    unit_attribute_key: s.unit_attribute_key,
    base_price: Number(s.base_price),
    min_price: s.min_price != null ? Number(s.min_price) : null,
    is_active: s.is_active,
    tiers: (tiersByService.get(s.id) ?? []).map((t) => ({
      id: t.id,
      min_units: t.min_units,
      max_units: t.max_units,
      price: Number(t.price),
      price_mode: t.price_mode,
      sort_order: t.sort_order,
    })),
  }));

  const enabled = config?.is_enabled ?? false;

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="px-5 py-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Central de treinamento da IA
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Ensine a IA a atender: identidade, roteiro, campos e produtos — com
          preview e teste em tempo real.
        </p>

        <div className="mt-6">
          <Suspense
            fallback={
              <p className="text-sm text-ink-muted">Carregando…</p>
            }
          >
            <AiSettingsWorkspace
              tenantId={membership.tenant_id}
              assistantName={config?.name ?? "Assistente"}
              assistantNotes={config?.instructions ?? ""}
              isEnabled={enabled}
              closeMode={
                config?.close_mode === "callback" ? "callback" : "handoff"
              }
              hasOpenAiKey={Boolean(process.env.OPENAI_API_KEY)}
              playbooks={(playbookRows ?? []) as Playbook[]}
              attributes={attributes ?? []}
              services={catalog}
              attributeKeys={(attributes ?? []).map((a) => ({
                key: a.key,
                label: a.label,
              }))}
              planName={planLimits?.planName ?? "Básico"}
              aiRepliesUsed={usage.used}
              aiRepliesLimit={usage.limit}
              aiQuotaLocked={usage.atLimit}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
