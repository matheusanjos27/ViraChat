"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const nav = [
  {
    href: "/app/conversations",
    label: "Conversas",
    icon: IconChat,
  },
  { href: "/app/leads", label: "Leads", icon: IconUsers },
  { href: "/app/channels", label: "Canais", icon: IconChannels },
  { href: "/app/ai", label: "IA", icon: IconSpark },
  { href: "/app", label: "Empresa", icon: IconBuilding, exact: true },
  {
    href: "/app/conversations",
    label: "Relatórios",
    icon: IconChart,
    soon: true,
  },
  {
    href: "/app",
    label: "Configurações",
    icon: IconSettings,
    soon: true,
  },
] as const;

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function AppShell({
  children,
  tenantName,
  userName,
  userRole,
  isPlatformAdmin,
  openCount = 0,
}: {
  children: React.ReactNode;
  tenantName?: string;
  userName?: string;
  userRole?: string;
  isPlatformAdmin?: boolean;
  openCount?: number;
}) {
  const pathname = usePathname();
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

  return (
    <div className="flex h-dvh overflow-hidden bg-[#eef1f0] text-ink">
      <aside className="relative hidden w-[270px] shrink-0 flex-col bg-[#0b2f2a] text-white md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(201,242,166,0.18), transparent 42%), linear-gradient(180deg, #0d3a33 0%, #0b2f2a 55%, #082421 100%)",
          }}
        />
        <div className="relative z-10 flex h-full flex-col px-4 py-5">
          <Link href="/app/conversations" className="block px-1">
            <img
              src="/logo.png"
              alt="ViraChat"
              className="h-20 w-auto"
            />
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-0.5">
            {nav.map((item) => {
              const active = "exact" in item && item.exact
                ? pathname === item.href
                : item.href !== "/app" && pathname.startsWith(item.href);
              const isConversas = item.label === "Conversas";
              const Icon = item.icon;
              if ("soon" in item && item.soon) {
                return (
                  <span
                    key={item.label}
                    className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/35"
                    title="Em breve"
                  >
                    <Icon className="size-[18px] opacity-70" />
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-[#0f6b5c] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <Icon className="size-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {isConversas && openCount > 0 ? (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                      {openCount > 99 ? "99+" : openCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            {isPlatformAdmin ? (
              <Link
                href="/platform"
                className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-accent/90 transition hover:bg-white/8"
              >
                <IconSettings className="size-[18px]" />
                Plataforma
              </Link>
            ) : null}
          </nav>

          <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 rounded-xl px-1 py-1">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1a6b5c] text-xs font-semibold">
                {initials(userName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {userName ?? "Usuário"}
                </p>
                <p className="truncate text-[11px] text-white/50">{roleLabel}</p>
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-white/45 transition hover:text-white"
              >
                Sair
              </button>
            </form>
            <p className="px-1 text-[10px] text-white/30">ViraChat v1.0.0</p>
            {tenantName ? (
              <p className="truncate px-1 text-[10px] text-white/25">
                {tenantName}
              </p>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <Link href="/app/conversations">
            <img src="/logo.png" alt="ViraChat" className="h-8 w-auto" />
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-ink-muted">
              Sair
            </button>
          </form>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function IconLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "size-5"}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.2 3.15A.75.75 0 0 1 4.5 18.5V16h-.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-3.8 2.8A.6.6 0 0 1 5.2 18.3V16H7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChannels({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" />
      <path d="M8 9h8M8 12h5" strokeLinecap="round" />
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

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 20h16M6 20V7.5A1.5 1.5 0 0 1 7.5 6H12v14M12 20V4.5A1.5 1.5 0 0 1 13.5 3H16.5A1.5 1.5 0 0 1 18 4.5V20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9h.01M9 12h.01M15 8h.01M15 11h.01M15 14h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 19h16M7 16V10M12 16V7M17 16v-4" strokeLinecap="round" />
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
