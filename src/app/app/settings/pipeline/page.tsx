import { redirect } from "next/navigation";
import { PipelineManager } from "@/components/settings/pipeline-manager";
import { createClient } from "@/lib/supabase/server";

export default async function PipelineSettingsPage() {
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

  await supabase.rpc("seed_tenant_crm", { p_tenant_id: membership.tenant_id });

  const { data: stages } = await supabase
    .from("deal_stages")
    .select("id, name, color, sort_order, is_closed_won, is_closed_lost")
    .eq("tenant_id", membership.tenant_id)
    .order("sort_order", { ascending: true });

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <span>Configurações</span>
          <span>/</span>
          <span>Pipeline</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Funil de vendas</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Etapas configuráveis do seu processo comercial. Arraste deals no
          kanban para avançar.
        </p>
        <div className="mt-8">
          <PipelineManager stages={stages ?? []} />
        </div>
      </div>
    </div>
  );
}
