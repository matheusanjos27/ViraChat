import { createServiceClient } from "@/lib/supabase/admin";
import { isUiPreview } from "@/lib/dev/ui-preview";

export type PlanLimits = {
  planId: string | null;
  planSlug: string;
  planName: string;
  planDescription: string | null;
  isCustom: boolean;
  maxMembers: number;
  maxChannels: number;
  maxAiRepliesMonth: number;
};

export type AiReplyUsage = {
  used: number;
  limit: number;
  remaining: number;
  atLimit: boolean;
  pct: number;
  monthStartIso: string;
};

function monthStartUtc() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getTenantPlanLimits(
  tenantId: string,
): Promise<PlanLimits | null> {
  if (isUiPreview()) {
    return {
      planId: null,
      planSlug: "basico",
      planName: "Básico",
      planDescription: "Preview local",
      isCustom: false,
      maxMembers: 2,
      maxChannels: 2,
      maxAiRepliesMonth: 500,
    };
  }

  const admin = createServiceClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select(
      "id, max_members, plan_id, custom_max_members, custom_max_channels, custom_max_ai_replies_month, plans(id, slug, name, description, max_members, max_channels, max_ai_replies_month, is_custom)",
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return null;

  const planRaw = tenant.plans as unknown;
  const plan = Array.isArray(planRaw)
    ? (planRaw[0] as {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        max_members: number;
        max_channels: number;
        max_ai_replies_month: number;
        is_custom: boolean;
      } | null)
    : (planRaw as {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        max_members: number;
        max_channels: number;
        max_ai_replies_month: number;
        is_custom: boolean;
      } | null);

  const isCustom = Boolean(plan?.is_custom);
  const maxMembers =
    (isCustom ? tenant.custom_max_members : null) ??
    plan?.max_members ??
    tenant.max_members ??
    2;
  const maxChannels =
    (isCustom ? tenant.custom_max_channels : null) ??
    plan?.max_channels ??
    2;
  const maxAiRepliesMonth =
    (isCustom ? tenant.custom_max_ai_replies_month : null) ??
    plan?.max_ai_replies_month ??
    500;

  return {
    planId: plan?.id ?? tenant.plan_id ?? null,
    planSlug: plan?.slug ?? "basico",
    planName: plan?.name ?? "Básico",
    planDescription: plan?.description ?? null,
    isCustom,
    maxMembers,
    maxChannels,
    maxAiRepliesMonth,
  };
}

export async function countTenantChannels(tenantId: string) {
  const admin = createServiceClient();
  // Conta todos os WhatsApps (conectados ou não) — canal ainda ocupa vaga.
  const { count } = await admin
    .from("whatsapp_accounts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

export async function getAiReplyUsageThisMonth(
  tenantId: string,
  limit: number,
): Promise<AiReplyUsage> {
  if (isUiPreview()) {
    return {
      used: 42,
      limit,
      remaining: Math.max(0, limit - 42),
      atLimit: false,
      pct: limit <= 0 ? 0 : Math.min(100, Math.round((42 / limit) * 100)),
      monthStartIso: monthStartUtc().toISOString(),
    };
  }

  const admin = createServiceClient();
  const start = monthStartUtc();
  const { count } = await admin
    .from("ai_reply_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString());

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);
  const atLimit = limit > 0 && used >= limit;
  const pct =
    limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

  return {
    used,
    limit,
    remaining,
    atLimit,
    pct,
    monthStartIso: start.toISOString(),
  };
}

export async function recordAiReplyEvent(input: {
  tenantId: string;
  conversationId?: string;
}) {
  try {
    const admin = createServiceClient();
    await admin.from("ai_reply_events").insert({
      tenant_id: input.tenantId,
      conversation_id: input.conversationId ?? null,
    });
  } catch (err) {
    console.error("[plans] record ai reply failed", err);
  }
}

export async function disableTenantAi(tenantId: string) {
  const admin = createServiceClient();
  await admin
    .from("ai_configs")
    .update({ is_enabled: false })
    .eq("tenant_id", tenantId);
}

/** Pode religar a IA se ainda houver cota no mês (ou teto ilimitado/maior). */
export async function canEnableTenantAi(tenantId: string) {
  const limits = await getTenantPlanLimits(tenantId);
  if (!limits) return { ok: false as const, reason: "Empresa não encontrada." };
  if (limits.maxAiRepliesMonth <= 0) {
    return { ok: true as const, limits };
  }
  const usage = await getAiReplyUsageThisMonth(
    tenantId,
    limits.maxAiRepliesMonth,
  );
  if (usage.atLimit) {
    return {
      ok: false as const,
      reason:
        "Cota mensal de respostas da IA esgotada. Espere o próximo mês ou peça um plano com teto maior.",
      limits,
      usage,
    };
  }
  return { ok: true as const, limits, usage };
}

export async function assertChannelSlotAvailable(tenantId: string) {
  const limits = await getTenantPlanLimits(tenantId);
  if (!limits) return { ok: false as const, error: "Empresa não encontrada." };
  const used = await countTenantChannels(tenantId);
  if (used >= limits.maxChannels) {
    return {
      ok: false as const,
      error: `Limite de WhatsApps do plano ${limits.planName} atingido (${used}/${limits.maxChannels}). Desconectados também contam. Entre em contato conosco para aumentar.`,
      used,
      limit: limits.maxChannels,
    };
  }
  return { ok: true as const, used, limit: limits.maxChannels, limits };
}

const TEST_AI_DAILY_MAX = 10;

export async function assertTestAiAllowed(tenantId: string) {
  const admin = createServiceClient();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("ai_test_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", start.toISOString());

  const used = count ?? 0;
  if (used >= TEST_AI_DAILY_MAX) {
    return {
      ok: false as const,
      error: `Limite diário de Testar IA atingido (${TEST_AI_DAILY_MAX}/dia). Tente amanhã.`,
      used,
      limit: TEST_AI_DAILY_MAX,
    };
  }
  return { ok: true as const, used, limit: TEST_AI_DAILY_MAX };
}

export async function recordTestAiEvent(input: {
  tenantId: string;
  userId?: string;
}) {
  try {
    const admin = createServiceClient();
    await admin.from("ai_test_events").insert({
      tenant_id: input.tenantId,
      user_id: input.userId ?? null,
    });
  } catch (err) {
    console.error("[plans] record test ai failed", err);
  }
}

export { TEST_AI_DAILY_MAX };
