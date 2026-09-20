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
        <img src="/logo.png" alt="ViraChat" className="h-8 w-auto rounded-lg bg-white px-2 py-0.5" />
        <p className="mt-1 text-xs text-white/60">Painel da plataforma</p>
      </header>
      {children}
    </div>
  );
}
