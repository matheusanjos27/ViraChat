import { AI_LIMITS, resolveHistoryTurns } from "@/lib/ai/limits";
import { createServiceClient } from "@/lib/supabase/admin";

export type AiCloseMode = "handoff" | "callback";

export function normalizeCloseMode(value: unknown): AiCloseMode {
  return value === "callback" ? "callback" : "handoff";
}

/** Histórico de mensagens da IA — configuração global (super admin). */
export async function getPlatformAiHistoryTurns(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("platform_settings")
      .select("ai_history_turns")
      .eq("id", 1)
      .maybeSingle();
    return resolveHistoryTurns(
      (data as { ai_history_turns?: number } | null)?.ai_history_turns,
    );
  } catch {
    return AI_LIMITS.historyTurns;
  }
}
