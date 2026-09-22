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

      <section className="mt-8 max-w-5xl rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <div className="mt-0">
          <PlansEditor plans={plans ?? []} />
        </div>
      </section>
    </div>
  );
}
