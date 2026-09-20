import { createClient } from "@/lib/supabase/server";

export async function requireTenantMembership() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, supabase, user: null, membership: null };

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { error: "Sem tenant." as const, supabase, user, membership: null };
  }

  return { error: null, supabase, user, membership };
}

export async function requireTenantAdmin() {
  const ctx = await requireTenantMembership();
  if (ctx.error || !ctx.membership) return ctx;
  if (!["admin", "supervisor"].includes(ctx.membership.role)) {
    return { ...ctx, error: "Sem permissão." as const };
  }
  return ctx;
}
