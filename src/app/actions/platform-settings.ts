"use server";

import { revalidatePath } from "next/cache";
import { AI_LIMITS, resolveHistoryTurns } from "@/lib/ai/limits";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { createServiceClient } from "@/lib/supabase/admin";

export type PlatformSettingsState = {
  error?: string;
  success?: string;
};

export async function platformUpdateAiHistoryTurns(
  _prev: PlatformSettingsState,
  formData: FormData,
): Promise<PlatformSettingsState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const raw = Number.parseInt(String(formData.get("aiHistoryTurns") ?? "24"), 10);
  const ai_history_turns = resolveHistoryTurns(
    Number.isFinite(raw) ? raw : AI_LIMITS.historyTurns,
  );

  const admin = createServiceClient();
  const { error } = await admin.from("platform_settings").upsert(
    {
      id: 1,
      ai_history_turns,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { error: error.message };
  revalidatePath("/platform");
  revalidatePath("/platform/settings");
  return {
    success: `Histórico global da IA: ${ai_history_turns} mensagens.`,
  };
}
