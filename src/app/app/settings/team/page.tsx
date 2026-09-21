import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamManager } from "@/components/settings/team-manager";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, role, tenants!inner(id, name, max_members)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");

  const tenant = membership.tenants as unknown as {
    id: string;
    name: string;
    max_members: number;
  };
  const tenantId = membership.tenant_id;
  const canManage = ["admin", "supervisor"].includes(membership.role);

  const { data: roles } = await supabase
    .from("user_tenant_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  const userIds = (roles ?? []).map((r) => r.user_id);
  const admin = createServiceClient();
  const { data: profiles } =
    userIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds)
      : {
          data: [] as {
            id: string;
            full_name: string | null;
            email: string | null;
          }[],
        };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const members = (roles ?? []).map((r) => {
    const profile = profileById.get(r.user_id);
    return {
      userId: r.user_id,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? null,
      role: r.role,
      isSelf: r.user_id === user.id,
    };
  });

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="px-5 py-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Link href="/app/settings" className="hover:text-ink">
            Configurações
          </Link>
          <span className="text-line">/</span>
          <span className="font-medium text-ink">Equipe</span>
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Equipe
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Colaboradores de {tenant.name}. Criam login com e-mail e senha
          provisória (troca obrigatória no 1º acesso).
        </p>

        <div className="mt-6">
          <TeamManager
            tenantId={tenantId}
            members={members}
            used={members.length}
            maxMembers={tenant.max_members ?? 2}
            canManage={canManage}
          />
        </div>
      </div>
    </div>
  );
}
