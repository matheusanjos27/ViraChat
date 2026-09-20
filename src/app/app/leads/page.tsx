import { redirect } from "next/navigation";
import {
  LeadsTable,
  type LeadAttributeDef,
  type LeadRow,
} from "@/components/leads/leads-table";
import { computeTemperature, type LeadTemperature } from "@/lib/crm/temperature";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");
  const tenantId = membership.tenant_id;

  await supabase.rpc("seed_tenant_crm", { p_tenant_id: tenantId });

  const [
    { data: contacts },
    { data: conversations },
    { data: lastMessages },
    { data: attributes },
    { data: attrValues },
    { data: deals },
    { data: stages },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, display_name, phone_e164, email, company_name, temperature, created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("conversations")
      .select("id, contact_id, status, last_message_at")
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("messages")
      .select("conversation_id, body, direction, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("contact_attributes")
      .select("id, key, label, type")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("contact_attribute_values")
      .select("contact_id, attribute_id, value")
      .eq("tenant_id", tenantId),
    supabase
      .from("deals")
      .select("id, contact_id, title, value, stage_id")
      .eq("tenant_id", tenantId),
    supabase
      .from("deal_stages")
      .select("id, name, color, is_closed_won, is_closed_lost, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
  ]);

  const attrDefs = (attributes ?? []) as LeadAttributeDef[];
  const attrById = new Map(attrDefs.map((a) => [a.id, a.key]));

  type Conv = {
    id: string;
    contact_id: string;
    status: string;
    last_message_at: string | null;
  };

  const previewMap = new Map<string, string>();
  const inboundCount = new Map<string, number>();
  for (const m of lastMessages ?? []) {
    if (!previewMap.has(m.conversation_id) && m.body) {
      previewMap.set(m.conversation_id, m.body);
    }
    if (m.direction === "inbound") {
      inboundCount.set(
        m.conversation_id,
        (inboundCount.get(m.conversation_id) ?? 0) + 1,
      );
    }
  }

  const convMap = new Map<string, Conv[]>();
  for (const conv of (conversations ?? []) as Conv[]) {
    const list = convMap.get(conv.contact_id) ?? [];
    list.push(conv);
    convMap.set(conv.contact_id, list);
  }

  const valuesByContact = new Map<string, Record<string, string | null>>();
  for (const v of attrValues ?? []) {
    const key = attrById.get(v.attribute_id);
    if (!key) continue;
    const bag = valuesByContact.get(v.contact_id) ?? {};
    bag[key] = v.value;
    valuesByContact.set(v.contact_id, bag);
  }

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const dealByContact = new Map<
    string,
    {
      id: string;
      title: string;
      value: number | null;
      stage_name: string;
      stage_color: string;
      is_closed_won: boolean;
    }
  >();
  for (const d of deals ?? []) {
    if (dealByContact.has(d.contact_id)) continue;
    const stage = stageById.get(d.stage_id);
    dealByContact.set(d.contact_id, {
      id: d.id,
      title: d.title,
      value: d.value,
      stage_name: stage?.name ?? "—",
      stage_color: stage?.color ?? "#64748b",
      is_closed_won: stage?.is_closed_won ?? false,
    });
  }

  const rows: LeadRow[] = [];
  const tempUpdates: { id: string; temperature: LeadTemperature }[] = [];

  for (const c of contacts ?? []) {
    const convs = convMap.get(c.id) ?? [];
    const latest = convs[0] ?? null;
    const vals = valuesByContact.get(c.id) ?? {};
    const filled =
      attrDefs.length === 0
        ? 0
        : attrDefs.filter((a) => vals[a.key]?.trim()).length / attrDefs.length;
    const deal = dealByContact.get(c.id) ?? null;

    const temperature = computeTemperature({
      lastMessageAt: latest?.last_message_at ?? null,
      conversationStatus: latest?.status ?? null,
      hasDealInPipeline: !!deal && !deal.is_closed_won,
      dealIsClosedWon: deal?.is_closed_won ?? false,
      attributeFillRate: filled,
      inboundCount: latest ? (inboundCount.get(latest.id) ?? 0) : 0,
    });

    if (temperature !== c.temperature) {
      tempUpdates.push({ id: c.id, temperature });
    }

    rows.push({
      id: c.id,
      display_name: c.display_name,
      phone_e164: c.phone_e164,
      email: c.email,
      company_name: c.company_name,
      temperature,
      created_at: c.created_at,
      totalConvs: convs.length,
      attributeValues: vals,
      fillRate: filled,
      deal: deal
        ? {
            id: deal.id,
            title: deal.title,
            value: deal.value,
            stage_name: deal.stage_name,
            stage_color: deal.stage_color,
          }
        : null,
      conv: latest
        ? {
            id: latest.id,
            status: latest.status,
            last_message_at: latest.last_message_at,
            preview: previewMap.get(latest.id) ?? null,
          }
        : null,
    });
  }

  // Persist temperature updates (fire-and-forget via service role batch)
  if (tempUpdates.length > 0) {
    const admin = createServiceClient();
    await Promise.all(
      tempUpdates.map((u) =>
        admin
          .from("contacts")
          .update({
            temperature: u.temperature,
            temperature_updated_at: new Date().toISOString(),
          })
          .eq("id", u.id),
      ),
    );
  }

  const firstStageId = stages?.[0]?.id ?? null;

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
              Contatos
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Leads</h1>
            <p className="mt-1 text-ink-muted">
              Temperatura, dados coletados e deals — tudo em um lugar.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/app/settings/ai?tab=campos"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium hover:bg-[#f4f7f6]"
            >
              Campos
            </a>
            <a
              href="/app/deals"
              className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep"
            >
              Abrir funil
            </a>
          </div>
        </div>
        <LeadsTable
          rows={rows}
          attributes={attrDefs}
          firstStageId={firstStageId}
        />
      </div>
    </div>
  );
}
