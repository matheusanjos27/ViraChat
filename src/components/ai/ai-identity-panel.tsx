"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { updateAiConfig, type AiConfigState } from "@/app/actions/ai-config";
import { CharCount } from "@/components/ui/char-count";
import { AI_LIMITS } from "@/lib/ai/limits";

const initial: AiConfigState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

/** Apresentação WhatsApp — curta de propósito */
const PRESENTATION_MAX = 500;
/** Prompt que a IA usa (cap de instruções do modelo) */
const PROMPT_MAX = AI_LIMITS.instructions;

export function AiIdentityPanel({
  tenantId,
  name,
  presentation: presentationProp,
  prompt: promptProp,
  isEnabled,
  closeMode = "handoff",
  quotaLocked = false,
}: {
  tenantId: string;
  name: string;
  /** Frase de apresentação (WhatsApp / 1ª mensagem) */
  presentation: string;
  /** Prompt inicial / instruções (cérebro) */
  prompt: string;
  isEnabled: boolean;
  closeMode?: "handoff" | "callback";
  quotaLocked?: boolean;
}) {
  const [enabled, setEnabled] = useState(isEnabled);
  const [assistantName, setAssistantName] = useState(name);
  const [presentation, setPresentation] = useState(presentationProp);
  const [prompt, setPrompt] = useState(promptProp);
  const [mode, setMode] = useState<"handoff" | "callback">(closeMode);
  const [state, action, pending] = useActionState(updateAiConfig, initial);

  const previewText = useMemo(() => {
    const who = assistantName.trim() || "Assistente";
    if (presentation.trim()) return presentation.trim();
    return `Olá! Eu sou ${who}. Como posso ajudar você hoje?`;
  }, [assistantName, presentation]);

  useEffect(() => {
    setEnabled(isEnabled);
    setAssistantName(name);
    setPresentation(presentationProp);
    setPrompt(promptProp);
    setMode(closeMode);
  }, [isEnabled, name, presentationProp, promptProp, closeMode]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <form action={action} className="space-y-4">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="isEnabled" value={enabled ? "on" : ""} />
        <input type="hidden" name="closeMode" value={mode} />

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
          <p className="text-sm font-medium text-ink">Após o orçamento</p>
          <p className="mt-1 text-xs text-ink-muted">
            O que a IA faz quando a venda está pronta (sem o cliente pedir
            humano).
          </p>
          <div className="mt-3 space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper px-3 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/30">
              <input
                type="radio"
                name="closeModeRadio"
                className="mt-1 accent-[var(--brand)]"
                checked={mode === "handoff"}
                onChange={() => setMode("handoff")}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Oferecer atendente
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Pergunta se quer falar com um humano e, se sim, entra na fila.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper px-3 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/30">
              <input
                type="radio"
                name="closeModeRadio"
                className="mt-1 accent-[var(--brand)]"
                checked={mode === "callback"}
                onChange={() => setMode("callback")}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Encerrar e retornar depois
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Agradece, diz que a equipe entra em contato e finaliza a
                  conversa (sem transferir agora).
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <label className="text-sm font-medium text-ink" htmlFor="presentation">
            Como ela se apresenta
          </label>
          <p className="mt-1 text-xs text-ink-muted">
            Frase de cumprimento no WhatsApp. Na 1ª mensagem (oi / boa tarde) o
            sistema junta automaticamente o catálogo cadastrado depois desta
            frase.
          </p>
          <textarea
            id="presentation"
            name="presentation"
            value={presentation}
            onChange={(e) =>
              setPresentation(e.target.value.slice(0, PRESENTATION_MAX))
            }
            rows={3}
            maxLength={PRESENTATION_MAX}
            className={`${field} mt-2`}
            placeholder={`Olá! Eu sou ${assistantName || "o Assistente"} da KM SAFETY. Como posso ajudar?`}
          />
          <CharCount value={presentation} max={PRESENTATION_MAX} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <label className="text-sm font-medium text-ink" htmlFor="instructions">
            Prompt inicial
          </label>
          <p className="mt-1 text-xs text-ink-muted">
            Tom, horários, restrições — o “cérebro”. Não cole a lista de
            produtos aqui: use a aba Produtos. O catálogo na abertura já é
            automático.
          </p>
          <textarea
            id="instructions"
            name="instructions"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
            rows={5}
            maxLength={PROMPT_MAX}
            className={`${field} mt-2`}
            placeholder="Horário comercial, tom, o que evitar…"
          />
          <CharCount value={prompt} max={PROMPT_MAX} />
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
          Preview da apresentação. No WhatsApp real, na 1ª mensagem o catálogo
          ativo entra automaticamente depois desta frase.
        </p>
      </aside>
    </div>
  );
}
