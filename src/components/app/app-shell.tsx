"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const nav = [
  { href: "/app/conversations", label: "Conversas" },
  { href: "/app/channels", label: "Canais" },
  { href: "/app/ai", label: "IA" },
  { href: "/app", label: "Empresa", exact: true },
];

export function AppShell({
  children,
  tenantName,
  userName,
}: {
  children: React.ReactNode;
  tenantName?: string;
  userName?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <aside className="relative hidden w-[240px] shrink-0 flex-col bg-brand-deep text-white md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, rgba(201,242,166,0.35), transparent 45%), radial-gradient(circle at 80% 100%, rgba(255,255,255,0.08), transparent 40%)",
          }}
        />
        <div className="relative z-10 flex h-full flex-col px-5 py-6">
          <Link
            href="/app/conversations"
            className="brand-mark text-[1.75rem] leading-none"
          >
            ViraChat
          </Link>
          <p className="mt-2 text-xs text-white/55">
            {tenantName ?? "Sua operação"}
          </p>

          <nav className="mt-10 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-white/12 font-semibold text-white"
                      : "text-white/70 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 pt-4">
            <p className="truncate text-sm text-white/85">
              {userName ?? "Usuário"}
            </p>
            <form action={signOut} className="mt-2">
              <button
                type="submit"
                className="text-xs text-white/55 transition hover:text-white"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <Link
            href="/app/conversations"
            className="brand-mark text-xl text-brand-deep"
          >
            ViraChat
          </Link>
          <div className="flex gap-3 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  (item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href))
                    ? "font-semibold text-brand"
                    : "text-ink-muted"
                }
              >
                {item.label.split(" ")[0]}
              </Link>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
