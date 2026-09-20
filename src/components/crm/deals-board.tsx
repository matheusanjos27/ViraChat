"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { createDeal, moveDeal, type CrmState } from "@/app/actions/crm";

const empty: CrmState = {};

export type DealCard = {
  id: string;
  title: string;
  value: number | null;
  stage_id: string;
  contact_id: string;
  conversation_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  temperature: "hot" | "warm" | "cold";
  updated_at: string;
};

export type StageCol = {
  id: string;
  name: string;
  color: string;
  is_closed_won: boolean;
  is_closed_lost: boolean;
};

function formatMoney(v: number | null) {
  if (v == null) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tempDot(t: DealCard["temperature"]) {
  if (t === "hot") return "bg-red-500";
  if (t === "warm") return "bg-amber-400";
  return "bg-slate-400";
}

export function DealsBoard({
  stages,
  deals,
}: {
  stages: StageCol[];
  deals: DealCard[];
}) {
  const [optimisticDeals, setOptimistic] = useOptimistic(
    deals,
    (state, update: { dealId: string; stageId: string }) =>
      state.map((d) =>
        d.id === update.dealId ? { ...d, stage_id: update.stageId } : d,
      ),
  );
  const [, startTransition] = useTransition();
  const [moveState, moveAction] = useActionState(moveDeal, empty);
  const [createState, createAction, createPending] = useActionState(
    createDeal,
    empty,
  );

  const totalOpen = optimisticDeals
    .filter((d) => {
      const s = stages.find((x) => x.id === d.stage_id);
      return s && !s.is_closed_won && !s.is_closed_lost;
    })
    .reduce((acc, d) => acc + (d.value ?? 0), 0);

  function onDrop(dealId: string, stageId: string) {
    startTransition(async () => {
      setOptimistic({ dealId, stageId });
      const fd = new FormData();
      fd.set("dealId", dealId);
      fd.set("stageId", stageId);
      await moveAction(fd);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-white px-6 py-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Comercial
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Funil</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Pipeline aberto:{" "}
            <span className="font-semibold text-ink">
              {formatMoney(totalOpen) ?? "R$ 0"}
            </span>
          </p>
        </div>
        <a
          href="/app/settings/pipeline"
          className="rounded-lg border border-line px-3 py-2 text-xs font-medium hover:bg-[#f4f7f6]"
        >
          Configurar etapas
        </a>
      </div>

      {moveState.error && (
        <p className="bg-red-50 px-6 py-2 text-sm text-red-700">{moveState.error}</p>
      )}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4">
        {stages.map((stage) => {
          const cards = optimisticDeals.filter((d) => d.stage_id === stage.id);
          const colValue = cards.reduce((a, d) => a + (d.value ?? 0), 0);
          return (
            <section
              key={stage.id}
              className="flex w-[280px] shrink-0 flex-col rounded-2xl bg-[#f4f7f6]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dealId = e.dataTransfer.getData("dealId");
                if (dealId) onDrop(dealId, stage.id);
              }}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: stage.color }}
                  />
                  <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                    {cards.length}
                  </span>
                </div>
                {colValue > 0 && (
                  <span className="shrink-0 text-[10px] font-medium text-ink-muted">
                    {formatMoney(colValue)}
                  </span>
                )}
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
                {cards.map((d) => (
                  <article
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("dealId", d.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab rounded-xl border border-line bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{d.title}</p>
                      <span className={`mt-1 size-2 shrink-0 rounded-full ${tempDot(d.temperature)}`} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      {d.contact_name || d.contact_phone || "Contato"}
                    </p>
                    {d.value != null && (
                      <p className="mt-2 text-sm font-semibold text-brand">
                        {formatMoney(d.value)}
                      </p>
                    )}
                    {d.conversation_id && (
                      <a
                        href={`/app/conversations?c=${d.conversation_id}`}
                        className="mt-2 inline-block text-[11px] font-medium text-brand hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Abrir conversa →
                      </a>
                    )}
                  </article>
                ))}
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-ink-muted">
                    Arraste um deal aqui
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {createState.error && (
        <p className="px-6 py-2 text-sm text-red-600">{createState.error}</p>
      )}
      {/* createDeal available for future quick-add; kept for server action wiring */}
      <form action={createAction} className="hidden">
        <button type="submit" disabled={createPending} />
      </form>
    </div>
  );
}
