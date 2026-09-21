import {
  CancelInviteButton,
} from "@/components/platform/platform-forms";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformInvitesPage() {
  const supabase = await createClient();

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
        <p className="mt-2 max-w-2xl text-ink-muted">
          Histórico recente. Para <strong>convidar</strong> alguém, abra a ficha
          do cliente em{" "}
          <Link
            href="/platform/tenants"
            className="font-medium text-brand hover:underline"
          >
            Clientes
          </Link>
          .
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
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
  );
}
