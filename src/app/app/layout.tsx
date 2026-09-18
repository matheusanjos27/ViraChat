import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
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
    .select("tenants!inner(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const tenantName = (
    membership?.tenants as unknown as { name: string } | null
  )?.name;

  return (
    <AppShell
      tenantName={tenantName}
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
