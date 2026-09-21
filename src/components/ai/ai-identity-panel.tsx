"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { updateAiConfig, type AiConfigState } from "@/app/actions/ai-config";

const initial: AiConfigState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

const SEP = "\n---\n";

export function splitAiInstructions(raw: string) {
  if (raw.includes(SEP)) {
    const [a, b] = raw.split(SEP);
    return { presentation: (a ?? "").trim(), prompt: (b ?? "").trim() };
  }
  return { presentation: raw.trim(), prompt: "" };
}

export function AiIdentityPanel({
  tenantId,
  name,
  notes,
  isEnabled,
  quotaLocked = false,
}: {
  tenantId: string;
  name: string;
  notes: string;
  isEnabled: boolean;
  quotaLocked?: boolean;
}) {
  const split = splitAiInstructions(notes);
  const [enabled, setEnabled] = useState(isEnabled);
  const [assistantName, setAssistantName] = useState(name);
  const [presentation, setPresentation] = useState(split.presentation);
  const [prompt, setPrompt] = useState(split.prompt);
  const [state, action, pending] = useActionState(updateAiConfig, initial);

  const previewText = useMemo(() => {
    const who = assistantName.trim() || "Assistente";
    if (presentation.trim()) return presentation.trim();
    return `Olá! Eu sou ${who}. Como posso ajudar você hoje?`;
  }, [assistantName, presentation]);

  useEffect(() => {
    setEnabled(isEnabled);
    setAssistantName(name);
    const next = splitAiInstructions(notes);
    setPresentation(next.presentation);
    setPrompt(next.prompt);
  }, [isEnabled, name, notes]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form action={action} className="space-y-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="isEnabled" value={enabled ? "on" : ""} />
        <input
          type="hidden"
          name="instructions"
          value={[presentation, prompt].filter(Boolean).join(SEP)}
        />

        <div
          className={`rounded-2xl border p-5 shadow-[var(--shadow)] transition ${
            enabled
              ? "border-brand/30 bg-brand-soft/40"
              : "border-line bg-surface"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                IA {enabled ? "ativa" : "pausada"}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                Atendimento automático
              </h2>
              <p className="mt-1 max-w-md text-sm text-ink-muted">
                {quotaLocked && !enabled
                  ? "Cota do mês esgotada. A IA só pode ser ligada de novo no próximo mês ou se o teto do plano aumentar."
                  : "Quando ligado, a IA responde sozinha no WhatsApp usando o roteiro, campos e catálogo."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={quotaLocked && !enabled}
              title={
                quotaLocked && !enabled
                  ? "Cota mensal esgotada — não é possível ligar a IA"
                  : undefined
              }
              onClick={() => {
                setEnabled((v) => {
                  // Impede religar se a cota do mês acabou
                  if (!v && quotaLocked) return false;
                  return !v;
                });
              }}
              className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                enabled ? "bg-brand" : "bg-divider"
              } ${quotaLocked && !enabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full bg-white shadow transition ${
                  enabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-body">
            <span
              className={`size-2 rounded-full ${enabled ? "bg-success" : "bg-ink-placeholder"}`}
            />
            {enabled
              ? "Atendimento automático ligado"
              : "Atendimento automático desligado"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <label className="text-sm font-medium text-ink">Nome da IA</label>
          <input
            name="name"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            className={`${field} mt-2`}
            required
            placeholder="Ex: Ana"
          />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <label className="text-sm font-medium text-ink">
            Como ela se apresenta
          </label>
          <p className="mt-1 text-xs text-ink-muted">
            Frase que o cliente ouve no começo — aparece no preview ao lado.
          </p>
          <textarea
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            rows={3}
            className={`${field} mt-2`}
            placeholder={`Olá! Eu sou ${assistantName || "o Assistente"}. Como posso ajudar?`}
          />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <label className="text-sm font-medium text-ink">Prompt inicial</label>
          <p className="mt-1 text-xs text-ink-muted">
            Notas extras, horários, restrições — o “cérebro” complementar.
          </p>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className={`${field} mt-2`}
            placeholder="Horário comercial, tom, o que evitar…"
          />
        </div>

        {state.error ? (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-brand">{state.success}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar identidade"}
        </button>
      </form>

      <aside className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] xl:sticky xl:top-4 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
          Preview
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">WhatsApp</p>
        <div className="mt-4 rounded-2xl bg-[#0b141a] p-3">
          <div className="rounded-xl bg-[#1f2c34] px-3 py-2">
            <p className="text-[11px] text-white/50">Hoje</p>
          </div>
          <div className="mt-3 flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#005c4b] px-3 py-2 text-[13px] leading-relaxed text-white">
              <p className="mb-1 text-[10px] font-semibold text-[#8ce7d0]">
                {assistantName || "IA"}
              </p>
              <p className="whitespace-pre-wrap">{previewText}</p>
              <p className="mt-1 text-right text-[10px] text-white/50">agora</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Assim o cliente vê a IA no primeiro contato.
        </p>
      </aside>
    </div>
  );
}
