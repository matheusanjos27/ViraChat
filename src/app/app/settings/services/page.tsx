import { redirect } from "next/navigation";
import { ServicesManager } from "@/components/settings/services-manager";
import type { ServiceForQuote } from "@/lib/crm/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function ServicesSettingsPage() {
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

  if (!membership) redirect("/app");
  if (!["admin", "supervisor"].includes(membership.role)) redirect("/app");

  const [{ data: services }, { data: tiers }, { data: attributes }] =
    await Promise.all([
      supabase
        .from("services")
        .select(
          "id, name, description, billing_type, unit_label, unit_attribute_key, base_price, min_price, is_active, sort_order",
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
      supabase
        .from("contact_attributes")
        .select("key, label")
        .eq("tenant_id", membership.tenant_id)
        .order("sort_order", { ascending: true }),
    ]);

  const tiersByService = new Map<string, typeof tiers>();
  for (const t of tiers ?? []) {
    const list = tiersByService.get(t.service_id) ?? [];
    list.push(t);
    tiersByService.set(t.service_id, list);
  }

  const catalog: ServiceForQuote[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
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

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>Serviços</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Catálogo e preços
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Cadastre serviços com preço fixo, por unidade ou por faixas. A IA usa
          esta tabela para montar orçamentos — sem inventar valores.
        </p>
        <div className="mt-8">
          <ServicesManager
            services={catalog}
            attributeKeys={attributes ?? []}
          />
        </div>
      </div>
    </div>
  );
}
