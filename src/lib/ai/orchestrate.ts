import { getDefaultAiProvider } from "@/lib/ai/providers/openai";
import type { AiChatMessage } from "@/lib/ai/types";
import { buildAttributePromptBlock } from "@/lib/crm/attributes";
import {
  buildPlaybookPromptBlock,
  pickActivePlaybook,
  type Playbook,
} from "@/lib/crm/playbook";
import {
  buildCatalogPromptBlock,
  formatQuoteMessage,
  quoteCatalog,
  type ServiceForQuote,
} from "@/lib/crm/pricing";
import { decryptToken } from "@/lib/crypto/tokens";
import { canAiReply } from "@/lib/conversations/status";
import { sendWhatsAppText } from "@/lib/meta/whatsapp";
import { createServiceClient } from "@/lib/supabase/admin";

export async function runAiForConversation(conversationId: string) {
  const supabase = createServiceClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, status, channel_id, contact_id, contacts(phone_e164, external_id, display_name), channels(id, whatsapp_accounts(phone_number_id, access_token_encrypted))",
    )
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.warn("[ai] conversation missing", conversationId, convError);
    return { skipped: "missing_conversation" as const };
  }

  if (!canAiReply(conversation.status)) {
    return { skipped: "not_ai_active" as const, status: conversation.status };
  }

  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("name, instructions, is_enabled")
    .eq("tenant_id", conversation.tenant_id)
    .maybeSingle();

  if (!aiConfig?.is_enabled) {
    return { skipped: "ai_disabled" as const };
  }

  const { data: tenantProfile } = await supabase
    .from("tenants")
    .select("name, about, phone, website")
    .eq("id", conversation.tenant_id)
    .maybeSingle();

  const [
    { data: messages },
    { data: attributes },
    { data: attrValues },
    { data: services },
    { data: tiers },
    { data: playbooks },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("body, direction, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("contact_attributes")
      .select(
        "id, key, label, type, options, required, collect_via_ai, sort_order, tenant_id, created_at, updated_at",
      )
      .eq("tenant_id", conversation.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("contact_attribute_values")
      .select("attribute_id, value")
      .eq("contact_id", conversation.contact_id),
    supabase
      .from("services")
      .select(
        "id, name, description, billing_type, unit_label, unit_attribute_key, base_price, min_price, is_active",
      )
      .eq("tenant_id", conversation.tenant_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("service_pricing_tiers")
      .select(
        "id, service_id, min_units, max_units, price, price_mode, sort_order",
      )
      .eq("tenant_id", conversation.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("playbooks")
      .select("id, name, trigger, trigger_keyword, is_active, content")
      .eq("tenant_id", conversation.tenant_id),
  ]);

  const latestInbound = [...(messages ?? [])]
    .reverse()
    .find((m) => m.direction === "inbound" && m.body);
  if (!latestInbound?.body) {
    return { skipped: "no_inbound" as const };
  }

  const history: AiChatMessage[] = (messages ?? [])
    .filter((m) => m.body)
    .slice(0, -1)
    .map((m) => ({
      role:
        m.direction === "inbound"
          ? ("user" as const)
          : ("assistant" as const),
      content: m.body as string,
    }));

  const attrList = attributes ?? [];
  const valueByAttrId = new Map(
    (attrValues ?? []).map((v) => [v.attribute_id, v.value]),
  );
  const currentValues: Record<string, string | null> = {};
  for (const a of attrList) {
    currentValues[a.key] = valueByAttrId.get(a.id) ?? null;
  }
  const attributeBlock = buildAttributePromptBlock(attrList, currentValues);

  const tiersByService = new Map<string, NonNullable<typeof tiers>>();
  for (const t of tiers ?? []) {
    const list = tiersByService.get(t.service_id) ?? [];
    list.push(t);
    tiersByService.set(t.service_id, list);
  }

  const catalog: ServiceForQuote[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    billing_type: s.billing_type,
    unit_label: s.unit_label,
    unit_attribute_key: s.unit_attribute_key,
    base_price: Number(s.base_price),
    min_price: s.min_price != null ? Number(s.min_price) : null,
    is_active: s.is_active,
    tiers: (tiersByService.get(s.id) ?? []).map((t) => ({
      id: t.id,
      min_units: t.min_units,
      max_units: t.max_units,
      price: Number(t.price),
      price_mode: t.price_mode,
      sort_order: t.sort_order,
    })),
  }));

  let catalogBlock = buildCatalogPromptBlock(catalog);
  const units = resolveUnits(catalog, currentValues);
  if (units != null && units > 0 && catalog.length > 0) {
    const quote = quoteCatalog(catalog, units);
    catalogBlock = `${catalogBlock}\n\nORÇAMENTO PRÉ-CALCULADO PELO SISTEMA (${units} unidades) — use estes números, não recalcule:\n${formatQuoteMessage(quote, units)}`;

    const { data: deal } = await supabase
      .from("deals")
      .select("id")
      .eq("contact_id", conversation.contact_id)
      .limit(1)
      .maybeSingle();
    if (deal && quote.total > 0) {
      await supabase
        .from("deals")
        .update({ value: quote.total })
        .eq("id", deal.id);
    }
  }

  const provider = getDefaultAiProvider();
  const activePlaybook = pickActivePlaybook(
    (playbooks ?? []) as Playbook[],
    latestInbound.body,
  );
  const playbookBlock = buildPlaybookPromptBlock(activePlaybook);

  const tenant = tenantProfile;

  const companyBlock = tenant
    ? [
        `EMPRESA QUE VOCÊ REPRESENTA: ${tenant.name}`,
        tenant.about ? `Sobre: ${tenant.about}` : null,
        tenant.phone ? `Telefone: ${tenant.phone}` : null,
        tenant.website ? `Site: ${tenant.website}` : null,
        "Use esses dados na apresentação e quando o cliente perguntar sobre a empresa.",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const result = await provider.generateReply({
    agentName: aiConfig.name,
    instructions: aiConfig.instructions,
    history,
    latestUserMessage: latestInbound.body,
    playbookBlock: [companyBlock, playbookBlock].filter(Boolean).join("\n\n"),
    attributeBlock,
    catalogBlock,
  });

  if (result.collected && Object.keys(result.collected).length > 0) {
    await persistCollectedAttributes({
      supabase,
      tenantId: conversation.tenant_id,
      contactId: conversation.contact_id,
      attributes: attrList,
      collected: result.collected,
    });
  }

  if (result.action === "reply" && result.deal_stage) {
    await maybeMoveDealStage({
      supabase,
      tenantId: conversation.tenant_id,
      contactId: conversation.contact_id,
      stageNameHint: result.deal_stage,
    });
  }

  const { data: fresh } = await supabase
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();

  if (!fresh || !canAiReply(fresh.status)) {
    return { skipped: "status_changed" as const, status: fresh?.status };
  }

  const contact = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
  } | null;

  const channel = conversation.channels as unknown as {
    whatsapp_accounts:
      | { phone_number_id: string; access_token_encrypted: string }
      | { phone_number_id: string; access_token_encrypted: string }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  if (!wa || !to) {
    return { skipped: "missing_channel_or_contact" as const };
  }

  const outboundText =
    result.action === "handoff"
      ? result.text ||
        "Vou te transferir para um atendente humano. Aguarde um momento."
      : result.text;

  let providerMessageId: string | null = null;
  try {
    const token = decryptToken(wa.access_token_encrypted);
    providerMessageId = await sendWhatsAppText({
      phoneNumberId: wa.phone_number_id,
      accessToken: token,
      toE164: to,
      body: outboundText,
    });
  } catch (err) {
    console.error("[ai] send failed", err);
    return {
      error: err instanceof Error ? err.message : "send_failed",
    };
  }

  const now = new Date().toISOString();
  await supabase.from("messages").insert({
    tenant_id: conversation.tenant_id,
    conversation_id: conversationId,
    direction: "outbound",
    sender_type: "ai",
    body: outboundText,
    provider_message_id: providerMessageId,
    created_at: now,
  });

  if (result.action === "handoff") {
    await supabase
      .from("conversations")
      .update({
        status: "waiting_human",
        last_message_at: now,
      })
      .eq("id", conversationId)
      .eq("status", "ai_active");
  } else {
    await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);
  }

  await maybeCreateDealFromConversation({
    supabase,
    tenantId: conversation.tenant_id,
    contactId: conversation.contact_id,
    conversationId,
    contactName: contact?.display_name ?? null,
  });

  return {
    ok: true as const,
    action: result.action,
    conversationId,
    collected: result.collected,
  };
}

