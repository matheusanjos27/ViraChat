"use client";

import { useActionState } from "react";
import { updateAiConfig, type AiConfigState } from "@/app/actions/ai-config";

const initial: AiConfigState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function AiConfigForm({
  tenantId,
  name,
  notes,
  isEnabled,
}: {
  tenantId: string;
  name: string;
  notes: string;
  isEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(updateAiConfig, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="tenantId" value={tenantId} />

      <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[#f7faf9] px-4 py-3">
        <span>
          <span className="block text-sm font-semibold">
            Atendimento automático
          </span>
          <span className="text-xs text-ink-muted">
            Quando ligado, a IA responde sozinha no WhatsApp
          </span>
        </span>
        <input
          type="checkbox"
          name="isEnabled"
          defaultChecked={isEnabled}
          className="size-5 accent-[var(--brand)]"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Nome do assistente
        </label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          className={field}
          required
          placeholder="Ex: Ana"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="instructions" className="text-sm font-medium">
          Notas extras{" "}
          <span className="font-normal text-ink-muted">(opcional)</span>
        </label>
        <textarea
          id="instructions"
          name="instructions"
          defaultValue={notes}
          rows={3}
          className={field}
          placeholder="Horários, restrições pontuais…"
        />
      </div>

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
