"use client";

import { useActionState } from "react";
import {
  platformUpdateAiHistoryTurns,
  type PlatformSettingsState,
} from "@/app/actions/platform-settings";
import { AI_LIMITS } from "@/lib/ai/limits";

const initial: PlatformSettingsState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function PlatformAiHistoryForm({
  currentTurns,
}: {
  currentTurns: number;
}) {
  const [state, action, pending] = useActionState(
    platformUpdateAiHistoryTurns,
    initial,
  );

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-ink-muted">
          Mensagens de histórico
        </label>
        <input
          name="aiHistoryTurns"
          type="number"
          min={AI_LIMITS.historyTurnsMin}
          max={AI_LIMITS.historyTurnsMax}
          step={1}
          defaultValue={currentTurns}
          className={`${field} mt-1 max-w-[140px]`}
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
