"use client";

import { useActionState } from "react";
import { createTenant, type TenantState } from "@/app/actions/tenant";

const initial: TenantState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function CreateTenantForm() {
  const [state, action, pending] = useActionState(createTenant, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Nome da empresa
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Acme Comércio"
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-ink">
          Identificador (opcional)
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          placeholder="acme"
          className={field}
        />
        <p className="text-xs text-ink-muted">
          Gerado automaticamente a partir do nome se vazio.
        </p>
      </div>
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar empresa"}
      </button>
    </form>
  );
}
