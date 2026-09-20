"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  assumeConversationAction,
  releaseToAiAction,
  resolveConversationAction,
  sendAgentMessage,
  type ConversationActionState,
} from "@/app/actions/conversations";
import { createClient } from "@/lib/supabase/client";
import {
  statusLabel,
  type InboxConversation,
  type InboxMessage,
} from "@/lib/inbox/types";

const emptyAction: ConversationActionState = {};

type ListFilter = "all" | "unread" | "waiting" | "served";

function formatPhone(raw: string | null | undefined) {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) {
      return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    }
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function formatListTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (isYesterday) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastInteraction(iso: string | null) {
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
  return sameDay ? `Hoje, ${time}` : formatListTime(iso);
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

function demoTags(status: InboxConversation["status"]) {
  if (status === "ai_active") return ["Cliente", "Comercial", "SP"];
  if (status === "waiting_human") return ["Cliente", "Urgente"];
  if (status === "human_active") return ["Cliente", "Atendimento"];
  return ["Resolvida"];
}

export function InboxWorkspace({
  tenantId,
  initialConversations,
  initialMessages,
  initialSelectedId,
}: {
  tenantId: string;
  initialConversations: InboxConversation[];
  initialMessages: InboxMessage[];
  initialSelectedId: string | null;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [messages, setMessages] = useState<InboxMessage[]>(initialMessages);
  const [filter, setFilter] = useState("");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const counts = useMemo(() => {
    const active = conversations.filter((c) => c.status !== "resolved");
    return {
      all: conversations.length,
      active: active.length,
      unread: conversations.filter((c) => c.status === "waiting_human").length,
      waiting: conversations.filter((c) => c.status === "waiting_human").length,
      served: conversations.filter(
        (c) => c.status === "human_active" || c.status === "resolved",
      ).length,
    };
  }, [conversations]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (listFilter === "unread" || listFilter === "waiting") {
      list = list.filter((c) => c.status === "waiting_human");
    } else if (listFilter === "served") {
      list = list.filter(
        (c) => c.status === "human_active" || c.status === "resolved",
      );
    }
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const hay =
        `${c.contact.display_name ?? ""} ${c.contact.phone_e164 ?? ""} ${c.preview ?? ""} ${c.channel_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter, listFilter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as InboxMessage & {
            conversation_id?: string;
          };
          if (!row?.conversation_id) return;

          if (payload.eventType === "INSERT" && selectedId === row.conversation_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [
                ...prev,
                {
                  id: row.id,
                  body: row.body,
                  direction: row.direction,
                  sender_type: row.sender_type,
                  created_at: row.created_at,
                },
              ];
            });
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === row.conversation_id);
            if (idx < 0) return prev;
            const next = [...prev];
            const item = { ...next[idx] };
            if (payload.eventType === "INSERT") {
              item.preview = row.body;
              item.last_message_at = row.created_at;
            }
            next.splice(idx, 1);
            next.unshift(item);
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            status: InboxConversation["status"];
            last_message_at: string | null;
            assigned_to: string | null;
          };
          setConversations((prev) =>
            prev.map((c) =>
              c.id === row.id
                ? {
                    ...c,
                    status: row.status,
                    last_message_at: row.last_message_at,
                    assigned_to: row.assigned_to,
                  }
                : c,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, selectedId]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
    setLoadingThread(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, body, direction, sender_type, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as InboxMessage[]) ?? []);
    setLoadingThread(false);
  }

  const aiOutboundCount = messages.filter(
    (m) => m.direction === "outbound" && m.sender_type === "ai",
  ).length;

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-1 bg-[#eef1f0] ${
        detailsOpen
          ? "lg:grid-cols-[340px_minmax(0,1fr)_300px]"
          : "lg:grid-cols-[340px_minmax(0,1fr)]"
      }`}
    >
      {/* Lista */}
      <section className="flex min-h-0 flex-col border-r border-[#d9e2de] bg-white">
        <div className="border-b border-[#d9e2de] px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Conversas</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="live-dot size-1.5 rounded-full bg-[#1f9d55]" />
                {counts.active} ativas
              </p>
            </div>
          </div>

          <label className="relative mt-3 block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16.5 16.5 20 20" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por número, nome ou empresa..."
              className="w-full rounded-full border border-[#d9e2de] bg-[#f4f7f6] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10"
            />
          </label>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                ["all", `Todas (${counts.all})`],
                ["unread", `Não lidas (${counts.unread})`],
                ["waiting", `Aguardando (${counts.waiting})`],
                ["served", `Atendidas (${counts.served})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setListFilter(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  listFilter === key
                    ? "bg-[#0c6b5c] text-white"
                    : "bg-[#eef3f1] text-ink-muted hover:bg-[#e2ebe8]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-muted">
              Nenhuma conversa nesta lista. Use o SQL de demo ou aguarde um
              WhatsApp.
            </div>
          ) : (
            filtered.map((c) => {
              const active = c.id === selectedId;
              const waiting = c.status === "waiting_human";
              const phone = formatPhone(c.contact.phone_e164);
              const name =
                c.contact.display_name || c.contact.external_id || "Contato";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void selectConversation(c.id)}
                  className={`flex w-full gap-3 border-b border-[#eef2f0] px-4 py-3.5 text-left transition ${
                    active ? "bg-[#e7f4ef]" : "hover:bg-[#f7faf9]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(c.id)}`}
                  >
                    {initials(c.contact.display_name, c.contact.phone_e164)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {phone}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        {formatListTime(c.last_message_at)}
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">
                        {c.preview || "Sem mensagens"}
                      </span>
                      {waiting ? (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1f9d55] text-[10px] font-bold text-white">
                          !
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Thread */}
      <section className="relative flex min-h-0 flex-col bg-[#f3f6f5]">
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-[#d9e2de] bg-white px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(selected.id)}`}
                >
                  {initials(
                    selected.contact.display_name,
                    selected.contact.phone_e164,
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {formatPhone(selected.contact.phone_e164)}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {selected.contact.display_name || "Contato"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#1f9d55]">
                    <span className="size-1.5 rounded-full bg-[#1f9d55]" />
                    {statusLabel(selected.status)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ConversationControls
                  conversationId={selected.id}
                  status={selected.status}
                />
                <button
                  type="button"
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="hidden size-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-[#eef3f1] lg:flex"
                  title="Detalhes"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="inbox-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
              <div className="flex justify-center">
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-ink-muted shadow-sm">
                  Hoje
                </span>
              </div>
              {loadingThread ? (
                <p className="text-center text-sm text-ink-muted">Carregando…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-ink-muted">
                  Sem mensagens nesta conversa.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.direction === "outbound";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[min(520px,82%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                          mine
                            ? "rounded-br-md bg-[#d8efe4] text-ink"
                            : "rounded-bl-md border border-[#e4ebe8] bg-white text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
                          {m.sender_type === "ai"
                            ? "IA · "
                            : m.sender_type === "agent"
                              ? "Você · "
                              : ""}
                          {formatMsgTime(m.created_at)}
                          {mine ? (
                            <svg viewBox="0 0 16 12" className="size-3 text-[#3b82f6]">
                              <path
                                fill="currentColor"
                                d="M5.5 9.2 1.8 5.5l1-1 2.7 2.7L12.2 1l1 1z"
                              />
                              <path
                                fill="currentColor"
                                d="M7.2 9.2 3.5 5.5l1-1 2.7 2.7.7-.8.9.9z"
                                opacity=".85"
                              />
                            </svg>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <Composer
              conversationId={selected.id}
              canSend={selected.status === "human_active"}
              aiActive={selected.status === "ai_active"}
              aiCount={aiOutboundCount}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="brand-mark text-3xl text-brand-deep">ViraChat</p>
            <p className="mt-3 max-w-sm text-sm text-ink-muted">
              Selecione uma conversa à esquerda para ler e responder.
            </p>
          </div>
        )}
      </section>

      {/* Detalhes */}
      {detailsOpen ? (
        <aside className="hidden min-h-0 border-l border-[#d9e2de] bg-white lg:flex lg:flex-col">
          <div className="flex items-center justify-between border-b border-[#d9e2de] px-4 py-3.5">
            <h3 className="text-sm font-semibold">Detalhes do contato</h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-[#eef3f1]"
            >
              ×
            </button>
          </div>
          {selected ? (
            <div className="inbox-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
              <div className="flex flex-col items-center text-center">
                <span
                  className={`flex size-16 items-center justify-center rounded-full text-lg font-semibold ${avatarTone(selected.id)}`}
                >
                  {initials(
                    selected.contact.display_name,
                    selected.contact.phone_e164,
                  )}
                </span>
                <p className="mt-3 text-base font-semibold">
                  {selected.contact.display_name || "Contato"}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {formatPhone(selected.contact.phone_e164)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#1f9d55]">
                  <span className="size-1.5 rounded-full bg-[#1f9d55]" />
                  Online
                </p>
              </div>


              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Resumo da conversa</p>
                  <span className="rounded-full bg-[#e7f0ff] px-2 py-0.5 text-[10px] font-semibold text-[#3b5bdb]">
                    IA
                  </span>
                </div>
                <div className="rounded-xl border border-[#e4ebe8] bg-[#f7faf9] p-3 text-xs leading-relaxed text-ink-muted">
                  {selected.status === "ai_active"
                    ? `A conversa está sendo atendida pela IA. Ela já respondeu ${aiOutboundCount} mensagen${aiOutboundCount === 1 ? "" : "s"} e está aguardando o próximo contato.`
                    : selected.status === "waiting_human"
                      ? "O contato pediu atendimento humano. Assuma a conversa para responder."
                      : selected.status === "human_active"
                        ? "Você está atendendo esta conversa. A IA está pausada."
                        : "Conversa resolvida."}
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                <DetailRow
                  label="Nome"
                  value={selected.contact.display_name || "—"}
                />
                <DetailRow
                  label="Telefone"
                  value={formatPhone(selected.contact.phone_e164)}
                />
                <DetailRow
                  label="Canal"
                  value={selected.channel_name || "WhatsApp"}
                />
                <DetailRow
                  label="Última interação"
                  value={formatLastInteraction(selected.last_message_at)}
                />
                <DetailRow
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#1f9d55]" />
                      {statusLabel(selected.status)}
                    </span>
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Tags</p>
                  <button
                    type="button"
                    disabled
                    className="text-xs font-medium text-brand"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {demoTags(selected.status).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-[#eef3f1] px-2.5 py-1 text-xs text-ink"
                    >
                      {tag} <span className="text-ink-muted">×</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Observações</p>
                  <span className="text-ink-muted">✎</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Adicionar uma observação..."
                  className="w-full resize-none rounded-xl border border-[#d9e2de] bg-[#f7faf9] px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-ink-muted">
              Selecione uma conversa para ver os detalhes.
            </p>
          )}
        </aside>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#eef2f0] pb-2.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function ConversationControls({
  conversationId,
  status,
}: {
  conversationId: string;
  status: InboxConversation["status"];
}) {
  const [assumeState, assumeAction, assumePending] = useActionState(
    assumeConversationAction,
    emptyAction,
  );
  const [releaseState, releaseAction, releasePending] = useActionState(
    releaseToAiAction,
    emptyAction,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveConversationAction,
    emptyAction,
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {(status === "ai_active" || status === "waiting_human") && (
        <form action={assumeAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button
            type="submit"
            disabled={assumePending}
            className="rounded-lg bg-[#0c6b5c] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#084c42] disabled:opacity-60"
          >
            {assumePending ? "…" : "Assumir"}
          </button>
        </form>
      )}
      {status === "human_active" && (
        <form action={releaseAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button
            type="submit"
            disabled={releasePending}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#f4f7f6] disabled:opacity-60"
          >
            {releasePending ? "…" : "Devolver à IA"}
          </button>
        </form>
      )}
      {status !== "resolved" && (
        <form action={resolveAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button
            type="submit"
            disabled={resolvePending}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink disabled:opacity-60"
          >
            Resolver
          </button>
        </form>
      )}
      {(assumeState.error || releaseState.error || resolveState.error) && (
        <p className="w-full text-right text-xs text-red-600">
          {assumeState.error || releaseState.error || resolveState.error}
        </p>
      )}
    </div>
  );
}

function Composer({
  conversationId,
  canSend,
  aiActive,
  aiCount,
}: {
  conversationId: string;
  canSend: boolean;
  aiActive: boolean;
  aiCount: number;
}) {
  const [state, action, pending] = useActionState(sendAgentMessage, emptyAction);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="border-t border-[#d9e2de] bg-white px-4 py-3">
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input
          name="body"
          required
          disabled={!canSend || pending}
          placeholder={
            canSend ? "Digite sua mensagem..." : "Assuma a conversa para digitar…"
          }
          className="min-h-11 flex-1 rounded-full border border-[#d9e2de] bg-[#f4f7f6] px-4 text-sm outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend || pending}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0c6b5c] text-white shadow-sm transition hover:bg-[#084c42] disabled:opacity-40"
        >
          {pending ? "…" : "➤"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {aiActive ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#0c6b5c] px-3.5 py-2.5 text-white">
          <p className="text-xs leading-snug">
            <span className="font-semibold">IA ativa</span> — A IA está
            respondendo automaticamente
            {aiCount > 0 ? ` (${aiCount} enviadas)` : ""}.
          </p>
          <span className="shrink-0 text-[11px] font-medium text-accent/90">
            Assuma para intervir →
          </span>
        </div>
      ) : null}
    </div>
  );
}
