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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <form
        action={createAction}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]"
      >
        <div>
          <h2 className="text-lg font-semibold">Novo campo</h2>
          <p className="mt-1 text-sm text-ink-muted">
            A IA coleta esses dados durante a conversa — sem parecer formulário.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Nome</label>
          <input name="label" required placeholder="Ex: CNPJ" className={field} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Chave (opcional)</label>
          <input
            name="key"
            placeholder="cnpj"
            pattern="[a-z][a-z0-9_]{0,47}"
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Tipo</label>
          <select name="type" className={field} defaultValue="text">
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="email">E-mail</option>
            <option value="phone">Telefone</option>
            <option value="date">Data</option>
            <option value="select">Seleção</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            Opções (só para seleção, separadas por vírgula)
          </label>
          <input name="options" placeholder="Comércio, Indústria, Serviços" className={field} />
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
          Coletar via IA
        </label>
        {createState.error && (
          <p className="text-sm text-red-600">{createState.error}</p>
        )}
        {createState.success && (
          <p className="text-sm text-brand">{createState.success}</p>
        )}
        <button
          type="submit"
          disabled={createPending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {createPending ? "Criando…" : "Adicionar campo"}
        </button>
      </form>

      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Campos do tenant</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {attributes.length} campo{attributes.length !== 1 ? "s" : ""}
          </p>
        </div>
        {attributes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            Nenhum campo ainda. Crie o primeiro à esquerda.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {attributes.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="font-medium">{a.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <code className="rounded bg-[#eef3f1] px-1.5 py-0.5">{a.key}</code>
                    {" · "}
                    {a.type}
                    {a.required ? " · obrigatório" : ""}
                    {a.collect_via_ai ? " · IA" : ""}
                  </p>
                </div>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="rounded-lg px-2.5 py-1.5 text-xs text-ink-muted hover:bg-red-50 hover:text-red-700"
                  >
                    Remover
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {deleteState.error && (
          <p className="px-5 py-3 text-sm text-red-600">{deleteState.error}</p>
        )}
      </div>
    </div>
  );
}
