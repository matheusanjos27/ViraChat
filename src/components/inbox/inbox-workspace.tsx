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
  type InboxChannelOption,
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

/** Evita mismatch de hidratação (fuso / “agora” vs horário do servidor). */
function ClientDate({
  iso,
  mode,
  className,
}: {
  iso: string | null;
  mode: "list" | "msg" | "last";
  className?: string;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (mode === "msg" && iso) setText(formatMsgTime(iso));
    else if (mode === "last") setText(formatLastInteraction(iso));
    else setText(formatListTime(iso));
  }, [iso, mode]);
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
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

function demoTags(status: InboxConversation["status"]) {
  if (status === "ai_active") return ["Cliente", "Comercial", "SP"];
  if (status === "waiting_human") return ["Cliente", "Urgente"];
  if (status === "human_active") return ["Cliente", "Atendimento"];
  return ["Resolvida"];
}

export function InboxWorkspace({
  tenantId,
  channels = [],
  initialConversations,
  initialMessages,
  initialSelectedId,
}: {
  tenantId: string;
  channels?: InboxChannelOption[];
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
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [liveState, setLiveState] = useState<"connecting" | "live" | "polling">(
    "polling",
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const channelOptions = useMemo(() => {
    const fromProps = new Map(channels.map((c) => [c.id, c.display_name]));
    for (const c of conversations) {
      if (c.channel_id && c.channel_name && !fromProps.has(c.channel_id)) {
        fromProps.set(c.channel_id, c.channel_name);
      }
    }
    return [...fromProps.entries()]
      .map(([id, display_name]) => ({ id, display_name }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));
  }, [channels, conversations]);

  const counts = useMemo(() => {
    const scoped =
      channelFilter === "all"
        ? conversations
        : conversations.filter((c) => c.channel_id === channelFilter);
    const active = scoped.filter((c) => c.status !== "resolved");
    return {
      all: scoped.length,
      active: active.length,
      unread: scoped.filter((c) => c.status === "waiting_human").length,
      waiting: scoped.filter((c) => c.status === "waiting_human").length,
      served: scoped.filter(
        (c) => c.status === "human_active" || c.status === "resolved",
      ).length,
    };
  }, [conversations, channelFilter]);

  const filtered = useMemo(() => {
    let list = conversations;
    if (channelFilter !== "all") {
      list = list.filter((c) => c.channel_id === channelFilter);
    }
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
  }, [conversations, filter, listFilter, channelFilter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Polling estável: Realtime estava derrubando a aba em produção (hydration/recover loop).
    setLiveState("polling");

    async function refreshList() {
      const { data: rows } = await supabase
        .from("conversations")
        .select(
          "id, status, last_message_at, assigned_to, channel_id, contacts(id, display_name, phone_e164, external_id), channels(id, display_name)",
        )
        .eq("tenant_id", tenantId)
        .order("last_message_at", { ascending: false })
        .limit(80);
      if (cancelled || !rows) return;

      const ids = rows.map((r) => r.id);
      const previewByConv = new Map<string, string | null>();
      if (ids.length > 0) {
        const { data: recentMsgs } = await supabase
          .from("messages")
          .select("conversation_id, body, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(200);
        for (const m of recentMsgs ?? []) {
          if (!previewByConv.has(m.conversation_id)) {
            previewByConv.set(m.conversation_id, m.body);
          }
        }
      }

      const next: InboxConversation[] = rows.map((r) => {
        const contact =
          (r.contacts as unknown as InboxConversation["contact"] | null) ?? {
            id: "unknown",
            display_name: null,
            phone_e164: null,
            external_id: null,
          };
        const channel = r.channels as unknown as {
          id: string;
          display_name: string;
        } | null;
        return {
          id: r.id,
          status: r.status as InboxConversation["status"],
          last_message_at: r.last_message_at,
          assigned_to: r.assigned_to,
          channel_id: r.channel_id ?? channel?.id ?? null,
          contact,
          preview: previewByConv.get(r.id) ?? null,
          channel_name: channel?.display_name ?? null,
        };
      });
      setConversations(next);

      const openId = selectedIdRef.current;
      if (openId) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("id, body, direction, sender_type, created_at")
          .eq("conversation_id", openId)
          .order("created_at", { ascending: true });
        if (!cancelled && msgs) {
          setMessages(msgs as InboxMessage[]);
        }
      }
    }

    const pollTimer = setInterval(() => {
      void refreshList();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
    };
  }, [tenantId]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    // Painel de detalhes só no desktop (no mobile atrapalha o chat).
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setDetailsOpen(true);
    }
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
    <div className="flex h-full min-h-0 flex-col bg-paper">
      {/* Top bar (desktop) */}
      <div className="hidden shrink-0 items-center gap-4 border-b border-line bg-surface px-5 py-3 md:flex">
        <label className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-placeholder">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16.5 16.5 20 20" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por número, nome ou empresa..."
            className="w-full rounded-xl border border-line bg-paper py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-placeholder focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-body">
            <span className="live-dot size-1.5 rounded-full bg-success" />
            WhatsApp conectado
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3.5 13.4 8.6 18.5 10 13.4 11.4 12 16.5 10.6 11.4 5.5 10l5.1-1.4L12 3.5Z" strokeLinejoin="round" />
            </svg>
            IA ativa
          </span>
        </div>
      </div>

      <div
        className={`relative grid min-h-0 flex-1 grid-cols-1 ${
          detailsOpen
            ? "md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_280px]"
            : "md:grid-cols-[300px_minmax(0,1fr)]"
        }`}
      >
      {/* Lista — some no mobile quando o chat está aberto */}
      <section
        className={`min-h-0 flex-col border-r border-line bg-surface ${
          selectedId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="border-b border-line px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                Conversas
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="live-dot size-1.5 rounded-full bg-success" />
                {counts.active} ativas
                {liveState === "live"
                  ? " · ao vivo"
                  : liveState === "polling"
                    ? " · atualizando…"
                    : " · conectando…"}
              </p>
            </div>
            {channelOptions.length > 0 ? (
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="max-w-[140px] rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink-body outline-none focus:border-brand"
              >
                <option value="all">Todos os canais</option>
                {channelOptions.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.display_name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <label className="relative mt-3 block md:hidden">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-placeholder">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16.5 16.5 20 20" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-xl border border-line bg-paper py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15"
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
                    ? "bg-brand text-white"
                    : "bg-paper text-ink-muted hover:bg-line/60"
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
              Nenhuma conversa nesta lista.
            </div>
          ) : (
            filtered.map((c) => {
              const active = c.id === selectedId;
              const waiting = c.status === "waiting_human";
              const name =
                c.contact.display_name ||
                formatPhone(c.contact.phone_e164) ||
                c.contact.external_id ||
                "Contato";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void selectConversation(c.id)}
                  className={`flex w-full gap-3 border-b border-line/70 px-4 py-3.5 text-left transition ${
                    active ? "bg-brand-soft/60" : "hover:bg-paper"
                  }`}
                >
                  <span className="relative mt-0.5 shrink-0">
                    <span
                      className={`flex size-11 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(c.id)}`}
                    >
                      {initials(c.contact.display_name, c.contact.phone_e164)}
                    </span>
                    {!waiting ? (
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-surface bg-success" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                        {name}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        <ClientDate iso={c.last_message_at} mode="list" />
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">
                        {c.preview || "Sem mensagens"}
                      </span>
                      {waiting ? (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warn text-[10px] font-bold text-white">
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

      {/* Thread — no mobile cobre a tela inteira (por cima da lista) */}
      <section
        className={`min-h-0 flex-col bg-paper ${
          selectedId
            ? "flex max-md:absolute max-md:inset-0 max-md:z-30"
            : "hidden md:flex"
        }`}
      >
        {selected ? (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-paper md:hidden"
                  aria-label="Voltar para lista"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold sm:size-11 ${avatarTone(selected.id)}`}
                >
                  {initials(
                    selected.contact.display_name,
                    selected.contact.phone_e164,
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {selected.contact.display_name ||
                      formatPhone(selected.contact.phone_e164) ||
                      "Contato"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {formatPhone(selected.contact.phone_e164)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-success">
                    <span className="size-1.5 rounded-full bg-success" />
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
                  className="hidden size-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-paper md:flex"
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

            <div className="inbox-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
              <div className="flex justify-center">
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium text-ink-muted">
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
                            ? "rounded-br-md bg-[#ccfbf1] text-ink"
                            : "rounded-bl-md border border-line bg-surface text-ink-body"
                        }`}
                      >
                        {m.sender_type === "ai" ? (
                          <span className="mb-1 inline-flex rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand-deep">
                            IA
                          </span>
                        ) : null}
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
                          {m.sender_type === "agent" ? "Você · " : ""}
                          <ClientDate iso={m.created_at} mode="msg" />
                          {mine ? (
                            <svg viewBox="0 0 16 12" className="size-3 text-info">
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
            <img src="/logo.png" alt="ViraChat" className="h-12 w-auto opacity-80" />
            <p className="mt-4 max-w-sm text-sm text-ink-muted">
              Selecione uma conversa na lista para ler e responder.
            </p>
          </div>
        )}
      </section>

      {/* Detalhes */}
      {detailsOpen ? (
        <aside className="hidden min-h-0 border-l border-line bg-surface lg:flex lg:flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h3 className="text-sm font-semibold text-ink">Detalhes do contato</h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(false)}
              className="flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-paper"
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
                <p className="mt-3 text-base font-semibold text-ink">
                  {selected.contact.display_name || "Contato"}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {formatPhone(selected.contact.phone_e164)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-success">
                  <span className="size-1.5 rounded-full bg-success" />
                  Online
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Resumo da conversa</p>
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-deep">
                    IA
                  </span>
                </div>
                <div className="rounded-xl border border-line bg-paper p-3 text-xs leading-relaxed text-ink-muted">
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
                  value={
                    <ClientDate iso={selected.last_message_at} mode="last" />
                  }
                />
                <DetailRow
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      <span className="size-1.5 rounded-full bg-success" />
                      {statusLabel(selected.status)}
                    </span>
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Tags</p>
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
                      className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-body"
                    >
                      {tag} <span className="text-ink-muted">×</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">Observações</p>
                  <span className="text-ink-muted">✎</span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Adicionar uma observação..."
                  className="w-full resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-placeholder focus:border-brand focus:ring-2 focus:ring-brand/15"
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
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
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
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
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
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-body hover:bg-paper disabled:opacity-60"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-body hover:bg-paper disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {resolvePending ? "…" : "Resolver"}
          </button>
        </form>
      )}
      {(assumeState.error || releaseState.error || resolveState.error) && (
        <p className="w-full text-right text-xs text-danger">
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
    <div className="border-t border-line bg-surface px-4 py-3">
      <form ref={formRef} action={action} className="flex items-center gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input
          name="body"
          required
          disabled={!canSend || pending}
          placeholder={
            canSend ? "Digite sua mensagem..." : "Assuma a conversa para digitar…"
          }
          className="min-h-11 flex-1 rounded-full border border-line bg-paper px-4 text-sm text-ink outline-none placeholder:text-ink-placeholder focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend || pending}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm transition hover:bg-brand-deep disabled:opacity-40"
          aria-label="Enviar"
        >
          {pending ? (
            "…"
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4l.1 6.8L15 12 3.5 13.8z" />
            </svg>
          )}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}
      {aiActive ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-brand px-3.5 py-2.5 text-white">
          <p className="text-xs leading-snug">
            <span className="font-semibold">IA ativa</span> — A IA está
            respondendo automaticamente
            {aiCount > 0 ? ` (${aiCount} enviada${aiCount === 1 ? "" : "s"})` : ""}
            . Assumir para intervir →
          </p>
        </div>
      ) : null}
    </div>
  );
}
