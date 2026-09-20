import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const cards = [
  {
    href: "/app/settings/fields",
    title: "Campos do lead",
    desc: "Defina o que a IA coleta: empresa, CNPJ, porte, setor — o que fizer sentido para o seu negócio.",
  },
  {
    href: "/app/settings/pipeline",
    title: "Funil de vendas",
    desc: "Etapas do pipeline comercial. Arraste deals no kanban conforme a negociação avança.",
  },
  {
    href: "/app/ai",
    title: "Assistente IA",
    desc: "Instruções, tom de voz e quando transferir para humano.",
  },
  {
    href: "/app/channels",
    title: "Canais WhatsApp",
    desc: "Conecte e gerencie números oficiais da Cloud API.",
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="px-6 py-8">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Configurações
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Preferências
        </h1>
        <p className="mt-2 text-ink-muted">
          Tudo genérico — cada empresa configura o próprio CRM.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] transition hover:-translate-y-0.5"
            >
              <p className="text-lg font-semibold group-hover:text-brand">
                {c.title}
              </p>
              <p className="mt-2 text-sm text-ink-muted">{c.desc}</p>
              <p className="mt-4 text-sm font-medium text-brand">Abrir →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
