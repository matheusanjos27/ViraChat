import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeadsTable, type LeadRow } from "@/components/leads/leads-table";

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
  const { tenant_id: tenantId } = membership;

  const [{ data: contacts }, { data: conversations }, { data: lastMessages }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, display_name, phone_e164, created_at")
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
        .select("conversation_id, body, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(600),
    ]);

  type Conv = {
    id: string;
    contact_id: string;
    status: string;
    last_message_at: string | null;
  };

  // Preview por conversa (primeira mensagem mais recente)
  const previewMap = new Map<string, string>();
  for (const m of lastMessages ?? []) {
    if (!previewMap.has(m.conversation_id) && m.body) {
      previewMap.set(m.conversation_id, m.body);
    }
  }

  // Agrupa conversas por contato
  const convMap = new Map<string, Conv[]>();
  for (const conv of (conversations ?? []) as Conv[]) {
    const list = convMap.get(conv.contact_id) ?? [];
    list.push(conv);
    convMap.set(conv.contact_id, list);
  }

  const rows: LeadRow[] = (contacts ?? []).map((c) => {
    const convs = convMap.get(c.id) ?? [];
    const latest = convs[0] ?? null;
    return {
      id: c.id,
      display_name: c.display_name,
      phone_e164: c.phone_e164,
      created_at: c.created_at,
      totalConvs: convs.length,
      conv: latest
        ? {
            id: latest.id,
            status: latest.status,
            last_message_at: latest.last_message_at,
            preview: previewMap.get(latest.id) ?? null,
          }
        : null,
    };
  });

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Contatos
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-ink-muted">
            Todos os contatos que já interagiram pelo ViraChat.
          </p>
        </div>
        <LeadsTable rows={rows} />
      </div>
    </div>
  );
}
