import { redirect } from "next/navigation";
import { PlatformShell } from "@/components/platform/platform-shell";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await isCurrentUserPlatformAdmin())) redirect("/app");

  return (
    <PlatformShell userEmail={user.email ?? undefined}>{children}</PlatformShell>
  );
}
