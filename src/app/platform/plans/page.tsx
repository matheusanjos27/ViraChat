import {
  AssignTenantPlanForm,
  PlansEditor,
} from "@/components/platform/plans-forms";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformPlansPage() {
  const supabase = await createClient();
  const [{ data: plans }, { data: tenants }] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "id, slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom",
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("tenants")
      .select(
        "id, name, plan_id, custom_max_members, custom_max_channels, custom_max_ai_replies_month",
      )
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Planos
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Planos e limites
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Edite nome e regras a qualquer momento. Mudar o plano de um cliente só
          altera o teto — o uso do mês continua. WhatsApps desconectados contam
          no limite.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Catálogo de planos</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Básico · Médio · Personalizado (limites sob medida por empresa).
          </p>
          <div className="mt-4">
            <PlansEditor plans={plans ?? []} />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Aplicar a um cliente</h2>
          <p className="mt-1 text-sm text-ink-muted">
            No Personalizado, defina equipe, WhatsApps e respostas de IA.
          </p>
          <div className="mt-4">
            <AssignTenantPlanForm
              tenants={tenants ?? []}
              plans={plans ?? []}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
