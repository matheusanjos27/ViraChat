import { createServiceClient } from "@/lib/supabase/admin";
import { estimateUsdCost } from "@/lib/platform/usage";

export type TenantUsageSummary = {
  repliesMonth: number;
  repliesAll: number;
  tokensMonth: number;
  tokensAll: number;
  promptMonth: number;
  completionMonth: number;
  avgTokensPerReplyMonth: number;
  estimatedUsdMonth: number;
  conversationsOpen: number;
  conversationsAll: number;
  contacts: number;
  inboundMessagesMonth: number;
  aiOutboundMessagesMonth: number;
};


function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Resumo operacional de um cliente (super admin). */
export async function getTenantUsageSummary(
  tenantId: string,
): Promise<TenantUsageSummary> {
  const supabase = createServiceClient();
  const since = monthStartIso();

  const [
    { count: repliesMonth },
    { count: repliesAll },
    { data: usageMonth },
    { data: usageAll },
    { count: conversationsAll },
    { count: conversationsOpen },
    { count: contacts },
    { count: inboundMessagesMonth },
    { count: aiOutboundMessagesMonth },
  ] = await Promise.all([
    supabase
      .from("ai_reply_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", since),
    supabase
      .from("ai_reply_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("ai_usage_events")
      .select("prompt_tokens, completion_tokens, total_tokens")
      .eq("tenant_id", tenantId)
      .gte("created_at", since),
    supabase
      .from("ai_usage_events")
      .select("total_tokens")
      .eq("tenant_id", tenantId),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["ai_active", "waiting_human", "human_active"]),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("direction", "inbound")
      .gte("created_at", since),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("direction", "outbound")
      .eq("sender_type", "ai")
      .gte("created_at", since),
  ]);

  let promptMonth = 0;
  let completionMonth = 0;
  let tokensMonth = 0;
  for (const row of usageMonth ?? []) {
    promptMonth += row.prompt_tokens ?? 0;
    completionMonth += row.completion_tokens ?? 0;
    tokensMonth += row.total_tokens ?? 0;
  }

  let tokensAll = 0;
  for (const row of usageAll ?? []) {
    tokensAll += row.total_tokens ?? 0;
  }

  const repliesM = repliesMonth ?? 0;
  const avgTokensPerReplyMonth =
    repliesM > 0 ? Math.round(tokensMonth / repliesM) : 0;

  return {
    repliesMonth: repliesM,
    repliesAll: repliesAll ?? 0,
    tokensMonth,
    tokensAll,
    promptMonth,
    completionMonth,
    avgTokensPerReplyMonth,
    estimatedUsdMonth: estimateUsdCost({
      prompt_tokens: promptMonth,
      completion_tokens: completionMonth,
    }),
    conversationsOpen: conversationsOpen ?? 0,
    conversationsAll: conversationsAll ?? 0,
    contacts: contacts ?? 0,
    inboundMessagesMonth: inboundMessagesMonth ?? 0,
    aiOutboundMessagesMonth: aiOutboundMessagesMonth ?? 0,
  };
}

/** Uso do mês atual agrupado por tenant (lista de clientes). */
export async function getTenantsMonthUsageMap(tenantIds: string[]) {
  const empty = () => ({
    replies: 0,
    tokens: 0,
  });
  const map = new Map<string, { replies: number; tokens: number }>();
  if (tenantIds.length === 0) return map;

  for (const id of tenantIds) map.set(id, empty());

  const supabase = createServiceClient();
  const since = monthStartIso();

  const [{ data: replies }, { data: usage }] = await Promise.all([
    supabase
      .from("ai_reply_events")
      .select("tenant_id")
      .in("tenant_id", tenantIds)
      .gte("created_at", since),
    supabase
      .from("ai_usage_events")
      .select("tenant_id, total_tokens")
      .in("tenant_id", tenantIds)
      .gte("created_at", since),
  ]);

  for (const r of replies ?? []) {
    const cur = map.get(r.tenant_id) ?? empty();
    cur.replies += 1;
    map.set(r.tenant_id, cur);
  }
  for (const u of usage ?? []) {
    const cur = map.get(u.tenant_id) ?? empty();
    cur.tokens += u.total_tokens ?? 0;
    map.set(u.tenant_id, cur);
  }

  return map;
}
