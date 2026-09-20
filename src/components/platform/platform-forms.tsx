"use client";

import { useActionState } from "react";
import {
  platformCreateTenant,
  platformInviteTenantUser,
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
        <input
          id="email"
          name="email"
          type="email"
          required
          className={field}
        />
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
