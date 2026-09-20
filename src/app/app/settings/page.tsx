import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const cards = [
  {
    href: "/app/settings/company",
    title: "Empresa",
    desc: "Nome, descrição e contatos — a IA usa isso para se apresentar no WhatsApp.",
  },
  {
    href: "/app/settings/ai",
    title: "Atendimento com IA",
    desc: "Ligar o automático, nome do assistente e o roteiro completo da conversa.",
  },
  {
    href: "/app/settings/fields",
    title: "Campos do lead",
    desc: "O que a IA coleta: empresa, porte, setor — o que fizer sentido para você.",
  },
  {
    href: "/app/settings/pipeline",
    title: "Funil de vendas",
    desc: "Etapas do pipeline. Arraste deals no kanban conforme a negociação avança.",
  },
  {
    href: "/app/settings/services",
    title: "Catálogo e preços",
    desc: "Serviços com preço fixo, por unidade ou por faixas.",
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
          Empresa e IA no centro. O resto alimenta o CRM e o orçamento.
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
