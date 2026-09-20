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
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

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
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Equipe</h1>
        <p className="mt-2 text-ink-muted">
          Convide colaboradores de {tenant.name}. Eles só acessam esta empresa.
        </p>
        <div className="mt-8">
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