function resolveUnits(
  catalog: ServiceForQuote[],
  values: Record<string, string | null>,
): number | null {
  const keys = new Set<string>();
  for (const s of catalog) {
    if (s.unit_attribute_key) keys.add(s.unit_attribute_key);
  }
  keys.add("tamanho");
  keys.add("funcionarios");
  keys.add("colaboradores");

  for (const key of keys) {
    const raw = values[key];
    if (!raw) continue;
    const n = Number(String(raw).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function maybeMoveDealStage({
  supabase,
  tenantId,
  contactId,
  stageNameHint,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  tenantId: string;
  contactId: string;
  stageNameHint: string;
}) {
  const hint = stageNameHint.trim().toLowerCase();
  if (!hint) return;

  const { data: stages } = await supabase
    .from("deal_stages")
    .select("id, name")
    .eq("tenant_id", tenantId);

  const stage = (stages ?? []).find(
    (s) =>
      s.name.toLowerCase() === hint ||
      s.name.toLowerCase().includes(hint) ||
      hint.includes(s.name.toLowerCase()),
  );
  if (!stage) return;

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (!deal) return;

  await supabase
    .from("deals")
    .update({ stage_id: stage.id })
    .eq("id", deal.id);
}

async function persistCollectedAttributes({
  supabase,
  tenantId,
  contactId,
  attributes,
  collected,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  tenantId: string;
  contactId: string;
  attributes: { id: string; key: string }[];
  collected: Record<string, string>;
}) {
  const byKey = new Map(attributes.map((a) => [a.key, a.id]));
  const contactPatch: {
    company_name?: string;
    email?: string;
    display_name?: string;
  } = {};

  for (const [key, value] of Object.entries(collected)) {
    const attributeId = byKey.get(key);
    if (!attributeId || !value.trim()) continue;

    await supabase.from("contact_attribute_values").upsert(
      {
        tenant_id: tenantId,
        contact_id: contactId,
        attribute_id: attributeId,
        value: value.trim(),
      },
      { onConflict: "contact_id,attribute_id" },
    );

    if (key === "empresa" || key === "company" || key === "company_name") {
      contactPatch.company_name = value.trim();
    }
    if (key === "email") contactPatch.email = value.trim();
    if (key === "responsavel" || key === "nome") {
      contactPatch.display_name = value.trim();
    }
  }

  if (Object.keys(contactPatch).length > 0) {
    await supabase.from("contacts").update(contactPatch).eq("id", contactId);
  }
}

async function maybeCreateDealFromConversation({
  supabase,
  tenantId,
  contactId,
  conversationId,
  contactName,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  tenantId: string;
  contactId: string;
  conversationId: string;
  contactName: string | null;
}) {
  const { data: existing } = await supabase
    .from("deals")
    .select("id")
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { count } = await supabase
    .from("contact_attribute_values")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId)
    .not("value", "is", null);

  if ((count ?? 0) < 2) return;

  const { data: firstStage } = await supabase
    .from("deal_stages")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstStage) return;

  const { data: contact } = await supabase
    .from("contacts")
    .select("display_name, company_name, phone_e164")
    .eq("id", contactId)
    .maybeSingle();

  const title =
    contact?.company_name ||
    contact?.display_name ||
    contactName ||
    contact?.phone_e164 ||
    "Novo lead";

  await supabase.from("deals").insert({
    tenant_id: tenantId,
    contact_id: contactId,
    conversation_id: conversationId,
    stage_id: firstStage.id,
    title,
  });
}
