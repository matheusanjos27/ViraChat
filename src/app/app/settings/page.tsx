import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");

  const tenantId = membership.tenant_id;

  const [
    { data: tenant },
    { count: memberCount },
    { count: adminCount },
    { data: aiConfig },
    { count: channelCount },
    { count: stageCount },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, about, phone, website, updated_at, created_at")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("user_tenant_roles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("user_tenant_roles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("role", "admin"),
    supabase
      .from("ai_configs")
      .select("is_enabled, name, updated_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase
      .from("channels")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("deal_stages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const workspaceName = tenant?.name ?? "Workspace";
  const members = memberCount ?? 0;
  const admins = adminCount ?? 0;
  const channels = channelCount ?? 0;
  const stages = stageCount ?? 0;
  const aiOn = aiConfig?.is_enabled ?? false;
  const planLabel = "Starter";

  const cards = [
    {
      href: "/app/settings/company",
      icon: "company" as const,
      title: "Empresa",
      badge: null as string | null,
      badgeTone: "neutral" as const,
      points: ["Nome e descrição", "Logo e telefone", "Contatos da empresa"],
      footer: formatUpdated(tenant?.updated_at ?? tenant?.created_at),
    },
    {
      href: "/app/settings/ai",
      icon: "ai" as const,
      title: "IA",
      badge: aiOn ? "IA ativa" : "IA pausada",
      badgeTone: aiOn ? ("success" as const) : ("muted" as const),
      points: ["Assistente e prompt", "Playbook", "Campos e produtos"],
      footer: formatUpdated(aiConfig?.updated_at ?? null),
    },
    {
      href: "/app/settings/team",
      icon: "team" as const,
      title: "Equipe",
      badge: `${members} usuário${members === 1 ? "" : "s"}`,
      badgeTone: "info" as const,
      points: [
        `${members} membro${members === 1 ? "" : "s"}`,
        `${admins} administrador${admins === 1 ? "" : "es"}`,
        "Convites e permissões",
      ],
      footer: "Gerenciar acesso",
    },
    {
      href: "/app/channels",
      icon: "channels" as const,
      title: "Canais",
      badge: `${channels} conectado${channels === 1 ? "" : "s"}`,
      badgeTone: channels > 0 ? ("success" as const) : ("muted" as const),
      points: ["WhatsApp (QR)", "Instagram (em breve)", "Messenger (em breve)"],
      footer: channels > 0 ? "Canais ativos" : "Conectar número",
    },
    {
      href: "/app/settings/pipeline",
      icon: "pipeline" as const,
      title: "Funil",
      badge: `${stages} etapa${stages === 1 ? "" : "s"}`,
      badgeTone: "info" as const,
      points: ["Etapas do pipeline", "Kanban de deals", "Fechado / perdido"],
      footer: "Abrir pipeline",
    },
    {
      href: "/app/settings/help",
      icon: "help" as const,
      title: "Ajuda",
      badge: "Roteiro",
      badgeTone: "info" as const,
      points: [
        "Passo a passo por tema",
        "Atendimento e IA",
        "Equipe e WhatsApp",
      ],
      footer: "Como usar o sistema",
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="px-5 py-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Link href="/app" className="hover:text-ink">
            App
          </Link>
          <span className="text-line">/</span>
          <span className="font-medium text-ink">Configurações</span>
          <span className="mx-1 hidden h-px w-8 bg-line sm:block" />
          <span className="hidden text-ink-placeholder sm:inline">
            Empresa · IA · Equipe
          </span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Configurações
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Gerencie sua empresa, IA, equipe e canais.
            </p>
          </div>
          <p className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-body">
            Workspace {workspaceName}
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Workspace
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {workspaceName}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">Plano {planLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatChip
                label="IA"
                value={aiOn ? "Ativa" : "Pausada"}
                tone={aiOn ? "success" : "muted"}
              />
              <StatChip
                label="Canal"
                value={`${channels} conectado${channels === 1 ? "" : "s"}`}
                tone={channels > 0 ? "success" : "muted"}
              />
              <StatChip
                label="Equipe"
                value={`${members} usuário${members === 1 ? "" : "s"}`}
                tone="info"
              />
              <StatChip label="Plano" value={planLabel} tone="neutral" />
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] transition duration-200 hover:-translate-y-[3px] hover:border-brand hover:shadow-[0_12px_32px_rgba(15,118,110,0.12)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <SettingsCardIcon name={c.icon} />
                </span>
                {c.badge ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      c.badgeTone === "success"
                        ? "bg-brand-soft text-brand-deep"
                        : c.badgeTone === "info"
                          ? "bg-[#e0f2fe] text-info"
                          : "bg-paper text-ink-muted"
                    }`}
                  >
                    {c.badge}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-4 text-lg font-semibold text-ink group-hover:text-brand">
                {c.title}
              </h2>
              <ul className="mt-2 space-y-1">
                {c.points.map((p) => (
                  <li key={p} className="text-sm text-ink-muted">
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 mt-5">
                <p className="text-[11px] text-ink-placeholder">{c.footer}</p>
                <span className="text-sm font-semibold text-brand">
                  Abrir
                  <span aria-hidden className="ml-1 inline-block transition group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsCardIcon({
  name,
}: {
  name: "company" | "ai" | "team" | "channels" | "pipeline" | "help";
}) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "company":
      return (
        <svg {...common}>
          <path d="M4 20V8.5L12 4l8 4.5V20" />
          <path d="M9 20v-6h6v6" />
          <path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01M9 14h.01M15 14h.01" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <rect x="5" y="7" width="14" height="11" rx="3" />
          <path d="M9 11.5h.01M15 11.5h.01M9.5 15c.8.8 1.7 1.2 2.5 1.2s1.7-.4 2.5-1.2" />
          <path d="M12 7V4M8 4h8" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4.5 18c.6-2.4 2.4-3.8 4.5-3.8s3.9 1.4 4.5 3.8" />
          <path d="M13.5 18c.4-1.6 1.5-2.7 3-2.7 1.3 0 2.3.8 2.8 2.1" />
        </svg>
      );
    case "channels":
      return (
        <svg {...common}>
          <path d="M6.5 6.5h11A2.5 2.5 0 0 1 20 9v7a2.5 2.5 0 0 1-2.5 2.5h-5.2L8 21.2V18.5H6.5A2.5 2.5 0 0 1 4 16V9a2.5 2.5 0 0 1 2.5-2.5Z" />
          <path d="M8.5 11.5h7M8.5 14.5h4.5" />
        </svg>
      );
    case "pipeline":
      return (
        <svg {...common}>
          <path d="M4 16.5 9 11l3.5 3.5L20 7" />
          <path d="M15 7h5v5" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.8 9.6a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.2.9-1.2 1.7V14" />
          <path d="M12 17h.01" />
        </svg>
      );
  }
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "info" | "muted" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-placeholder">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          tone === "success"
            ? "text-brand-deep"
            : tone === "info"
              ? "text-info"
              : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatUpdated(iso: string | null | undefined) {
  if (!iso) return "Sem alterações recentes";
  const d = new Date(iso);
  return `Atualizado ${d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  })}`;
}
