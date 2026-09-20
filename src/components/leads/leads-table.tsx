"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  createDeal,
  updateContactAttributeValue,
  type CrmState,
} from "@/app/actions/crm";
import {
  temperatureClass,
  temperatureLabel,
  type LeadTemperature,
} from "@/lib/crm/temperature";

export type LeadAttributeDef = {
  id: string;
  key: string;
  label: string;
  type: string;
};

export type LeadRow = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  email: string | null;
  company_name: string | null;
  temperature: LeadTemperature;
  created_at: string;
  totalConvs: number;
  attributeValues: Record<string, string | null>;
  fillRate: number;
  deal: {
    id: string;
    title: string;
    value: number | null;
    stage_name: string;
    stage_color: string;
  } | null;
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
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}m atrás`;
  if (diffH < 24) return `${diffH}h atrás`;
  if (diffD === 1) return "Ontem";
  if (diffD < 7) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
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

const STATUS_LABEL: Record<string, string> = {
  ai_active: "IA ativa",
  waiting_human: "Aguardando",
  human_active: "Em atendimento",
  resolved: "Resolvida",
};

type FilterTemp = "all" | LeadTemperature;
type FilterStatus = "all" | string;

const empty: CrmState = {};

export function LeadsTable({
  rows,
  attributes,
  firstStageId,
}: {
  rows: LeadRow[];
  attributes: LeadAttributeDef[];
  firstStageId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState<FilterTemp>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tempFilter !== "all" && r.temperature !== tempFilter) return false;
      if (statusFilter !== "all" && r.conv?.status !== statusFilter) return false;
      if (q) {
        const attrs = Object.values(r.attributeValues).join(" ");
        const hay =
          `${r.display_name ?? ""} ${r.phone_e164 ?? ""} ${r.company_name ?? ""} ${r.email ?? ""} ${attrs}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, tempFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      hot: rows.filter((r) => r.temperature === "hot").length,
      warm: rows.filter((r) => r.temperature === "warm").length,
      cold: rows.filter((r) => r.temperature === "cold").length,
      withDeal: rows.filter((r) => r.deal).length,
    };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats.total, color: "text-ink" },
          { label: "Quentes", value: stats.hot, color: "text-red-600" },
          { label: "Mornos", value: stats.warm, color: "text-amber-600" },
          { label: "Frios", value: stats.cold, color: "text-slate-500" },
          { label: "Com deal", value: stats.withDeal, color: "text-brand" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
          >
            <p className="text-xs text-ink-muted">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, telefone, empresa, campos…"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-3 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
          />
        </div>
        <select
          value={tempFilter}
          onChange={(e) => setTempFilter(e.target.value as FilterTemp)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="all">Toda temperatura</option>
          <option value="hot">Quente</option>
          <option value="warm">Morno</option>
          <option value="cold">Frio</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="ai_active">IA ativa</option>
          <option value="waiting_human">Aguardando</option>
          <option value="human_active">Em atendimento</option>
          <option value="resolved">Resolvida</option>
        </select>
        <p className="ml-auto text-sm text-ink-muted">
          {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex min-h-0 gap-4">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-ink-muted">
              Nenhum lead encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-[#f7faf9] text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    <th className="px-5 py-3">Contato</th>
                    <th className="px-5 py-3">Temperatura</th>
                    <th className="hidden px-5 py-3 md:table-cell">Dados</th>
                    <th className="hidden px-5 py-3 lg:table-cell">Deal</th>
                    <th className="hidden px-5 py-3 xl:table-cell">Última msg</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={`cursor-pointer transition hover:bg-[#f7faf9] ${
                        selectedId === r.id ? "bg-[#e7f4ef]" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(r.id)}`}
                          >
                            {initials(r.display_name, r.phone_e164)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {r.display_name ||
                                r.company_name ||
                                "Sem nome"}
                            </p>
                            <p className="truncate text-xs text-ink-muted">
                              {formatPhone(r.phone_e164)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${temperatureClass(r.temperature)}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              r.temperature === "hot"
                                ? "bg-red-500"
                                : r.temperature === "warm"
                                  ? "bg-amber-400"
                                  : "bg-slate-400"
                            }`}
                          />
                          {temperatureLabel(r.temperature)}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eef3f1]">
                            <div
                              className="h-full rounded-full bg-brand"
                              style={{ width: `${Math.round(r.fillRate * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-muted">
                            {Math.round(r.fillRate * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 lg:table-cell">
                        {r.deal ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span
                              className="size-2 rounded-full"
                              style={{ background: r.deal.stage_color }}
                            />
                            {r.deal.stage_name}
                          </span>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="hidden max-w-[200px] px-5 py-4 xl:table-cell">
                        <p className="truncate text-ink-muted">
                          {r.conv?.preview || "—"}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          {formatDate(r.conv?.last_message_at ?? null)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {r.conv ? (
                          <a
                            href={`/app/conversations?c=${r.conv.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-[#eef3f1]"
                          >
                            Chat →
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

        {selected ? (
          <LeadDetail
            lead={selected}
            attributes={attributes}
            firstStageId={firstStageId}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

function LeadDetail({
  lead,
  attributes,
  firstStageId,
  onClose,
}: {
  lead: LeadRow;
  attributes: LeadAttributeDef[];
  firstStageId: string | null;
  onClose: () => void;
}) {
  const [attrState, attrAction, attrPending] = useActionState(
    updateContactAttributeValue,
    empty,
  );
  const [dealState, dealAction, dealPending] = useActionState(createDeal, empty);

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)] lg:flex">
      <div className="flex items-start justify-between border-b border-line px-4 py-4">
        <div>
          <p className="font-semibold">
            {lead.display_name || lead.company_name || "Contato"}
          </p>
          <p className="text-xs text-ink-muted">{formatPhone(lead.phone_e164)}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${temperatureClass(lead.temperature)}`}
          >
            {temperatureLabel(lead.temperature)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-full text-ink-muted hover:bg-[#eef3f1]"
        >
          ×
        </button>
      </div>

      <div className="inbox-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Dados coletados
          </p>
          {attributes.length === 0 ? (
            <p className="text-xs text-ink-muted">
              Nenhum campo configurado.{" "}
              <a href="/app/settings/fields" className="text-brand hover:underline">
                Criar campos →
              </a>
            </p>
          ) : (
            <div className="space-y-2">
              {attributes.map((a) => (
                <form key={a.id} action={attrAction} className="space-y-1">
                  <input type="hidden" name="contactId" value={lead.id} />
                  <input type="hidden" name="attributeId" value={a.id} />
                  <label className="text-[11px] text-ink-muted">{a.label}</label>
                  <div className="flex gap-1">
                    <input
                      name="value"
                      defaultValue={lead.attributeValues[a.key] ?? ""}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-brand"
                    />
                    <button
                      type="submit"
                      disabled={attrPending}
                      className="rounded-lg bg-[#eef3f1] px-2 text-xs font-medium hover:bg-[#e2ebe8]"
                    >
                      OK
                    </button>
                  </div>
                </form>
              ))}
              {attrState.success && (
                <p className="text-xs text-brand">{attrState.success}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Deal
          </p>
          {lead.deal ? (
            <div className="rounded-xl border border-line bg-[#f7faf9] p-3">
              <p className="text-sm font-medium">{lead.deal.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  className="size-2 rounded-full"
                  style={{ background: lead.deal.stage_color }}
                />
                {lead.deal.stage_name}
              </p>
              {lead.deal.value != null && (
                <p className="mt-1 text-sm font-semibold text-brand">
                  {lead.deal.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </p>
              )}
              <a
                href="/app/deals"
                className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
              >
                Ver no funil →
              </a>
            </div>
          ) : (
            <form action={dealAction} className="space-y-2">
              <input type="hidden" name="contactId" value={lead.id} />
              {lead.conv && (
                <input type="hidden" name="conversationId" value={lead.conv.id} />
              )}
              {firstStageId && (
                <input type="hidden" name="stageId" value={firstStageId} />
              )}
              <input
                name="title"
                required
                defaultValue={
                  lead.company_name ||
                  lead.display_name ||
                  formatPhone(lead.phone_e164)
                }
                placeholder="Título do deal"
                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-brand"
              />
              <input
                name="value"
                placeholder="Valor (R$)"
                className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="submit"
                disabled={dealPending || !firstStageId}
                className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
              >
                {dealPending ? "Criando…" : "Criar deal"}
              </button>
              {dealState.error && (
                <p className="text-xs text-red-600">{dealState.error}</p>
              )}
            </form>
          )}
        </div>

        {lead.conv && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Conversa
            </p>
            <p className="text-xs text-ink-muted">
              {STATUS_LABEL[lead.conv.status] ?? lead.conv.status} ·{" "}
              {formatDate(lead.conv.last_message_at)}
            </p>
            <a
              href={`/app/conversations?c=${lead.conv.id}`}
              className="mt-2 inline-block rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-[#eef3f1]"
            >
              Abrir conversa →
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
