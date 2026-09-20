import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("role, tenant_id, tenants!inner(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const tenantName = (
    membership?.tenants as unknown as { name: string } | null
  )?.name;

  let openCount = 0;
  if (membership?.tenant_id) {
    const { count } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", membership.tenant_id)
      .neq("status", "resolved");
    openCount = count ?? 0;
  }

  return (
    <AppShell
      tenantName={tenantName}
      userRole={membership?.role}
      openCount={openCount}
      isPlatformAdmin={await isCurrentUserPlatformAdmin()}
      userName={
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        undefined
      }
    >
      {children}
    </AppShell>
  );
}
