import type { AiReplyUsage, PlanLimits } from "@/lib/plans/limits";

function formatLimit(n: number) {
  if (n <= 0) return "Ilimitado";
  return n.toLocaleString("pt-BR");
}

function UsageBar({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint?: string;
}) {
  const unlimited = limit <= 0;
  const pct = unlimited
    ? 0
    : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const atLimit = !unlimited && used >= limit;

  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p
          className={`text-sm tabular-nums font-semibold ${
            atLimit ? "text-danger" : "text-ink"
          }`}
        >
          {used.toLocaleString("pt-BR")}
          <span className="font-medium text-ink-muted">
            {" "}
            / {formatLimit(limit)}
          </span>
        </p>
      </div>
      {!unlimited ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-all ${
              atLimit ? "bg-danger" : pct >= 80 ? "bg-warn" : "bg-brand"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-ink-muted">Sem teto neste plano.</p>
      )}
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function PlanOverview({
  plan,
  membersUsed,
  channelsUsed,
  aiUsage,
}: {
  plan: PlanLimits;
  membersUsed: number;
  channelsUsed: number;
  aiUsage: AiReplyUsage;
}) {
  return (
    <section
      id="meu-plano"
      className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Meu plano
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">{plan.planName}</p>
          {plan.planDescription ? (
            <p className="mt-0.5 max-w-xl text-sm text-ink-muted">
              {plan.planDescription}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-muted">
              Direitos e consumo do workspace neste mês.
            </p>
          )}
          {plan.isCustom ? (
            <p className="mt-2 inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep">
              Plano personalizado
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <UsageBar
          label="Colaboradores"
          used={membersUsed}
          limit={plan.maxMembers}
          hint="Assentos da equipe (incluindo você)."
        />
        <UsageBar
          label="WhatsApps"
          used={channelsUsed}
          limit={plan.maxChannels}
          hint="Conectados e desconectados contam na cota."
        />
        <UsageBar
          label="Respostas da IA"
          used={aiUsage.used}
          limit={aiUsage.limit}
          hint="Contagem do mês corrente (UTC)."
        />
      </div>
    </section>
  );
}
