"use client";

import { useMemo, useState } from "react";

export type LeadRow = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  created_at: string;
  totalConvs: number;
  conv: {
    id: string;
    status: string;
    last_message_at: string | null;
    preview: string | null;
  } | null;
};

function formatPhone(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return raw;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}m atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD === 1) return "Ontem";
  if (diffD < 7) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function initials(name: string | null | undefined, phone?: string | null) {
  if (name?.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
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
    "bg-[#fde8e8] text-[#c0392b]",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 17) % tones.length;
  return tones[h];
}

const STATUS_LABEL: Record<string, string> = {
  ai_active: "IA ativa",
  waiting_human: "Aguardando",
  human_active: "Em atendimento",
  resolved: "Resolvida",
};

const STATUS_COLOR: Record<string, string> = {
  ai_active: "bg-[#e7f4ef] text-[#0c6b5c]",
  waiting_human: "bg-amber-50 text-amber-700",
  human_active: "bg-blue-50 text-blue-700",
  resolved: "bg-[#f4f7f6] text-ink-muted",
};

function retentionScore(row: LeadRow): number {
  if (!row.conv) return 30;
  let score = 50;

  // Recência
  const daysSince = row.conv.last_message_at
    ? Math.floor((Date.now() - new Date(row.conv.last_message_at).getTime()) / 86400000)
    : 999;
  if (daysSince <= 1) score += 30;
  else if (daysSince <= 3) score += 20;
  else if (daysSince <= 7) score += 5;
  else if (daysSince <= 30) score -= 15;
  else score -= 35;

  // Status
  if (row.conv.status === "resolved") score += 20;
  else if (row.conv.status === "human_active") score += 15;
  else if (row.conv.status === "ai_active") score += 5;
  else if (row.conv.status === "waiting_human") score -= 25;

  // Fidelidade
  if (row.totalConvs >= 5) score += 15;
  else if (row.totalConvs >= 3) score += 8;

  return Math.max(0, Math.min(100, score));
}

function RetentionBadge({ score }: { score: number }) {
  if (score >= 65)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f4ef] px-2.5 py-1 text-xs font-semibold text-[#0c6b5c]">
        <span className="size-1.5 rounded-full bg-[#1f9d55]" />
        Alta · {score}%
      </span>
    );
  if (score >= 40)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Média · {score}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
      <span className="size-1.5 rounded-full bg-red-400" />
      Baixa · {score}%
    </span>
  );
}

type FilterStatus = "all" | "ai_active" | "waiting_human" | "human_active" | "resolved";
type FilterRetention = "all" | "alta" | "media" | "baixa";

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [retentionFilter, setRetentionFilter] = useState<FilterRetention>("all");

  const rowsWithScore = useMemo(
    () => rows.map((r) => ({ ...r, score: retentionScore(r) })),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowsWithScore.filter((r) => {
      if (q) {
        const hay = `${r.display_name ?? ""} ${r.phone_e164 ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all" && r.conv?.status !== statusFilter) return false;
      if (retentionFilter === "alta" && r.score < 65) return false;
      if (retentionFilter === "media" && (r.score < 40 || r.score >= 65)) return false;
      if (retentionFilter === "baixa" && r.score >= 40) return false;
      return true;
    });
  }, [rowsWithScore, search, statusFilter, retentionFilter]);

  const stats = useMemo(() => {
    const total = rowsWithScore.length;
    const alta = rowsWithScore.filter((r) => r.score >= 65).length;
    const aguardando = rowsWithScore.filter((r) => r.conv?.status === "waiting_human").length;
    const ativos = rowsWithScore.filter(
      (r) => r.conv && ["ai_active", "human_active"].includes(r.conv.status),
    ).length;
    return { total, alta, aguardando, ativos };
  }, [rowsWithScore]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total de leads", value: stats.total, color: "text-ink" },
          { label: "Alta retenção", value: stats.alta, color: "text-[#0c6b5c]" },
          { label: "Em atendimento", value: stats.ativos, color: "text-blue-600" },
          { label: "Aguardando humano", value: stats.aguardando, color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
          >
            <p className="text-xs text-ink-muted">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16.5 16.5 20 20" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand"
        >
          <option value="all">Todos os status</option>
          <option value="ai_active">IA ativa</option>
          <option value="waiting_human">Aguardando</option>
          <option value="human_active">Em atendimento</option>
          <option value="resolved">Resolvida</option>
        </select>
        <select
          value={retentionFilter}
          onChange={(e) => setRetentionFilter(e.target.value as FilterRetention)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-brand"
        >
          <option value="all">Toda retenção</option>
          <option value="alta">Alta retenção</option>
          <option value="media">Média retenção</option>
          <option value="baixa">Baixa retenção</option>
        </select>
        {(search || statusFilter !== "all" || retentionFilter !== "all") && (
          <button
            type="button"
            onClick={() => { setSearch(""); setStatusFilter("all"); setRetentionFilter("all"); }}
            className="rounded-xl border border-line px-3 py-2.5 text-sm text-ink-muted transition hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
        <p className="ml-auto text-sm text-ink-muted">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-ink-muted">
            Nenhum lead encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-[#f7faf9] text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="hidden px-5 py-3 md:table-cell">Última mensagem</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Status</th>
                  <th className="px-5 py-3">Retenção</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Conversas</th>
                  <th className="hidden px-5 py-3 xl:table-cell">Última interação</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((r) => (
                  <tr key={r.id} className="transition hover:bg-[#f7faf9]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(r.id)}`}
                        >
                          {initials(r.display_name, r.phone_e164)}
                        </span>
                        <div>
                          <p className="font-medium text-ink">
                            {r.display_name || "Sem nome"}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {r.totalConvs} conversa{r.totalConvs !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">
                      {formatPhone(r.phone_e164)}
                    </td>
                    <td className="hidden max-w-[220px] px-5 py-4 md:table-cell">
                      <p className="truncate text-ink-muted">
                        {r.conv?.preview || "—"}
                      </p>
                    </td>
                    <td className="hidden px-5 py-4 lg:table-cell">
                      {r.conv ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[r.conv.status] ?? "bg-[#f4f7f6] text-ink-muted"}`}
                        >
                          {STATUS_LABEL[r.conv.status] ?? r.conv.status}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <RetentionBadge score={r.score} />
                    </td>
                    <td className="hidden px-5 py-4 sm:table-cell">
                      <span className="rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs font-medium">
                        {r.totalConvs}
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 text-ink-muted xl:table-cell">
                      {formatDate(r.conv?.last_message_at ?? null)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {r.conv ? (
                        <a
                          href={`/app/conversations?c=${r.conv.id}`}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-[#eef3f1]"
                        >
                          Ver conversa →
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
