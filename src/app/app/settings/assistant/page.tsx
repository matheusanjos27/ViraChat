import Link from "next/link";
import { redirect } from "next/navigation";
import { AiConfigForm } from "@/components/ai/ai-config-form";
import { createClient } from "@/lib/supabase/server";

export default async function AssistantSettingsPage() {
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

  const tenantId = membership.tenant_id;
  const { data: config } = await supabase
    .from("ai_configs")
    .select("name, instructions, is_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>Assistente</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Assistente</h1>
        <p className="mt-2 max-w-xl text-ink-muted">
          Liga/desliga o atendimento automático. O roteiro da conversa fica em{" "}
          <Link
            href="/app/settings/playbook"
            className="font-medium text-brand hover:underline"
          >
            Playbook
          </Link>
          ; os dados da empresa em{" "}
          <Link
            href="/app/settings/company"
            className="font-medium text-brand hover:underline"
          >
            Empresa
          </Link>
          .
        </p>

        <div className="mt-8 max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <AiConfigForm
            tenantId={tenantId}
            name={config?.name ?? "Assistente"}
            notes={config?.instructions ?? ""}
            isEnabled={config?.is_enabled ?? false}
          />
        </div>

        {!process.env.OPENAI_API_KEY ? (
          <p className="mt-4 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Defina <code className="font-mono text-xs">OPENAI_API_KEY</code> no
            .env para respostas com OpenAI.
          </p>
        ) : null}
      </div>
    </div>
  );
}
