import Link from "next/link";
import { redirect } from "next/navigation";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const platformAdmin = await isCurrentUserPlatformAdmin();

  const { data: memberships } = await supabase
    .from("user_tenant_roles")
    .select("role, tenants!inner(id, name, slug)")
    .eq("user_id", user.id);

  type MembershipRow = {
    role: string;
    tenants: { id: string; name: string; slug: string };
  };

  const tenants = ((memberships ?? []) as unknown as MembershipRow[]).map(
    (m) => ({
      role: m.role,
      ...m.tenants,
    }),
  );

  if (tenants.length === 0) {
    return (
      <div className="app-noise h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
          <img src="/logo.png" alt="ViraChat" className="h-12 w-auto" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Sem acesso a um tenant
          </h1>
          <p className="mt-2 text-ink-muted">
            Sua conta ainda não foi convidada para nenhuma empresa. Peça ao
            super admin da plataforma um convite.
          </p>
          {platformAdmin ? (
            <Link
              href="/platform"
              className="mt-8 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Abrir painel da plataforma
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  const tenant = tenants[0];
  const { count: channelCount } = await supabase
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id);
  const { count: openCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .neq("status", "resolved");

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Empresa
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {tenant.name}
        </h1>
        <p className="mt-2 text-ink-muted">
          {tenant.slug} · papel {tenant.role}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link
            href="/app/conversations"
            className="group rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5"
          >
            <p className="text-sm text-ink-muted">Conversas abertas</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {openCount ?? 0}
            </p>
            <p className="mt-3 text-sm font-medium text-brand group-hover:underline">
              Abrir central →
            </p>
          </Link>
          <Link
            href="/app/channels"
            className="group rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5"
          >
            <p className="text-sm text-ink-muted">Canais WhatsApp</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {channelCount ?? 0}
            </p>
            <p className="mt-3 text-sm font-medium text-brand group-hover:underline">
              Gerenciar →
            </p>
          </Link>
          <Link
            href="/app/ai"
            className="group rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5"
          >
            <p className="text-sm text-ink-muted">Assistente IA</p>
            <p className="mt-2 text-3xl font-semibold">IA</p>
            <p className="mt-3 text-sm font-medium text-brand group-hover:underline">
              Configurar →
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
