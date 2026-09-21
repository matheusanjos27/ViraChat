import { createServiceClient } from "@/lib/supabase/admin";
import { AI_LIMITS } from "@/lib/ai/limits";

export async function getTenantMonthTokenUsage(tenantId: string) {
  const supabase = createServiceClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_usage_events")
    .select("total_tokens")
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString());

  if (error) {
    console.error("[ai-usage] month sum failed", error.message);
    return 0;
  }

  return (data ?? []).reduce((acc, row) => acc + (row.total_tokens ?? 0), 0);
}

export function resolveMonthlyTokenLimit(limit: number | null | undefined) {
  if (limit == null) return AI_LIMITS.defaultMonthlyTokens;
  // 0 = ilimitado (somente platform)
  if (limit === 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit);
}

export async function isMonthlyTokenBudgetExceeded(
  tenantId: string,
  monthlyLimit: number | null | undefined,
) {
  const cap = resolveMonthlyTokenLimit(monthlyLimit);
  if (!Number.isFinite(cap)) return { exceeded: false, used: 0, limit: cap };
  const used = await getTenantMonthTokenUsage(tenantId);
  return { exceeded: used >= cap, used, limit: cap };
}
