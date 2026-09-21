"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  createDeal,
  updateContactAttributeValue,
  type CrmState,
} from "@/app/actions/crm";
import { formatBytes } from "@/lib/attachments/format";
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

export type LeadAttachment = {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number;
  kind: string;
  status: string;
  created_at: string;
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
  attachments: LeadAttachment[];
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

function formatContactWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return sameDay ? `Hoje, ${time}` : formatDate(iso);
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
    "bg-brand-soft text-brand-deep",
    "bg-[#e0f2fe] text-info",
    "bg-[#fef3c7] text-[#b45309]",
    "bg-[#f3e8ff] text-[#7c3aed]",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i) * 17) % tones.length;
  return tones[h];
}

function extLabel(name: string | null, mime: string | null) {
  if (name?.includes(".")) return name.split(".").pop()?.toUpperCase() ?? "FILE";
  if (mime?.includes("pdf")) return "PDF";
  if (mime?.startsWith("image/")) return "IMG";
  if (mime?.startsWith("audio/")) return "AUD";
  if (mime?.startsWith("video/")) return "VID";
  return "FILE";
}

const STATUS_LABEL: Record<string, string> = {
  ai_active: "IA",
  waiting_human: "Aguardando",
  human_active: "Humano",
  resolved: "Resolvida",
};

type FilterTemp = "all" | LeadTemperature;
type FilterStatus = "all" | string;
type DetailTab = "resumo" | "dados" | "arquivos" | "deal";

const empty: CrmState = {};

