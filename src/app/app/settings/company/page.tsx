import { redirect } from "next/navigation";
import { CompanyForm } from "@/components/settings/company-form";
import { createClient } from "@/lib/supabase/server";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, role, tenants!inner(id, name, slug, about, website, phone)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app/conversations");
  if (!["admin", "supervisor"].includes(membership.role)) {
    redirect("/app/conversations");
  }

  const tenant = membership.tenants as unknown as {
    id: string;
    name: string;
    slug: string;
    about: string | null;
    website: string | null;
    phone: string | null;
  };

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <a href="/app/settings" className="hover:text-ink">
            Configurações
          </a>
          <span>/</span>
          <span>Empresa</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Empresa</h1>
        <p className="mt-2 max-w-xl text-ink-muted">
          Nome e descrição usados pela IA no atendimento — quem vocês são e o
          que fazem.
        </p>
        <div className="mt-8">
          <CompanyForm
            name={tenant.name}
            about={tenant.about}
            phone={tenant.phone}
            website={tenant.website}
            slug={tenant.slug}
          />
        </div>
      </div>
    </div>
  );
}
