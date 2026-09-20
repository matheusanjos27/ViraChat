import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreateTenantPlatformForm,
  InviteUserForm,
} from "@/components/platform/platform-forms";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformPage() {
  if (!(await isCurrentUserPlatformAdmin())) {
    redirect("/app");
  }

  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("id, email, role, accepted_at, created_at, tenant_id, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
              Plataforma
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Super admin
            </h1>
            <p className="mt-2 text-ink-muted">
              Crie tenants e convide usuários. Não há self-serve.
            </p>
          </div>
          <Link
            href="/app"
            className="text-sm font-medium text-brand hover:underline"
          >
            Ir ao app →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold">Novo tenant</h2>
            <div className="mt-4">
              <CreateTenantPlatformForm />
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
            <h2 className="text-lg font-semibold">Convidar usuário</h2>
            <div className="mt-4">
              <InviteUserForm
                tenants={(tenants ?? []).map((t) => ({
                  id: t.id,
                  name: t.name,
                }))}
              />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Tenants</h2>
          {(tenants ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nenhum tenant ainda.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {(tenants ?? []).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-ink-muted">{t.slug}</p>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Convites recentes</h2>
          {(invites ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nenhum convite.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {(invites ?? []).map((i) => {
                const tenantName = (
                  i.tenants as unknown as { name: string } | null
                )?.name;
                return (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2"
                  >
                    <span>
                      {i.email} · {i.role} · {tenantName ?? "—"}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {i.accepted_at ? "vinculado" : "pendente"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