export function LeadsTable({
  rows,
  attributes,
  firstStageId,
  attachmentMaxMb = 10,
}: {
  rows: LeadRow[];
  attributes: LeadAttributeDef[];
  firstStageId: string | null;
  attachmentMaxMb?: number;
}) {
  const [search, setSearch] = useState("");
  const [tempFilter, setTempFilter] = useState<FilterTemp>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("resumo");

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

  function openLead(id: string) {
    setSelectedId(id);
    setTab("resumo");
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div
        className={`grid min-h-0 flex-1 grid-cols-1 ${
          selected ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""
        }`}
      >
        <div
          className={`inbox-scroll min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 ${
            selected ? "hidden lg:block" : ""
          }`}
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                Leads
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Temperatura, dados coletados, deals e anexos do WhatsApp.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-body">
                <span className="live-dot size-1.5 rounded-full bg-success" />
                WhatsApp conectado
              </span>
              <Link
                href="/app/settings/ai?tab=campos"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-body hover:bg-paper"
              >
                Campos
              </Link>
              <Link
                href="/app/deals"
                className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep"
              >
                Abrir funil
              </Link>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Total", value: stats.total, hint: "leads", tone: "text-ink" },
              { label: "Quentes", value: stats.hot, hint: "hot", tone: "text-red-600" },
              { label: "Mornos", value: stats.warm, hint: "warm", tone: "text-amber-600" },
              { label: "Frios", value: stats.cold, hint: "cold", tone: "text-slate-500" },
              { label: "Com deal", value: stats.withDeal, hint: "pipeline", tone: "text-brand" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
              >
                <p className="text-xs font-medium text-ink-muted">{s.label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>
                  {s.value}
                </p>
                <p className="mt-1 text-[11px] text-ink-placeholder">{s.hint}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper/80 px-3 py-2.5 sm:px-4">
              <label className="relative min-w-[12rem] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-placeholder">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="M16.5 16.5 20 20" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar na tabela…"
                  className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-placeholder focus:border-brand focus:ring-2 focus:ring-brand/15"
                />
              </label>
              <select
                value={tempFilter}
                onChange={(e) => setTempFilter(e.target.value as FilterTemp)}
                className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
                aria-label="Filtrar por temperatura"
              >
                <option value="all">Temperatura</option>
                <option value="hot">Quente</option>
                <option value="warm">Morno</option>
                <option value="cold">Frio</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
                aria-label="Filtrar por status"
              >
                <option value="all">Status</option>
                <option value="ai_active">IA ativa</option>
                <option value="waiting_human">Aguardando</option>
                <option value="human_active">Em atendimento</option>
                <option value="resolved">Resolvida</option>
              </select>
              <p className="ml-auto whitespace-nowrap px-1 text-xs text-ink-muted sm:text-sm">
                {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-ink-muted">
                Nenhum lead encontrado.
              </div>
            ) : (
              <>
                <ul className="divide-y divide-line md:hidden">
                  {filtered.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openLead(r.id)}
                        className={`flex w-full gap-3 px-4 py-3.5 text-left transition ${
                          selectedId === r.id
                            ? "bg-brand-soft/50"
                            : "active:bg-paper"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(r.id)}`}
                        >
                          {initials(r.display_name, r.phone_e164)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-semibold text-ink">
                              {r.display_name || r.company_name || "Sem nome"}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${temperatureClass(r.temperature)}`}
                            >
                              {temperatureLabel(r.temperature)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-muted">
                            {formatPhone(r.phone_e164)}
                            {r.company_name ? ` · ${r.company_name}` : ""}
                          </span>
                          {r.deal ? (
                            <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-ink-body">
                              <span
                                className="size-1.5 rounded-full"
                                style={{ background: r.deal.stage_color }}
                              />
                              {r.deal.stage_name}
                            </span>
                          ) : r.conv?.preview ? (
                            <span className="mt-1.5 block truncate text-[11px] text-ink-muted">
                              {r.conv.preview}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-3">Lead</th>
                      <th className="px-4 py-3">Telefone</th>
                      <th className="px-4 py-3">Temperatura</th>
                      <th className="hidden px-4 py-3 md:table-cell">Dados</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Deal</th>
                      <th className="hidden px-4 py-3 xl:table-cell">
                        Última mensagem
                      </th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        className={`cursor-pointer transition hover:bg-paper ${
                          selectedId === r.id ? "bg-brand-soft/50" : ""
                        }`}
                        onClick={() => openLead(r.id)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(r.id)}`}
                            >
                              {initials(r.display_name, r.phone_e164)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {r.display_name || r.company_name || "Sem nome"}
                              </p>
                              <p className="truncate text-xs text-ink-muted">
                                {r.company_name || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-ink-body">
                          {formatPhone(r.phone_e164)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${temperatureClass(r.temperature)}`}
                          >
                            {temperatureLabel(r.temperature)}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3.5 md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-paper">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{
                                  width: `${Math.round(r.fillRate * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-ink-muted">
                              {Math.round(r.fillRate * 100)}%
                            </span>
                            {r.attachments.length > 0 ? (
                              <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                                {r.attachments.length} arq
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 lg:table-cell">
                          {r.deal ? (
                            <div>
                              <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ background: r.deal.stage_color }}
                                />
                                {r.deal.stage_name}
                              </p>
                              {r.deal.value != null ? (
                                <p className="text-[11px] text-ink-muted">
                                  {r.deal.value.toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-muted">Sem deal</span>
                          )}
                        </td>
                        <td className="hidden max-w-[220px] px-4 py-3.5 xl:table-cell">
                          <p className="truncate text-ink-muted">
                            {r.conv?.preview || "—"}
                          </p>
                          <p className="text-[11px] text-ink-placeholder">
                            {formatDate(r.conv?.last_message_at ?? null)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {r.conv ? (
                            <Link
                              href={`/app/conversations?c=${r.conv.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-body hover:bg-paper"
                              title="Abrir conversa"
                            >
                              <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-3.8 2.8A.6.6 0 0 1 5.2 18.3V16H7.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Chat
                            </Link>
                          ) : (
                            <span className="text-xs text-ink-placeholder">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        </div>

        {selected ? (
          <LeadDetail
            lead={selected}
            attributes={attributes}
            firstStageId={firstStageId}
            tab={tab}
            onTab={setTab}
            attachmentMaxMb={attachmentMaxMb}
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
  tab,
  onTab,
  attachmentMaxMb,
  onClose,
}: {
  lead: LeadRow;
  attributes: LeadAttributeDef[];
  firstStageId: string | null;
  tab: DetailTab;
  onTab: (t: DetailTab) => void;
  attachmentMaxMb: number;
  onClose: () => void;
}) {
  const [attrState, attrAction, attrPending] = useActionState(
    updateContactAttributeValue,
    empty,
  );
  const [dealState, dealAction, dealPending] = useActionState(createDeal, empty);

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "resumo", label: "Resumo" },
    { id: "dados", label: "Dados" },
    {
      id: "arquivos",
      label: `Arquivos (${lead.attachments.length})`,
    },
    { id: "deal", label: "Deal" },
  ];

  return (
    <aside className="flex min-h-0 flex-1 flex-col border-line bg-surface lg:border-l">
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">
            {lead.display_name || lead.company_name || "Contato"}
          </p>
          <p className="text-xs text-ink-muted">{formatPhone(lead.phone_e164)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] text-success">
              <span className="size-1.5 rounded-full bg-success" />
              Online
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${temperatureClass(lead.temperature)}`}
            >
              {temperatureLabel(lead.temperature)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-full text-ink-muted hover:bg-paper"
        >
          ×
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-medium transition ${
              tab === t.id
                ? "border-b-2 border-brand text-brand"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="inbox-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {tab === "resumo" ? (
          <>
            <div className="rounded-xl border border-brand/20 bg-brand-soft/50 p-3 text-xs leading-relaxed text-brand-deep">
              {lead.conv?.status === "ai_active"
                ? "A IA está atendendo esta conversa no momento."
                : lead.conv
                  ? `Status: ${STATUS_LABEL[lead.conv.status] ?? lead.conv.status}`
                  : "Ainda não há conversa aberta com este lead."}
            </div>

            <div className="space-y-2.5 text-sm">
              <InfoRow label="Nome" value={lead.display_name || "—"} />
              <InfoRow label="Telefone" value={formatPhone(lead.phone_e164)} />
              <InfoRow label="Canal" value="WhatsApp" />
              <InfoRow
                label="Última interação"
                value={formatContactWhen(lead.conv?.last_message_at ?? null)}
              />
              <InfoRow
                label="Status"
                value={
                  lead.conv
                    ? STATUS_LABEL[lead.conv.status] ?? lead.conv.status
                    : "—"
                }
              />
            </div>

            {lead.attachments.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">
                  Documentos enviados ({lead.attachments.length})
                </p>
                <ul className="space-y-2">
                  {lead.attachments.slice(0, 4).map((f) => (
                    <AttachmentRow key={f.id} file={f} />
                  ))}
                </ul>
                {lead.attachments.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => onTab("arquivos")}
                    className="mt-2 text-xs font-medium text-brand hover:underline"
                  >
                    Ver todos os arquivos
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "dados" ? (
          <div>
            {attributes.length === 0 ? (
              <p className="text-xs text-ink-muted">
                Nenhum campo configurado.{" "}
                <Link
                  href="/app/settings/ai?tab=campos"
                  className="text-brand hover:underline"
                >
                  Criar campos →
                </Link>
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
                        className="rounded-lg bg-paper px-2 text-xs font-medium hover:bg-line/50"
                      >
                        OK
                      </button>
                    </div>
                  </form>
                ))}
                {attrState.success ? (
                  <p className="text-xs text-brand">{attrState.success}</p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {tab === "arquivos" ? (
          <div>
            <p className="mb-3 text-xs text-ink-muted">
              Anexos recebidos no WhatsApp. Limite: {attachmentMaxMb} MB por
              arquivo.
            </p>
            {lead.attachments.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum arquivo ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lead.attachments.map((f) => (
                  <AttachmentRow key={f.id} file={f} />
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "deal" ? (
          <div>
            {lead.deal ? (
              <div className="rounded-xl border border-line bg-paper p-3">
                <p className="text-sm font-medium text-ink">{lead.deal.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: lead.deal.stage_color }}
                  />
                  {lead.deal.stage_name}
                </p>
                {lead.deal.value != null ? (
                  <p className="mt-1 text-sm font-semibold text-brand">
                    {lead.deal.value.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                ) : null}
                <Link
                  href="/app/deals"
                  className="mt-2 inline-block text-xs font-medium text-brand hover:underline"
                >
                  Ver no funil →
                </Link>
              </div>
            ) : (
              <form action={dealAction} className="space-y-2">
                <input type="hidden" name="contactId" value={lead.id} />
                {lead.conv ? (
                  <input
                    type="hidden"
                    name="conversationId"
                    value={lead.conv.id}
                  />
                ) : null}
                {firstStageId ? (
                  <input type="hidden" name="stageId" value={firstStageId} />
                ) : null}
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
                {dealState.error ? (
                  <p className="text-xs text-danger">{dealState.error}</p>
                ) : null}
              </form>
            )}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line p-4">
        {lead.conv ? (
          <Link
            href={`/app/conversations?c=${lead.conv.id}`}
            className="flex w-full items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Abrir conversa
          </Link>
        ) : (
          <p className="text-center text-xs text-ink-muted">
            Sem conversa vinculada ainda.
          </p>
        )}
      </div>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function AttachmentRow({ file }: { file: LeadAttachment }) {
  const canDownload = file.status === "stored";
  const label = file.file_name || "Arquivo";
  const statusHint =
    file.status === "rejected_too_large"
      ? "acima do limite"
      : file.status === "failed"
        ? "falha ao salvar"
        : file.status === "pending"
          ? "pendente"
          : null;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-[10px] font-bold text-brand">
        {extLabel(file.file_name, file.mime_type)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        <p className="text-[11px] text-ink-muted">
          {formatBytes(file.size_bytes)}
          {statusHint ? ` · ${statusHint}` : ""} ·{" "}
          {formatDate(file.created_at)}
        </p>
      </div>
      {canDownload ? (
        <a
          href={`/api/attachments/${file.id}`}
          className="text-xs font-medium text-brand hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Baixar
        </a>
      ) : null}
    </li>
  );
}
