"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AiConfigState = {
  error?: string;
  success?: string;
};

export async function updateAiConfig(
  _prev: AiConfigState,
  formData: FormData,
): Promise<AiConfigState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "Assistente";
  const instructions =
    String(formData.get("instructions") ?? "").trim() ||
    "Siga o roteiro de conversa e os dados da empresa.";
  const isEnabled = formData.get("isEnabled") === "on";

  if (!tenantId) return { error: "Tenant inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!membership || !["admin", "supervisor"].includes(membership.role)) {
    return { error: "Sem permissão." };
  }

  const { error } = await supabase
    .from("ai_configs")
    .update({
      name,
      instructions,
      is_enabled: isEnabled,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/ai");
  revalidatePath("/app/settings/assistant");
  revalidatePath("/app/settings/playbook");
  revalidatePath("/app/ai");
  revalidatePath("/app/settings");
  return { success: "Assistente atualizado." };
}
