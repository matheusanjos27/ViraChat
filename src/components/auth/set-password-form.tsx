"use client";

import { useActionState } from "react";
import { setPassword, type AuthState } from "@/app/actions/auth";

const initial: AuthState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function SetPasswordForm() {
  const [state, action, pending] = useActionState(setPassword, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          className={field}
          placeholder="Mínimo 6 caracteres"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className="text-sm font-medium text-ink">
          Confirmar senha
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
          className={field}
          placeholder="Repita a senha"
        />
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
        {pending ? "Salvando…" : "Definir senha e entrar"}
      </button>
    </form>
  );
}
