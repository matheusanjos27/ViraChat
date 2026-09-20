"use client";

import { useActionState } from "react";
import { updateCompanyProfile, type CompanyState } from "@/app/actions/company";

const empty: CompanyState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function CompanyForm({
  name,
  about,
  phone,
  website,
  slug,
}: {
  name: string;
  about: string | null;
  phone: string | null;
  website: string | null;
  slug: string;
}) {
  const [state, action, pending] = useActionState(updateCompanyProfile, empty);

  return (
    <form
      action={action}
      className="flex max-w-xl flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]"
    >
      <div>
        <label className="text-sm font-medium">Nome da empresa</label>
        <input
          name="name"
          required
          defaultValue={name}
          className={`${field} mt-1`}
          placeholder="Como aparece no atendimento"
        />
        <p className="mt-1 text-xs text-ink-muted">Slug interno: {slug}</p>
      </div>
      <div>
        <label className="text-sm font-medium">Sobre a empresa</label>
        <textarea
          name="about"
          rows={5}
          defaultValue={about ?? ""}
          className={`${field} mt-1`}
          placeholder="O que vocês fazem, para quem, diferenciais. A IA usa isso na abertura e no diagnóstico."
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Telefone</label>
          <input
            name="phone"
            defaultValue={phone ?? ""}
            className={`${field} mt-1`}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Site</label>
          <input
            name="website"
            defaultValue={website ?? ""}
            className={`${field} mt-1`}
            placeholder="https://"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar empresa"}
      </button>
    </form>
  );
}
