"use server";

import { revalidatePath } from "next/cache";
import { requireTenantAdmin } from "@/lib/crm/auth";

export type CompanyState = {
  error?: string;
  success?: string;
};

export async function updateCompanyProfile(
  _prev: CompanyState,
  formData: FormData,
): Promise<CompanyState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const name = String(formData.get("name") ?? "").trim();
  const about = String(formData.get("about") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const website = String(formData.get("website") ?? "").trim() || null;

  if (!name) return { error: "Informe o nome da empresa." };

  const { error } = await ctx.supabase
    .from("tenants")
    .update({ name, about, phone, website })
    .eq("id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/company");
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { success: "Dados da empresa salvos." };
}
