import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import type { NotificationItem } from "@/components/app/notification-bell";
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
  const tenantId = membership?.tenant_id;

  let openCount = 0;
  let waitingCount = 0;
  let initialNotifications: NotificationItem[] = [];

  if (tenantId) {
    const [{ count }, { count: waiting }, { data: notes }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .neq("status", "resolved"),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "waiting_human"),
      supabase
        .from("app_notifications")
        .select("id, type, title, body, conversation_id, read_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    openCount = count ?? 0;
    waitingCount = waiting ?? 0;
    initialNotifications = (notes as NotificationItem[]) ?? [];
  }

  return (
    <AppShell
      tenantId={tenantId}
      tenantName={tenantName}
      userRole={membership?.role}
      openCount={openCount}
      waitingCount={waitingCount}
      initialNotifications={initialNotifications}
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
