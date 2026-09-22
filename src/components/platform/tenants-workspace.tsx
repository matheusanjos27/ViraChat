"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  platformAssignTenantPlan,
  platformCancelInvite,
  platformCreateTenant,
  platformDeleteTenant,
  platformInviteTenantUser,
  platformUpdateTenantAiBudget,
  platformUpdateTenantBilling,
  type PlatformState,
} from "@/app/actions/platform";
import type { PlanRow } from "@/components/platform/plans-forms";
import type { TenantUsageSummary } from "@/lib/platform/tenant-summary";
import { formatTokenCount } from "@/lib/platform/usage";

const initial: PlatformState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export type TenantClientRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  plan_id: string | null;
  plan_name: string;
  is_custom_plan: boolean;
  max_members: number;
  max_channels: number;
  member_count: number;
  channel_count: number;
  monthly_fee_cents: number;
  billing_status: string;
  monthly_ai_token_limit: number;
  custom_max_members: number | null;
  custom_max_channels: number | null;
  custom_max_ai_replies_month: number | null;
  replies_month?: number;
  tokens_month?: number;
};

const statusLabel: Record<string, string> = {
  trial: "Trial",
  active: "Ativo",
  past_due: "Inadimplente",
  canceled: "Cancelado",
};

const statusTone: Record<string, string> = {
  trial: "bg-amber-50 text-amber-800",
  active: "bg-emerald-50 text-emerald-800",
  past_due: "bg-red-50 text-red-700",
  canceled: "bg-zinc-100 text-zinc-600",
};

