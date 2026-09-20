import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatPhone(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9)
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return raw;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string | null | undefined, phone?: string | null) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-2) || "?";
}

function avatarTone(id: string) {
  const tones = [
    "bg-[#d8efe8] text-[#0c6b5c]",
    "bg-[#e8eef8] text-[#3b5bdb]",
    "bg-[#f3e8d8] text-[#9a5b12]",
    "bg-[#ebe6f5] text-[#5b3d9a]",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 17) % tones.length;
  return tones[h];
}

const statusLabel: Record<string, string> = {
  ai_active: "IA ativa",
  waiting_human: "Aguardando",
  human_active: "Em atendimento",
  resolved: "Resolvida",
};

const statusColor: Record<string, string> = {
  ai_active: "bg-[#e7f4ef] text-[#0c6b5c]",
  waiting_human: "bg-amber-50 text-amber-700",
  human_active: "bg-blue-50 text-blue-700",
  resolved: "bg-[#f4f7f6] text-ink-muted",
};

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

  const [{ data: contacts }, { data: conversations }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, display_name, phone_e164, external_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("conversations")
      .select("id, contact_id, status, last_message_at, created_at")
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false }),
  ]);

  type Conv = {
    id: string;
    contact_id: string;
    status: string;
    last_message_at: string | null;
    created_at: string;
  };

  // Agrupa conversas por contact_id
  const convMap = new Map<string, Conv[]>();
  for (const conv of (conversations ?? []) as Conv[]) {
    const list = convMap.get(conv.contact_id) ?? [];
    list.push(conv);
    convMap.set(conv.contact_id, list);
  }

  const rows = (contacts ?? []).map((c) => {
    const convs = convMap.get(c.id) ?? [];
    const latest = convs[0] ?? null; // já ordenado por last_message_at desc
    return { ...c, conv: latest, totalConvs: convs.length };
  });

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Contatos
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-2 text-ink-muted">
          Todos os contatos que já interagiram com o ViraChat.
        </p>

        {rows.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-line bg-surface p-10 text-center text-ink-muted">
            Nenhum contato ainda. Assim que alguém mandar mensagem no WhatsApp,
            ele vai aparecer aqui.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-[#f7faf9] text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="hidden px-5 py-3 md:table-cell">Conversas</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Último status</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Última interação</th>
                  <th className="hidden px-5 py-3 xl:table-cell">Cadastrado em</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="transition hover:bg-[#f7faf9]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(c.id)}`}
                        >
                          {initials(c.display_name, c.phone_e164)}
                        </span>
                        <span className="font-medium text-ink">
                          {c.display_name || "Sem nome"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {formatPhone(c.phone_e164)}
                    </td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <span className="rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs font-medium">
                        {c.totalConvs}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      {c.conv ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[c.conv.status] ?? "bg-[#f4f7f6] text-ink-muted"}`}
                        >
                          {statusLabel[c.conv.status] ?? c.conv.status}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="hidden px-5 py-4 text-ink-muted lg:table-cell">
                      {formatDate(c.conv?.last_message_at ?? null)}
                    </td>
                    <td className="hidden px-5 py-4 text-ink-muted xl:table-cell">
                      {formatDate(c.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {c.conv ? (
                        <a
                          href={`/app/conversations?conv=${c.conv.id}`}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-[#eef3f1]"
                        >
                          Ver conversa
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
