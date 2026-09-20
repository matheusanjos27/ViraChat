import { redirect } from "next/navigation";
import { DealsBoard, type DealCard, type StageCol } from "@/components/crm/deals-board";
import { createClient } from "@/lib/supabase/server";

export default async function DealsPage() {
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

  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase
      .from("deal_stages")
      .select("id, name, color, sort_order, is_closed_won, is_closed_lost")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("deals")
      .select(
        "id, title, value, stage_id, contact_id, conversation_id, updated_at, contacts(display_name, phone_e164, temperature)",
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
  ]);

  const stageCols: StageCol[] = (stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    is_closed_won: s.is_closed_won,
    is_closed_lost: s.is_closed_lost,
  }));

  type DealRow = {
    id: string;
    title: string;
    value: number | null;
    stage_id: string;
    contact_id: string;
    conversation_id: string | null;
    updated_at: string;
    contacts: {
      display_name: string | null;
      phone_e164: string | null;
      temperature: "hot" | "warm" | "cold";
    } | null;
  };

  const cards: DealCard[] = ((deals ?? []) as unknown as DealRow[]).map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    stage_id: d.stage_id,
    contact_id: d.contact_id,
    conversation_id: d.conversation_id,
    contact_name: d.contacts?.display_name ?? null,
    contact_phone: d.contacts?.phone_e164 ?? null,
    temperature: d.contacts?.temperature ?? "warm",
    updated_at: d.updated_at,
  }));

  return (
    <div className="h-full min-h-0 bg-[#eef1f0]">
      <DealsBoard stages={stageCols} deals={cards} />
    </div>
  );
}
