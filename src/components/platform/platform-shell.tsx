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
    <div className="flex min-h-dvh bg-[#eef1f0] text-ink">
      <aside className="relative hidden w-[260px] shrink-0 flex-col bg-[#0b2f2a] text-white md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(201,242,166,0.16), transparent 42%), linear-gradient(180deg, #0d3a33 0%, #0b2f2a 55%, #082421 100%)",
          }}
        />
        <div className="relative z-10 flex h-full flex-col px-4 py-5">
          <Link href="/platform" className="px-1">
            <img src="/logo.png" alt="ViraChat" className="h-14 w-auto" />
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
              Super admin
            </p>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
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
                  className={`rounded-xl px-3.5 py-2.5 text-[15px] transition ${
                    active
                      ? "bg-[#0f6b5c] font-semibold text-white"
                      : "font-medium text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
            {userEmail ? (
              <p className="truncate px-1 text-xs text-white/50">{userEmail}</p>
            ) : null}
            <Link
              href="/app"
              className="block rounded-lg px-2 py-2 text-sm text-white/55 transition hover:text-white"
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
          <Link href="/app" className="text-sm text-brand">
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
                    ? "bg-[#0c6b5c] text-white"
                    : "bg-[#eef3f1] text-ink-muted"
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
