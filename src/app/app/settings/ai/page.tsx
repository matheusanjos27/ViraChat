import { redirect } from "next/navigation";
import { AiConfigForm } from "@/components/ai/ai-config-form";
import { PlaybookEditor } from "@/components/settings/playbook-editor";
import type { Playbook } from "@/lib/crm/playbook";
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

  const [{ data: config }, { data: rows }] = await Promise.all([
    supabase
      .from("ai_configs")
      .select("name, instructions, is_enabled")
      .eq("tenant_id", membership.tenant_id)
      .maybeSingle(),
    supabase
      .from("playbooks")
      .select("id, name, trigger, trigger_keyword, is_active, content")
      .eq("tenant_id", membership.tenant_id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>IA</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Atendimento com IA
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Tudo da IA num só lugar: ligar o automático, nome do assistente e o
          roteiro que ela segue no WhatsApp.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            1. Ligar e identificar
          </h2>
          <div className="mt-3 max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
            <AiConfigForm
              tenantId={membership.tenant_id}
              name={config?.name ?? "Assistente"}
              notes={config?.instructions ?? ""}
              isEnabled={config?.is_enabled ?? false}
            />
          </div>
          {!process.env.OPENAI_API_KEY ? (
            <p className="mt-3 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Defina <code className="font-mono text-xs">OPENAI_API_KEY</code> no
              .env para respostas com OpenAI.
            </p>
          ) : null}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            2. Roteiro da conversa
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Como a IA conduz o atendimento: abertura, coleta de dados,
            orçamento, objeções e quando passar para humano.
          </p>
          <div className="mt-4">
            <PlaybookEditor playbooks={(rows ?? []) as Playbook[]} />
          </div>
        </section>
      </div>
    </div>
  );
}
