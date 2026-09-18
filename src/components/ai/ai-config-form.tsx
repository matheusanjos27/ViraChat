"use client";

import { useActionState } from "react";
import { updateAiConfig, type AiConfigState } from "@/app/actions/ai-config";

const initial: AiConfigState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function AiConfigForm({
  tenantId,
  name,
  instructions,
  isEnabled,
}: {
  tenantId: string;
  name: string;
  instructions: string;
  isEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(updateAiConfig, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nome da IA
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          className={field}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-sm font-medium">
          Instruções
        </label>
        <textarea
          id="instructions"
          name="instructions"
          defaultValue={instructions}
          rows={10}
          required
          className={field}
          placeholder="Tom de voz, produtos, horários, o que pode/não pode dizer…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isEnabled"
          defaultChecked={isEnabled}
          className="size-4 rounded border-line accent-[var(--brand)]"
        />
        Atendimento automático ativo
      </label>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