export function TenantsListWorkspace({
  tenants,
  plans,
}: {
  tenants: TenantClientRow[];
  plans: PlanRow[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tenants;
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.slug.toLowerCase().includes(needle) ||
        t.plan_name.toLowerCase().includes(needle),
    );
  }, [tenants, q]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente…"
            className={field}
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          Adicionar cliente
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            {tenants.length === 0
              ? "Nenhum cliente ainda. Clique em Adicionar cliente."
              : "Nenhum resultado para a busca."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-paper/70 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Equipe</th>
                  <th className="px-4 py-3 font-medium">WhatsApp</th>
                  <th className="px-4 py-3 font-medium">IA / mês</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-paper/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{t.name}</p>
                      <p className="text-xs text-ink-muted">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-body">{t.plan_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusTone[t.billing_status] ??
                          "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {statusLabel[t.billing_status] ?? t.billing_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-body">
                      {t.member_count}/{t.max_members}
                    </td>
                    <td className="px-4 py-3 text-ink-body">
                      {t.channel_count}/{t.max_channels}
                    </td>
                    <td className="px-4 py-3 text-ink-body">
                      <p>{t.replies_month ?? 0} resp.</p>
                      <p className="text-xs text-ink-muted">
                        {formatTokenCount(t.tokens_month ?? 0)} tokens
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="inline-flex rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand"
                      >
                        Gerenciar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen ? (
        <CreateTenantModal
          plans={plans}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CreateTenantModal({
  plans,
  onClose,
}: {
  plans: PlanRow[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(platformCreateTenant, initial);
  const defaultPlan =
    plans.find((p) => p.slug === "basico")?.id ?? plans[0]?.id ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Novo cliente</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Cria a empresa com plano. Depois gerencie convites e limites na
              ficha.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:bg-paper"
          >
            Fechar
          </button>
        </div>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="name">
              Nome da empresa
            </label>
            <input id="name" name="name" required className={field} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="slug">
              Slug (opcional)
            </label>
            <input id="slug" name="slug" className={field} placeholder="acme" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="planId">
              Plano inicial
            </label>
            <select
              id="planId"
              name="planId"
              defaultValue={defaultPlan}
              className={field}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_custom ? " (personalizado)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="monthlyFee">
                Mensalidade (R$)
              </label>
              <input
                id="monthlyFee"
                name="monthlyFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={0}
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="billingStatus">
                Status cobrança
              </label>
              <select
                id="billingStatus"
                name="billingStatus"
                defaultValue="trial"
                className={field}
              >
                <option value="trial">Trial</option>
                <option value="active">Ativo</option>
                <option value="past_due">Inadimplente</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>
          </div>
          <input type="hidden" name="maxMembers" value={2} />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.success && (
            <p className="text-sm text-brand">{state.success}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? "Criando…" : "Criar cliente"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function TenantManagePanel({
  tenant,
  plans,
  summary,
  invites,
}: {
  tenant: TenantClientRow;
  plans: PlanRow[];
  summary: TenantUsageSummary;
  invites: {
    id: string;
    email: string;
    role: string;
    accepted_at: string | null;
    created_at: string;
  }[];
}) {
  return (
    <div className="mt-8 space-y-6">
      <SummaryGrid summary={summary} tenant={tenant} />

      <div className="grid gap-5 lg:grid-cols-2">
        <PlanSection tenant={tenant} plans={plans} />
        <BillingSection tenant={tenant} />
        <AiBudgetSection tenant={tenant} />
        <InviteSection tenantId={tenant.id} tenantName={tenant.name} />
      </div>

      <InvitesListSection invites={invites} />
      <DeleteSection tenant={tenant} />
    </div>
  );
}

function SummaryGrid({
  summary,
  tenant,
}: {
  summary: TenantUsageSummary;
  tenant: TenantClientRow;
}) {
  const cards = [
    {
      label: "Respostas IA (mês)",
      value: String(summary.repliesMonth),
      hint: `${summary.repliesAll} no total`,
    },
    {
      label: "Tokens (mês)",
      value: formatTokenCount(summary.tokensMonth),
      hint: `${formatTokenCount(summary.tokensAll)} no total`,
    },
    {
      label: "Média tokens / resposta",
      value:
        summary.avgTokensPerReplyMonth > 0
          ? formatTokenCount(summary.avgTokensPerReplyMonth)
          : "—",
      hint: "mês atual",
    },
    {
      label: "Custo est. IA (mês)",
      value: `US$ ${summary.estimatedUsdMonth.toFixed(2)}`,
      hint: "estimativa gpt-4o-mini",
    },
    {
      label: "Msgs IA enviadas (mês)",
      value: String(summary.aiOutboundMessagesMonth),
      hint: `${summary.inboundMessagesMonth} inbound`,
    },
    {
      label: "Conversas",
      value: String(summary.conversationsOpen),
      hint: `${summary.conversationsAll} no total · ${summary.contacts} leads`,
    },
    {
      label: "Mensalidade",
      value: formatBrlFromCents(tenant.monthly_fee_cents),
      hint: statusLabel[tenant.billing_status] ?? tenant.billing_status,
    },
    {
      label: "Cota tokens",
      value:
        tenant.monthly_ai_token_limit === 0
          ? "Ilimitado"
          : formatTokenCount(tenant.monthly_ai_token_limit),
      hint: "limite mensal",
    },
  ];

  return (
    <section>
      <h2 className="text-lg font-semibold">Resumo</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Uso deste cliente no mês atual e totais acumulados.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {c.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{c.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanSection({
  tenant,
  plans,
}: {
  tenant: TenantClientRow;
  plans: PlanRow[];
}) {
  const [state, action, pending] = useActionState(
    platformAssignTenantPlan,
    initial,
  );
  const [planId, setPlanId] = useState(
    tenant.plan_id ?? plans.find((p) => p.slug === "basico")?.id ?? "",
  );
  const customPlanId = useMemo(
    () => plans.find((p) => p.is_custom)?.id ?? "",
    [plans],
  );
  const isCustom = planId === customPlanId;

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="tenantId" value={tenant.id} />
      <h3 className="text-sm font-semibold text-ink">Plano</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        Troca o teto deste cliente. O catálogo fica em Planos.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className={isCustom ? "" : "sm:col-span-2"}>
          <label className="text-xs font-medium text-ink-muted">Plano</label>
          <select
            name="planId"
            className={`${field} mt-1`}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {isCustom ? (
          <>
            <div>
              <label className="text-xs font-medium text-ink-muted">Equipe</label>
              <input
                name="customMaxMembers"
                type="number"
                min={1}
                defaultValue={tenant.custom_max_members ?? 10}
                className={`${field} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">
                WhatsApps
              </label>
              <input
                name="customMaxChannels"
                type="number"
                min={1}
                defaultValue={tenant.custom_max_channels ?? 10}
                className={`${field} mt-1`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-ink-muted">
                Respostas IA / mês
              </label>
              <input
                name="customMaxAiReplies"
                type="number"
                min={0}
                defaultValue={tenant.custom_max_ai_replies_month ?? 5000}
                className={`${field} mt-1`}
              />
            </div>
          </>
        ) : null}
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="mt-2 text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Aplicando…" : "Salvar plano"}
      </button>
    </form>
  );
}

function InviteSection({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const [state, action, pending] = useActionState(
    platformInviteTenantUser,
    initial,
  );

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="tenantId" value={tenantId} />
      <h3 className="text-sm font-semibold text-ink">Convidar usuário</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        Para {tenantName}. Senha provisória = entra sem e-mail.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-ink-muted">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className={`${field} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">Nome</label>
          <input name="fullName" className={`${field} mt-1`} />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">Papel</label>
          <select name="role" defaultValue="admin" className={`${field} mt-1`}>
            <option value="admin">Administrador</option>
            <option value="supervisor">Supervisor</option>
            <option value="agent">Atendente</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">
            Senha provisória
          </label>
          <input
            name="password"
            type="text"
            minLength={6}
            autoComplete="off"
            placeholder="mín. 6"
            className={`${field} mt-1`}
          />
        </div>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="mt-2 text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Convidando…" : "Convidar"}
      </button>
    </form>
  );
}

function InvitesListSection({
  invites,
}: {
  invites: {
    id: string;
    email: string;
    role: string;
    accepted_at: string | null;
    created_at: string;
  }[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <h3 className="text-sm font-semibold text-ink">Convites deste cliente</h3>
      {invites.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Nenhum convite ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{inv.email}</p>
                <p className="text-xs text-ink-muted">
                  {inv.role} · {inv.accepted_at ? "Aceito" : "Pendente"} ·{" "}
                  {new Date(inv.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {!inv.accepted_at ? (
                <CancelInviteInline inviteId={inv.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CancelInviteInline({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(
    platformCancelInvite,
    initial,
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Removendo…" : "Cancelar"}
      </button>
      {state.error ? (
        <p className="max-w-[140px] text-right text-[11px] text-red-600">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function BillingSection({ tenant }: { tenant: TenantClientRow }) {
  const [state, action, pending] = useActionState(
    platformUpdateTenantBilling,
    initial,
  );

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="tenantId" value={tenant.id} />
      <h3 className="text-sm font-semibold text-ink">Cobrança</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-ink-muted">R$ / mês</label>
          <input
            name="monthlyFee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={(tenant.monthly_fee_cents / 100).toFixed(2)}
            className={`${field} mt-1`}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">Status</label>
          <select
            name="billingStatus"
            defaultValue={tenant.billing_status}
            className={`${field} mt-1`}
          >
            <option value="trial">Trial</option>
            <option value="active">Ativo</option>
            <option value="past_due">Inadimplente</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="mt-2 text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar cobrança"}
      </button>
    </form>
  );
}

function AiBudgetSection({ tenant }: { tenant: TenantClientRow }) {
  const [state, action, pending] = useActionState(
    platformUpdateTenantAiBudget,
    initial,
  );

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <input type="hidden" name="tenantId" value={tenant.id} />
      <h3 className="text-sm font-semibold text-ink">Cota de tokens IA</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        0 = ilimitado. Histórico de mensagens é global em Configurações.
      </p>
      <div className="mt-3 max-w-xs">
        <label className="text-xs font-medium text-ink-muted">
          Milhões / mês
        </label>
        <input
          name="tokenLimitMillions"
          type="number"
          min={0}
          step={0.5}
          defaultValue={
            tenant.monthly_ai_token_limit === 0
              ? 0
              : tenant.monthly_ai_token_limit / 1_000_000
          }
          className={`${field} mt-1`}
          title="0 = ilimitado"
        />
      </div>
      {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="mt-2 text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar cota"}
      </button>
    </form>
  );
}

function DeleteSection({ tenant }: { tenant: TenantClientRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    platformDeleteTenant,
    initial,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (state.success) {
      router.push("/platform/tenants");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className="rounded-2xl border border-danger/30 bg-red-50/50 p-5">
      <h3 className="text-sm font-semibold text-danger">Zona de perigo</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Apaga a empresa e <strong>todos</strong> os dados: conversas, leads,
        canais WhatsApp, equipe, IA, anexos. Não dá pra desfazer.
      </p>
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-3 rounded-lg border border-danger/40 bg-surface px-3 py-2 text-xs font-semibold text-danger hover:bg-red-50"
        >
          Excluir cliente…
        </button>
      ) : (
        <form action={action} className="mt-3 space-y-3">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <div>
            <label className="text-xs font-medium text-ink-muted">
              Digite <span className="font-semibold text-ink">{tenant.name}</span>{" "}
              para confirmar
            </label>
            <input
              name="confirmName"
              required
              autoComplete="off"
              className={`${field} mt-1`}
              placeholder={tenant.name}
            />
          </div>
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Apagando…" : "Apagar definitivamente"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
