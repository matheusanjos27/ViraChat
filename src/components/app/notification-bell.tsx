"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  conversation_id: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(timeAgo(iso));
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

export function NotificationBell({
  tenantId,
  initialItems,
}: {
  tenantId: string;
  initialItems: NotificationItem[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Realtime desligado temporariamente (estabilidade no VPS); itens vêm do SSR/layout.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  async function markAllRead() {
    const supabase = createClient();
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now })),
    );
    await supabase
      .from("app_notifications")
      .update({ read_at: now })
      .in("id", unreadIds);
  }

  async function markOneRead(id: string) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: now } : n)),
    );
    const supabase = createClient();
    await supabase
      .from("app_notifications")
      .update({ read_at: now })
      .eq("id", id);
  }

  function requestBrowserPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          requestBrowserPermission();
        }}
        className="relative flex size-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        aria-label="Notificações"
        title="Notificações"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[#f59e0b] text-[9px] font-bold text-[#1a1205]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[320px] overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[0_16px_40px_rgba(0,0,0,0.18)] md:bottom-auto md:left-auto md:right-0 md:top-[calc(100%+8px)]">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-brand hover:underline"
              >
                Marcar lidas
              </button>
            ) : null}
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">
                Nenhuma notificação ainda.
              </p>
            ) : (
              items.map((n) => {
                const href = n.conversation_id
                  ? `/app/conversations?c=${n.conversation_id}`
                  : "/app/conversations";
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => {
                      void markOneRead(n.id);
                      setOpen(false);
                    }}
                    className={`block border-b border-[#eef2f0] px-3.5 py-3 transition hover:bg-[#f7faf9] ${
                      n.read_at ? "opacity-70" : "bg-[#f3faf7]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">
                        {n.title}
                      </p>
                      <span className="shrink-0 text-[10px] text-ink-muted">
                        <TimeAgo iso={n.created_at} />
                      </span>
                    </div>
                    {n.body ? (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                        {n.body}
                      </p>
                    ) : null}
                    {n.type === "handoff" ? (
                      <p className="mt-1.5 text-[11px] font-medium text-[#b54708]">
                        Aguardando humano
                      </p>
                    ) : null}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
