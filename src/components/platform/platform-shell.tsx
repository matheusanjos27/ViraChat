"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/platform", label: "Visão geral", exact: true },
  { href: "/platform/health", label: "Saúde" },
  { href: "/platform/tenants", label: "Clientes" },
  { href: "/platform/contacts", label: "Contatos site" },
  { href: "/platform/plans", label: "Planos" },
  { href: "/platform/usage", label: "Uso de IA" },
  { href: "/platform/finance", label: "Finanças" },
  { href: "/platform/settings", label: "Configurações" },
  { href: "/platform/invites", label: "Convites" },
] as const;

export function PlatformShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-dvh bg-paper text-ink">
      <aside className="relative hidden w-[220px] shrink-0 flex-col bg-sidebar text-white md:flex">
        <div className="relative z-10 flex h-full flex-col px-3 py-4">
          <Link href="/platform" className="flex flex-col items-center px-1">
            <img
              src="/logo.png"
              alt="ViraChat"
              className="h-14 w-auto max-w-full object-contain"
            />
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
              Super admin
            </p>
          </Link>

          <nav className="mt-6 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const exact = "exact" in item && item.exact;
              const active = exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2.5 text-[14px] transition ${
                    active
                      ? "bg-[#134E4A] font-semibold text-white"
                      : "font-medium text-white/70 hover:bg-[#1E293B] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
            {userEmail ? (
              <p className="truncate px-2 text-xs text-white/50">{userEmail}</p>
            ) : null}
            <Link
              href="/app"
              className="block rounded-lg px-2 py-2 text-sm text-white/45 transition hover:text-white"
            >
              Ir ao app →
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-brand">
              Plataforma
            </p>
            <p className="text-sm font-semibold">Super admin</p>
          </div>
          <Link href="/app" className="text-sm font-medium text-brand">
            App
          </Link>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 md:hidden">
          {nav.map((item) => {
            const exact = "exact" in item && item.exact;
            const active = exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-brand text-white"
                    : "bg-paper text-ink-muted"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
