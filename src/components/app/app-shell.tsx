"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const nav = [
  { href: "/app/conversations", label: "Conversas", icon: IconChat },
  { href: "/app/leads", label: "Leads", icon: IconUsers },
  { href: "/app/deals", label: "Funil", icon: IconFunnel },
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
      <aside className="relative hidden w-[280px] shrink-0 flex-col bg-[#0b2f2a] text-white md:flex">
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
            <img src="/logo.png" alt="ViraChat" className="h-20 w-auto" />
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1.5">
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
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] transition ${
                    active
                      ? "bg-[#0f6b5c] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                      : "font-medium text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="size-5 shrink-0 opacity-90" />
                  <span className="flex-1 leading-snug tracking-tight">
                    {item.label}
                  </span>
                  {isConversas && openCount > 0 ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                      {openCount > 99 ? "99+" : openCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            {isPlatformAdmin ? (
              <Link
                href="/platform"
                className="mt-3 flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] font-medium text-accent transition hover:bg-white/10"
              >
                <IconSettings className="size-5" />
                Plataforma
              </Link>
            ) : null}
          </nav>

          <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
            {tenantName ? (
              <p className="truncate px-1 text-xs font-medium text-white/55">
                {tenantName}
              </p>
            ) : null}
            <div className="flex items-center gap-3 rounded-xl px-1 py-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1a6b5c] text-sm font-semibold">
                {initials(userName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">
                  {userName ?? "Usuário"}
                </p>
                <p className="truncate text-xs text-white/50">{roleLabel}</p>
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full rounded-lg px-2 py-2 text-left text-sm text-white/50 transition hover:text-white"
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
