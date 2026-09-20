import { redirect } from "next/navigation";
import { FieldsManager } from "@/components/settings/fields-manager";
import { createClient } from "@/lib/supabase/server";

export default async function FieldsSettingsPage() {
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

  // Ensure CRM seed for older tenants
  await supabase.rpc("seed_tenant_crm", { p_tenant_id: membership.tenant_id });

  const { data: attributes } = await supabase
    .from("contact_attributes")
    .select("id, key, label, type, required, collect_via_ai, sort_order")
    .eq("tenant_id", membership.tenant_id)
    .order("sort_order", { ascending: true });

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings/fields" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>Campos</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Campos do lead</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Defina quais informações sua empresa coleta. A IA pergunta de forma
          natural e grava aqui — funciona para qualquer setor.
        </p>
        <div className="mt-8">
          <FieldsManager attributes={attributes ?? []} />
        </div>
      </div>
    </div>
  );
}
