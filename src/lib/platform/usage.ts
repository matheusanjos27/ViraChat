import { createServiceClient } from "@/lib/supabase/admin";
import type { AiTokenUsage } from "@/lib/ai/types";

export async function recordAiUsage(input: {
  tenantId: string;
  conversationId?: string;
  provider?: string;
  usage?: AiTokenUsage | null;
}) {
  if (!input.usage || input.usage.total_tokens <= 0) return;
  try {
    const supabase = createServiceClient();
    await supabase.from("ai_usage_events").insert({
      tenant_id: input.tenantId,
      provider: input.provider ?? "openai",
      model: input.usage.model,
      prompt_tokens: input.usage.prompt_tokens,
      completion_tokens: input.usage.completion_tokens,
      total_tokens: input.usage.total_tokens,
      conversation_id: input.conversationId ?? null,
    });
  } catch (err) {
    console.error("[ai-usage] record failed", err);
  }
}

/** Estimativa grosseira USD (gpt-4o-mini). Só para dashboard. */
export function estimateUsdCost(usage: {
  prompt_tokens: number;
  completion_tokens: number;
}) {
  const inputPer1M = 0.15;
  const outputPer1M = 0.6;
  return (
    (usage.prompt_tokens / 1_000_000) * inputPer1M +
    (usage.completion_tokens / 1_000_000) * outputPer1M
  );
}

export function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
