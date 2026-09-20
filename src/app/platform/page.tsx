import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CreateTenantPlatformForm,
  InviteUserForm,
  TenantSeatsForm,
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
    .select("id, name, slug, created_at, max_members")
    .order("created_at", { ascending: false });

  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("id, email, role, accepted_at, created_at, tenant_id, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(30);

  const tenantIds = (tenants ?? []).map((t) => t.id);
  const counts = new Map<string, number>();
  if (tenantIds.length > 0) {
    const { data: roles } = await supabase
      .from("user_tenant_roles")
      .select("tenant_id")
      .in("tenant_id", tenantIds);
    for (const r of roles ?? []) {
      counts.set(r.tenant_id, (counts.get(r.tenant_id) ?? 0) + 1);
    }
  }

  const tenantRows = (tenants ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    max_members: t.max_members ?? 2,
    member_count: counts.get(t.id) ?? 0,
  }));

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
              Crie tenants, defina limite de colaboradores e convide usuários.
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
          <h2 className="text-lg font-semibold">Limite de colaboradores</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Padrão: 2 (empresa + 1). Ajuste por tenant abaixo.
          </p>
          <div className="mt-4">
            <TenantSeatsForm tenants={tenantRows} />
          </div>
        </section>

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
                    <p className="text-ink-muted">
                      {t.slug} · {counts.get(t.id) ?? 0}/{t.max_members ?? 2}{" "}
                      assentos
                    </p>
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
