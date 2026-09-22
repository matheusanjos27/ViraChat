import { PlansEditor } from "@/components/platform/plans-forms";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformPlansPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select(
      "id, slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom",
    )
    .order("sort_order", { ascending: true });

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Planos
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Catálogo de planos
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Crie e edite planos com o nome que quiser (Starter, Pro, KM Escala…).
          Para <strong>aplicar</strong> a um cliente, use{" "}
          <Link href="/platform/tenants" className="font-medium text-brand hover:underline">
            Clientes
          </Link>
          .
        </p>
      </header>

      <section className="mt-8 max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Planos disponíveis</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Quantos planos quiser. Cada um tem nome, equipe, WhatsApps e teto de
          IA. O plano “Personalizado” ainda permite overrides por cliente.
        </p>
        <div className="mt-4">
          <PlansEditor plans={plans ?? []} />
        </div>
      </section>
    </div>
  );
}
