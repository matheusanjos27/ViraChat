"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import type { NotificationItem } from "@/components/app/notification-bell";

const NotificationBell = dynamic(
  () =>
    import("@/components/app/notification-bell").then((m) => m.NotificationBell),
  { ssr: false },
);

const nav = [
  { href: "/app/conversations", label: "Conversas", icon: IconChat },
  { href: "/app/leads", label: "Leads", icon: IconUsers },
  { href: "/app/deals", label: "Funil", icon: IconFunnel },
  { href: "/app/channels", label: "Canais", icon: IconChannel },
  { href: "/app/settings/ai", label: "Atendimento com IA", icon: IconSpark },
  { href: "/app/settings", label: "Configurações", icon: IconSettings },
] as const;

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AppShell({
  children,
  tenantId,
  tenantName,
  userName,
  userRole,
  isPlatformAdmin,
  openCount = 0,
  waitingCount = 0,
  initialNotifications = [],
}: {
  children: React.ReactNode;
  tenantId?: string;
  tenantName?: string;
  userName?: string;
  userRole?: string;
  isPlatformAdmin?: boolean;
  openCount?: number;
  waitingCount?: number;
  initialNotifications?: NotificationItem[];
}) {
  const pathname = usePathname() ?? "";
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const roleLabel =
    userRole === "admin"
      ? "Administrador"
      : userRole === "supervisor"
        ? "Supervisor"
        : userRole === "agent"
          ? "Atendente"
          : isPlatformAdmin
            ? "Super admin"
            : "Membro";

  if (!mounted) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper text-sm text-ink-muted">
        Carregando painel…
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <aside className="relative hidden w-[220px] shrink-0 flex-col bg-[#0F172A] text-white md:flex">
        <div className="relative z-10 flex h-full flex-col px-3 py-4">
          <Link href="/app/conversations" className="flex justify-center px-1">
            <img
              src="/logo.png"
              alt="ViraChat"
              className="h-14 w-auto max-w-full object-contain"
            />
          </Link>

          {tenantName || tenantId ? (
            <div className="mx-1 mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                {tenantName ? (
                  <>
                    <p className="truncate text-sm font-semibold text-white">
                      {tenantName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/55">
                      <span className="live-dot size-1.5 rounded-full bg-success" />
                      Online
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/55">Notificações</p>
                )}
              </div>
              {tenantId ? (
                <NotificationBell
                  tenantId={tenantId}
                  initialItems={initialNotifications}
                />
              ) : null}
            </div>
          ) : null}

          <nav className="mt-5 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active =
                item.href === "/app/settings/ai"
                  ? pathname.startsWith("/app/settings/ai")
                  : item.href === "/app/settings"
                    ? pathname.startsWith("/app/settings") &&
                      !pathname.startsWith("/app/settings/ai")
                    : pathname.startsWith(item.href);
              const isConversas = item.label === "Conversas";
              const Icon = item.icon;
              const badge = isConversas
                ? waitingCount > 0
                  ? waitingCount
                  : openCount
                : 0;
              const showDividerBefore =
                item.href === "/app/settings/ai" ||
                item.href === "/app/settings";
              return (
                <div key={item.label}>
                  {showDividerBefore ? (
                    <div className="my-2 border-t border-white/10" />
                  ) : null}
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition ${
                      active
                        ? "bg-[#134E4A] font-semibold text-white"
                        : "font-medium text-white/70 hover:bg-[#1E293B] hover:text-white"
                    }`}
                  >
                    <Icon className="size-[18px] shrink-0 opacity-90" />
                    <span className="flex-1 leading-snug tracking-tight">
                      {item.label === "Atendimento com IA" ? "IA" : item.label}
                    </span>
                    {isConversas && badge > 0 ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                          waitingCount > 0
                            ? "bg-warn text-[#1a1205]"
                            : "bg-white/15 text-white"
                        }`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                </div>
              );
            })}
            {isPlatformAdmin ? (
              <>
                <div className="my-2 border-t border-white/10" />
                <Link
                  href="/platform"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-accent transition hover:bg-[#1E293B]"
                >
                  <IconSettings className="size-[18px]" />
                  Workspace
                </Link>
              </>
            ) : null}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold">
                {initials(userName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {userName ?? "Usuário"}
                </p>
                <p className="truncate text-[11px] text-white/50">{roleLabel}</p>
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg px-2 py-2 text-left text-sm text-white/45 transition hover:text-white"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Link href="/app/conversations">
            <img src="/logo.png" alt="ViraChat" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            {tenantId ? (
              <div className="rounded-full bg-sidebar p-0.5">
                <NotificationBell
                  tenantId={tenantId}
                  initialItems={initialNotifications}
                />
              </div>
            ) : null}
            <form action={signOut}>
              <button type="submit" className="text-sm text-ink-muted">
                Sair
              </button>
            </form>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-3.8 2.8A.6.6 0 0 1 5.2 18.3V16H7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3.5 13.4 8.6 18.5 10 13.4 11.4 12 16.5 10.6 11.4 5.5 10l5.1-1.4L12 3.5Z" strokeLinejoin="round" />
      <path d="M18 15.5 18.6 17.4 20.5 18 18.6 18.6 18 20.5 17.4 18.6 15.5 18l1.9-.6.6-1.9Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.5l1.9 1.1M17.2 15.4l1.9 1.1M3.5 12h2.2M18.3 12h2.2M4.9 16.5l1.9-1.1M17.2 8.6l1.9-1.1" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" strokeLinecap="round" />
      <path d="M16 3.5a3.5 3.5 0 0 1 0 7M22 20c0-3.3-2.7-5.5-6-5.8" strokeLinecap="round" />
    </svg>
  );
}

function IconFunnel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 5h16l-5.5 7.2V18l-5 2v-7.8L4 5Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconChannel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M8 10.5c0-2.5 2-4.5 4.5-4.5h.5A4 4 0 0 1 17 10v1.5A3.5 3.5 0 0 1 13.5 15H12" strokeLinecap="round" />
      <path d="M8 14.5v3.2A1.3 1.3 0 0 0 9.3 19h1.4" strokeLinecap="round" />
      <circle cx="8" cy="12" r="2" />
    </svg>
  );
}
