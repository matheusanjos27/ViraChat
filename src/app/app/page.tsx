import Link from "next/link";
import { redirect } from "next/navigation";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const platformAdmin = await isCurrentUserPlatformAdmin();

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/app/conversations");
  }

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-16">
        <img src="/logo.png" alt="ViraChat" className="h-12 w-auto" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Sem acesso a um tenant
        </h1>
        <p className="mt-2 text-ink-muted">
          Sua conta ainda não foi convidada para nenhuma empresa. Peça ao super
          admin da plataforma um convite.
        </p>
        {platformAdmin ? (
          <Link
            href="/platform"
            className="mt-8 inline-flex rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Abrir painel da plataforma
          </Link>
        ) : null}
      </div>
    </div>
  );
}
