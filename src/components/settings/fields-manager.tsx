"use client";

import { useActionState } from "react";
import {
  createContactAttribute,
  deleteContactAttribute,
  type CrmState,
} from "@/app/actions/crm";

const empty: CrmState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

type Attr = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  collect_via_ai: boolean;
  sort_order: number;
};

const TYPE_ICON: Record<string, string> = {
  text: "Aa",
  number: "#",
  email: "@",
  phone: "Tel",
  date: "Data",
  select: "Lista",
};

export function FieldsManager({ attributes }: { attributes: Attr[] }) {
  const [createState, createAction, createPending] = useActionState(
    createContactAttribute,
    empty,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteContactAttribute,
    empty,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
      <form
        action={createAction}
        className="flex h-fit flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] lg:sticky lg:top-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-ink">Novo campo</h2>
          <p className="mt-1 text-sm text-ink-muted">
            O que a IA deve coletar na conversa.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Nome</label>
          <input name="label" required placeholder="Ex: Empresa" className={`${field} mt-1`} />
        </div>
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select name="type" className={`${field} mt-1`} defaultValue="text">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
            <option value="date">Data</option>
            <option value="select">Seleção</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">
            Opções <span className="font-normal text-ink-muted">(seleção)</span>
          </label>
          <input
            name="options"
            placeholder="A, B, C"
            className={`${field} mt-1`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required" className="size-4 accent-[var(--brand)]" />
          Obrigatório
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="collectViaAi"
            defaultChecked
            className="size-4 accent-[var(--brand)]"
          />
          IA coleta
        </label>
        {createState.error ? (
          <p className="text-sm text-danger">{createState.error}</p>
        ) : null}
        {createState.success ? (
          <p className="text-sm text-brand">{createState.success}</p>
        ) : null}
        <button
          type="submit"
          disabled={createPending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {createPending ? "…" : "Adicionar"}
        </button>
      </form>

      <div>
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold text-ink">Campos cadastrados</h2>
            <p className="text-sm text-ink-muted">
              {attributes.length} campo{attributes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {attributes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-ink-muted">
            Nenhum campo ainda. Crie o primeiro à esquerda.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {attributes.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xs font-bold text-brand-deep">
                    {TYPE_ICON[a.type] ?? "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{a.label}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {a.type}
                      {a.required ? " · Obrigatório" : ""}
                      {a.collect_via_ai ? " · IA" : ""}
                    </p>
                    <code className="mt-2 inline-block rounded bg-paper px-1.5 py-0.5 text-[10px] text-ink-muted">
                      {a.key}
                    </code>
                  </div>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button
                      type="submit"
                      disabled={deletePending}
                      className="text-xs text-ink-muted hover:text-danger"
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {deleteState.error ? (
          <p className="mt-3 text-sm text-danger">{deleteState.error}</p>
        ) : null}
      </div>
    </div>
  );
}
