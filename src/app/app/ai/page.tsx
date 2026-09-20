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
      <div className="px-6 py-8">
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,600px)_1fr]">
          <div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
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

          <div className="hidden lg:block">
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
              <p className="text-sm font-semibold">Como funciona</p>
              <ul className="mt-3 space-y-3 text-sm text-ink-muted">
                <li className="flex gap-2"><span className="mt-0.5 text-brand">→</span> Quando ativa, a IA responde automaticamente todas as conversas com status <strong className="text-ink">IA ativa</strong>.</li>
                <li className="flex gap-2"><span className="mt-0.5 text-brand">→</span> O cliente pode digitar <strong className="text-ink">"atendente"</strong> a qualquer momento para ser transferido para um humano.</li>
                <li className="flex gap-2"><span className="mt-0.5 text-brand">→</span> Use as instruções para definir tom de voz, produtos, horários e o que a IA pode ou não responder.</li>
                <li className="flex gap-2"><span className="mt-0.5 text-brand">→</span> Modelo atual: <strong className="text-ink">{process.env.OPENAI_MODEL ?? "gpt-4o-mini"}</strong>.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
