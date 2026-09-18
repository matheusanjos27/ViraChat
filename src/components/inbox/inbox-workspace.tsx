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
  statusTone,
  type InboxConversation,
  type InboxMessage,
} from "@/lib/inbox/types";

const emptyAction: ConversationActionState = {};

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [loadingThread, setLoadingThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.contact.display_name ?? ""} ${c.contact.phone_e164 ?? ""} ${c.preview ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, filter]);

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
        async (payload) => {
          const row = (payload.new ?? payload.old) as InboxMessage & {
            conversation_id?: string;
            tenant_id?: string;
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

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_280px]">
      {/* Lista */}
      <section className="flex min-h-0 flex-col border-r border-line bg-surface">
        <div className="border-b border-line px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-tight">Conversas</h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
              <span className="live-dot size-1.5 rounded-full bg-brand" />
              ao vivo
            </span>
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar contato ou mensagem…"
            className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <div className="inbox-scroll min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">
              Nenhuma conversa ainda. Quando alguém mandar WhatsApp no número
              conectado, aparece aqui.
            </div>
          ) : (
            filtered.map((c) => {
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void selectConversation(c.id)}
                  className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3.5 text-left transition ${
                    active ? "bg-brand-soft" : "hover:bg-paper"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">
                      {c.contact.display_name ||
                        c.contact.phone_e164 ||
                        "Contato"}
                    </p>
                    <span className="shrink-0 text-[11px] text-ink-muted">
                      {formatTime(c.last_message_at)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-ink-muted">
                    {c.preview || "Sem mensagens"}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                    {c.channel_name ? (
                      <span className="truncate text-[11px] text-ink-muted">
                        {c.channel_name}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Thread */}
      <section className="flex min-h-0 flex-col bg-[linear-gradient(180deg,#f7faf9_0%,#eef3f1_100%)]">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b border-line bg-surface/90 px-5 py-3.5 backdrop-blur">
              <div>
                <h2 className="font-semibold">
                  {selected.contact.display_name ||
                    selected.contact.phone_e164 ||
                    "Contato"}
                </h2>
                <p className="text-xs text-ink-muted">
                  {selected.contact.phone_e164 ||
                    selected.contact.external_id ||
                    "—"}
                </p>
              </div>
              <ConversationControls
                conversationId={selected.id}
                status={selected.status}
              />
            </div>

            <div className="inbox-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {loadingThread ? (
                <p className="text-sm text-ink-muted">Carregando…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-ink-muted">
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
                        className={`max-w-[min(520px,85%)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                          mine
                            ? "rounded-br-md bg-brand text-white"
                            : "rounded-bl-md border border-line bg-surface text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-ink-muted"}`}
                        >
                          {m.sender_type === "ai"
                            ? "IA · "
                            : m.sender_type === "agent"
                              ? "Atendente · "
                              : ""}
                          {formatTime(m.created_at)}
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
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="brand-mark text-3xl text-brand-deep">ViraChat</p>
            <p className="mt-3 max-w-sm text-sm text-ink-muted">
              Selecione uma conversa à esquerda para ler e responder. A IA
              atende sozinha até alguém assumir.
            </p>
          </div>
        )}
      </section>

      {/* Contato */}
      <aside className="hidden min-h-0 border-l border-line bg-surface lg:flex lg:flex-col">
        <div className="border-b border-line px-4 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Contato
          </h3>
        </div>
        {selected ? (
          <div className="space-y-4 px-4 py-5">
            <div>
              <p className="text-xs text-ink-muted">Nome</p>
              <p className="mt-1 font-medium">
                {selected.contact.display_name || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Telefone</p>
              <p className="mt-1 font-medium">
                {selected.contact.phone_e164 ||
                  selected.contact.external_id ||
                  "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Status</p>
              <p className="mt-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusTone(selected.status)}`}
                >
                  {statusLabel(selected.status)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Canal</p>
              <p className="mt-1 font-medium">
                {selected.channel_name || "WhatsApp"}
              </p>
            </div>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-ink-muted">
            Detalhes do contato aparecem aqui.
          </p>
        )}
      </aside>
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {(status === "ai_active" || status === "waiting_human") && (
        <form action={assumeAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <button
            type="submit"
            disabled={assumePending}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
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
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-60"
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
            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink disabled:opacity-60"
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
}: {
  conversationId: string;
  canSend: boolean;
}) {
  const [state, action, pending] = useActionState(sendAgentMessage, emptyAction);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="border-t border-line bg-surface px-4 py-3">
      {!canSend && (
        <p className="mb-2 text-xs text-ink-muted">
          Assuma a conversa para responder. Enquanto estiver com a IA, ela
          responde sozinha.
        </p>
      )}
      <form
        ref={formRef}
        action={action}
        className="flex items-end gap-2"
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="body"
          rows={2}
          required
          disabled={!canSend || pending}
          placeholder={
            canSend ? "Escreva sua resposta…" : "Assuma para digitar…"
          }
          className="min-h-[52px] flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canSend || pending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
        >
          {pending ? "…" : "Enviar"}
        </button>
      </form>
      {state.error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
