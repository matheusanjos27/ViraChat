import { redirect } from "next/navigation";
import { AiConfigForm } from "@/components/ai/ai-config-form";
import { createClient } from "@/lib/supabase/server";

export default async function AiSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, tenants!inner(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");

  const tenantId = membership.tenant_id;
  const tenantName = (membership.tenants as unknown as { name: string }).name;

  const { data: config } = await supabase
    .from("ai_configs")
    .select("name, instructions, is_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Inteligência artificial
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Assistente
        </h1>
        <p className="mt-2 text-ink-muted">
          {tenantName} — quando ativo, a IA responde sozinha nas conversas em
          status IA. Peça “atendente” no WhatsApp para transferir.
        </p>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <AiConfigForm
            tenantId={tenantId}
            name={config?.name ?? "Assistente"}
            instructions={
              config?.instructions ??
              "Você é um assistente de atendimento. Seja útil e educado."
            }
            isEnabled={config?.is_enabled ?? false}
          />
        </div>

        {!process.env.OPENAI_API_KEY ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Defina <code className="font-mono text-xs">OPENAI_API_KEY</code> no
            .env para ativar as respostas com OpenAI. Sem a chave, a IA usa um
            fallback simples.
          </p>
        ) : null}
      </div>
    </div>
  );
}
