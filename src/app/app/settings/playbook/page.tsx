import { redirect } from "next/navigation";
import { PlaybookEditor } from "@/components/settings/playbook-editor";
import type { Playbook } from "@/lib/crm/playbook";
import { createClient } from "@/lib/supabase/server";

export default async function PlaybookSettingsPage() {
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

  const { data: rows } = await supabase
    .from("playbooks")
    .select("id, name, trigger, trigger_keyword, is_active, content")
    .eq("tenant_id", membership.tenant_id)
    .order("created_at", { ascending: true });

  const playbooks = (rows ?? []) as Playbook[];

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>Playbook</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Roteiro de conversa
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Defina como a IA conduz o atendimento — da abertura ao fechamento.
          Sem código específico de setor: cada empresa escreve o próprio
          playbook.
        </p>
        <div className="mt-8">
          <PlaybookEditor playbooks={playbooks} />
        </div>
      </div>
    </div>
  );
}
