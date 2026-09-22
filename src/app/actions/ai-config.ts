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
  const presentationRaw = String(formData.get("presentation") ?? "").trim();
  const promptRaw = String(formData.get("instructions") ?? "").trim();
  const presentation = clampSavedText(presentationRaw, 500).value;
  const promptClamped = clampSavedText(
    promptRaw ||
      "Siga o roteiro de conversa e os dados da empresa.",
    AI_LIMITS.instructions,
  );
  const instructions = promptClamped.value;
  const isEnabled = formData.get("isEnabled") === "on";
  const closeModeRaw = String(formData.get("closeMode") ?? "handoff");
  const close_mode =
    closeModeRaw === "callback" ? ("callback" as const) : ("handoff" as const);

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
      presentation,
      instructions,
      is_enabled: isEnabled,
      close_mode,
    })
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/ai");
  revalidatePath("/app/settings/assistant");
  revalidatePath("/app/settings/playbook");
  revalidatePath("/app/ai");
  revalidatePath("/app/settings");
  return {
    success: promptClamped.truncated
      ? "Assistente atualizado (texto enxugado para caber no limite)."
      : "Assistente atualizado.",
  };
}
