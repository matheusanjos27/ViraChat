import {
  CancelInviteButton,
  InviteUserForm,
} from "@/components/platform/platform-forms";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformInvitesPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("id, email, role, accepted_at, created_at, tenant_id, tenants(name)")
    .order("created_at", { ascending: false })
    .limit(40);

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Acesso
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Convites</h1>
        <p className="mt-2 text-ink-muted">
          Convide com senha provisória (atalho) ou por e-mail. Cancele pendentes
          quando precisar.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Novo convite</h2>
          <div className="mt-4">
            <InviteUserForm
              tenants={(tenants ?? []).map((t) => ({
                id: t.id,
                name: t.name,
              }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Últimos convites</h2>
          {(invites ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Nenhum convite ainda.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {(invites ?? []).map((inv) => {
                const tenantName = (
                  inv.tenants as unknown as { name: string } | null
                )?.name;
                return (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-ink-muted">
                        {tenantName ?? "—"} · {inv.role} ·{" "}
                        {inv.accepted_at ? "Aceito" : "Pendente"}
                      </p>
                    </div>
                    <CancelInviteButton inviteId={inv.id} />
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
