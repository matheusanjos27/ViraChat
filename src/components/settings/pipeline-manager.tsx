"use client";

import { useActionState } from "react";
import {
  createDealStage,
  deleteDealStage,
  updateDealStage,
  type CrmState,
} from "@/app/actions/crm";

const empty: CrmState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

type Stage = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
};

export function PipelineManager({ stages }: { stages: Stage[] }) {
  const [createState, createAction, createPending] = useActionState(
    createDealStage,
    empty,
  );
  const [deleteState, deleteAction] = useActionState(deleteDealStage, empty);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {stages.map((s) => (
          <div
            key={s.id}
            className="min-w-[140px] rounded-xl border border-line bg-surface px-3 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: s.color }}
              />
              <p className="truncate text-sm font-semibold">{s.name}</p>
            </div>
            <p className="mt-1 text-[10px] text-ink-muted">
              {s.is_closed_won
                ? "Ganho"
                : s.is_closed_lost
                  ? "Perdido"
                  : "Aberto"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        <form
          action={createAction}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]"
        >
          <h2 className="text-lg font-semibold">Nova etapa</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Nome</label>
            <input name="name" required className={field} placeholder="Ex: Em proposta" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Cor</label>
            <input name="color" type="color" defaultValue="#0c6b5c" className="h-10 w-full cursor-pointer rounded-xl border border-line bg-paper px-2" />
          </div>
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
            {createPending ? "Criando…" : "Adicionar etapa"}
          </button>
        </form>

        <div className="space-y-3">
          {stages.map((s) => (
            <StageRow key={s.id} stage={s} deleteAction={deleteAction} />
          ))}
          {deleteState.error && (
            <p className="text-sm text-red-600">{deleteState.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  deleteAction,
}: {
  stage: Stage;
  deleteAction: (payload: FormData) => void;
}) {
  const [state, action, pending] = useActionState(updateDealStage, empty);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
    >
      <input type="hidden" name="id" value={stage.id} />
      <div className="min-w-[160px] flex-1">
        <label className="text-xs text-ink-muted">Nome</label>
        <input name="name" defaultValue={stage.name} required className={`${field} mt-1`} />
      </div>
      <div>
        <label className="text-xs text-ink-muted">Cor</label>
        <input
          name="color"
          type="color"
          defaultValue={stage.color}
          className="mt-1 h-10 w-14 cursor-pointer rounded-lg border border-line"
        />
      </div>
      <label className="flex items-center gap-1.5 pb-2.5 text-xs">
        <input
          type="checkbox"
          name="isClosedWon"
          defaultChecked={stage.is_closed_won}
          className="accent-[var(--brand)]"
        />
        Ganho
      </label>
      <label className="flex items-center gap-1.5 pb-2.5 text-xs">
        <input
          type="checkbox"
          name="isClosedLost"
          defaultChecked={stage.is_closed_lost}
          className="accent-[var(--brand)]"
        />
        Perdido
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#eef3f1] px-3 py-2 text-xs font-semibold hover:bg-[#e2ebe8] disabled:opacity-60"
      >
        {pending ? "…" : "Salvar"}
      </button>
      <button
        type="submit"
        formAction={deleteAction}
        className="rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-red-50 hover:text-red-700"
      >
        Excluir
      </button>
      {state.error && <p className="w-full text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-xs text-brand">{state.success}</p>}
    </form>
  );
}
