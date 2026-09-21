"use client";

import { useActionState } from "react";
import {
  platformCreateTenant,
  platformInviteTenantUser,
  platformUpdateTenantBilling,
  platformUpdateTenantSeats,
  type PlatformState,
} from "@/app/actions/platform";

const initial: PlatformState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function CreateTenantPlatformForm() {
  const [state, action, pending] = useActionState(platformCreateTenant, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="name">
          Nome do tenant
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
        <label className="text-sm font-medium" htmlFor="maxMembers">
          Máx. colaboradores
        </label>
        <input
          id="maxMembers"
          name="maxMembers"
          type="number"
          min={1}
          max={500}
          defaultValue={2}
          className={field}
        />
        <p className="text-xs text-ink-muted">Padrão: 2 (empresa + 1).</p>
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
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar tenant"}
      </button>
    </form>
  );
}

export function InviteUserForm({
  tenants,
}: {
  tenants: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(
    platformInviteTenantUser,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="tenantId">
          Tenant
        </label>
        <select id="tenantId" name="tenantId" required className={field}>
          <option value="">Selecione…</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" required className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="fullName">
          Nome
        </label>
        <input id="fullName" name="fullName" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="role">
          Papel
        </label>
        <select id="role" name="role" defaultValue="admin" className={field}>
          <option value="admin">Administrador</option>
          <option value="supervisor">Supervisor</option>
          <option value="agent">Atendente</option>
        </select>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
      <button
        type="submit"
        disabled={pending || tenants.length === 0}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Convidando…" : "Convidar usuário"}
      </button>
    </form>
  );
}

export function TenantSeatsForm({
  tenants,
}: {
  tenants: {
    id: string;
    name: string;
    max_members: number;
    member_count: number;
  }[];
}) {
  const [state, action, pending] = useActionState(
    platformUpdateTenantSeats,
    initial,
  );

  return (
    <div className="space-y-4">
      {tenants.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum tenant.</p>
      ) : (
        tenants.map((t) => (
          <form
            key={t.id}
            action={action}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper px-3 py-3"
          >
            <input type="hidden" name="tenantId" value={t.id} />
            <div className="min-w-[140px] flex-1">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-ink-muted">{t.member_count} em uso</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-muted">
                Máx. assentos
              </label>
              <input
                name="maxMembers"
                type="number"
                min={1}
                max={500}
                defaultValue={t.max_members}
                className="w-24 rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              Salvar
            </button>
          </form>
        ))
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
    </div>
  );
}

export function TenantBillingForm({
  tenants,
}: {
  tenants: {
    id: string;
    name: string;
    monthly_fee_cents: number;
    billing_status: string;
  }[];
}) {
  const [state, action, pending] = useActionState(
    platformUpdateTenantBilling,
    initial,
  );

  return (
    <div className="space-y-3">
      {tenants.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhum cliente.</p>
      ) : (
        tenants.map((t) => (
          <form
            key={t.id}
            action={action}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper px-3 py-3"
          >
            <input type="hidden" name="tenantId" value={t.id} />
            <div className="min-w-[140px] flex-1">
              <p className="text-sm font-medium">{t.name}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-muted">
                R$ / mês
              </label>
              <input
                name="monthlyFee"
                type="number"
                min={0}
                step="0.01"
                defaultValue={(t.monthly_fee_cents / 100).toFixed(2)}
                className="w-28 rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-muted">Status</label>
              <select
                name="billingStatus"
                defaultValue={t.billing_status}
                className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
              >
                <option value="trial">Trial</option>
                <option value="active">Ativo</option>
                <option value="past_due">Inadimplente</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              Salvar
            </button>
          </form>
        ))
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
    </div>
  );
}
