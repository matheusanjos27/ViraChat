"use server";

import { revalidatePath } from "next/cache";
import { AI_LIMITS, clampSavedText } from "@/lib/ai/limits";
import { canEnableTenantAi } from "@/lib/plans/limits";
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
  const rawInstructions =
    String(formData.get("instructions") ?? "").trim() ||
    "Siga o roteiro de conversa e os dados da empresa.";
  const clamped = clampSavedText(rawInstructions, AI_LIMITS.instructions * 2);
  const instructions = clamped.value;
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

  if (isEnabled) {
    const gate = await canEnableTenantAi(tenantId);
    if (!gate.ok) {
      return { error: gate.reason };
    }
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
  return {
    success: clamped.truncated
      ? "Assistente atualizado (texto enxugado para caber no limite)."
      : "Assistente atualizado.",
  };
}
