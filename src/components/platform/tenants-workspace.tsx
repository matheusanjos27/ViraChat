"use client";

import { useActionState, useMemo, useState } from "react";
import {
  platformAssignTenantPlan,
  platformCreateTenant,
  platformDeleteTenant,
  platformInviteTenantUser,
  platformUpdateTenantAiBudget,
  platformUpdateTenantBilling,
  type PlatformState,
} from "@/app/actions/platform";
import type { PlanRow } from "@/components/platform/plans-forms";

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
  ai_history_turns: number;
  custom_max_members: number | null;
  custom_max_channels: number | null;
  custom_max_ai_replies_month: number | null;
};

const statusLabel: Record<string, string> = {
  trial: "Trial",
  active: "Ativo",
  past_due: "Inadimplente",
  canceled: "Cancelado",
};

export function TenantsWorkspace({
  tenants,
  plans,
}: {
  tenants: TenantClientRow[];
  plans: PlanRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(
    tenants[0]?.id ?? null,
  );

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Novo cliente</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Cria a empresa já com plano. Depois convide o admin na ficha.
        </p>
        <div className="mt-4">
          <CreateTenantForm plans={plans} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Clientes</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Plano, convite, cobrança e exclusão — tudo na ficha do cliente.
          </p>
        </div>

        {tenants.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-sm text-ink-muted shadow-[var(--shadow)]">
            Nenhum cliente ainda.
          </p>
        ) : (
          tenants.map((t) => (
            <TenantCard
              key={t.id}
              tenant={t}
              plans={plans}
              open={openId === t.id}
              onToggle={() =>
                setOpenId((cur) => (cur === t.id ? null : t.id))
              }
            />
          ))
        )}
      </section>
    </div>
  );
}

function CreateTenantForm({ plans }: { plans: PlanRow[] }) {
  const [state, action, pending] = useActionState(platformCreateTenant, initial);
  const defaultPlan =
    plans.find((p) => p.slug === "basico")?.id ?? plans[0]?.id ?? "";

  return (
    <form action={action} className="flex flex-col gap-3">
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
      <input type="hidden" name="maxMembers" value={2} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar cliente"}
      </button>
    </form>
  );
}

function TenantCard({
  tenant,
  plans,
  open,
  onToggle,
}: {
  tenant: TenantClientRow;
  plans: PlanRow[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-paper/60"
      >
        <div className="min-w-0">
          <p className="font-semibold text-ink">{tenant.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {tenant.slug} · {tenant.plan_name} ·{" "}
            {statusLabel[tenant.billing_status] ?? tenant.billing_status}
          </p>
          <p className="mt-2 text-xs text-ink-body">
            {tenant.member_count}/{tenant.max_members} assentos ·{" "}
            {tenant.channel_count}/{tenant.max_channels} WhatsApps ·{" "}
            {formatBrlFromCents(tenant.monthly_fee_cents)}/mês
          </p>
        </div>
        <span className="shrink-0 text-sm text-ink-muted">
          {open ? "Fechar" : "Gerenciar"}
        </span>
      </button>

      {open ? (
        <div className="space-y-5 border-t border-line bg-paper/40 px-5 py-5">
          <PlanSection tenant={tenant} plans={plans} />
          <InviteSection tenantId={tenant.id} tenantName={tenant.name} />
          <BillingSection tenant={tenant} />
          <AiBudgetSection tenant={tenant} />
          <DeleteSection tenant={tenant} />
        </div>
      ) : null}
    </article>
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
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="tenantId" value={tenant.id} />
      <h3 className="text-sm font-semibold text-ink">Plano</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        Troca o teto deste cliente. O catálogo de planos fica em Planos.
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
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
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

function BillingSection({ tenant }: { tenant: TenantClientRow }) {
  const [state, action, pending] = useActionState(
    platformUpdateTenantBilling,
    initial,
  );

  return (
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
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
    <form action={action} className="rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="tenantId" value={tenant.id} />
      <h3 className="text-sm font-semibold text-ink">Configuração da IA</h3>
      <p className="mt-0.5 text-xs text-ink-muted">
        Cota de tokens e quantas mensagens a IA lembra na conversa.
      </p>
      <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-ink-muted">
            Cota (milhões / mês)
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
          <p className="mt-1 text-[11px] text-ink-muted">0 = ilimitado</p>
        </div>
        <div>
          <label className="text-xs font-medium text-ink-muted">
            Histórico (mensagens)
          </label>
          <input
            name="aiHistoryTurns"
            type="number"
            min={4}
            max={40}
            step={1}
            defaultValue={tenant.ai_history_turns ?? 24}
            className={`${field} mt-1`}
          />
          <p className="mt-1 text-[11px] text-ink-muted">Entre 4 e 40 (padrão 24)</p>
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
        {pending ? "Salvando…" : "Salvar IA"}
      </button>
    </form>
  );
}

function DeleteSection({ tenant }: { tenant: TenantClientRow }) {
  const [state, action, pending] = useActionState(
    platformDeleteTenant,
    initial,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="rounded-xl border border-danger/30 bg-red-50/50 p-4">
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
          {state.success && (
            <p className="text-sm text-brand">{state.success}</p>
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
