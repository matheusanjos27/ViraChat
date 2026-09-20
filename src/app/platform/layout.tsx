import { redirect } from "next/navigation";
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
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-line bg-brand-deep px-6 py-4 text-white">
        <p className="brand-mark text-2xl">ViraChat</p>
        <p className="text-xs text-white/60">Painel da plataforma</p>
      </header>
      {children}
    </div>
  );
}
