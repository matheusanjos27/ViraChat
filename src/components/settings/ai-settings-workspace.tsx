"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AiIdentityPanel } from "@/components/ai/ai-identity-panel";
import { FieldsManager } from "@/components/settings/fields-manager";
import { PlaybookEditor } from "@/components/settings/playbook-editor";
import { ServicesManager } from "@/components/settings/services-manager";
import { testAiReply, type TestAiState } from "@/app/actions/test-ai";
import type { Playbook } from "@/lib/crm/playbook";
import type { ServiceForQuote } from "@/lib/crm/pricing";

const STEPS = [
  { id: "ligar", label: "Identidade" },
  { id: "roteiro", label: "Playbook" },
  { id: "campos", label: "Campos" },
  { id: "catalogo", label: "Produtos" },
] as const;

type TabId = (typeof STEPS)[number]["id"];

type Attr = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  collect_via_ai: boolean;
  sort_order: number;
};

const testInitial: TestAiState = {};

export function AiSettingsWorkspace({
  tenantId,
  assistantName,
  assistantNotes,
  isEnabled,
  closeMode = "handoff",
  hasOpenAiKey,
  playbooks,
  attributes,
  services,
  attributeKeys,
  planName,
  aiRepliesUsed,
  aiRepliesLimit,
  aiQuotaLocked,
}: {
  tenantId: string;
  assistantName: string;
  assistantNotes: string;
  isEnabled: boolean;
  closeMode?: "handoff" | "callback";
  hasOpenAiKey: boolean;
  playbooks: Playbook[];
  attributes: Attr[];
  services: ServiceForQuote[];
  attributeKeys: { key: string; label: string }[];
  planName: string;
  aiRepliesUsed: number;
  aiRepliesLimit: number;
  aiQuotaLocked: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = normalizeTab(searchParams.get("tab"));
  const [tab, setTab] = useState<TabId>(initial);
  const [testOpen, setTestOpen] = useState(false);

  useEffect(() => {
    setTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  function go(next: TabId) {
    setTab(next);
    router.replace(`/app/settings/ai?tab=${next}`, { scroll: false });
  }

  const progress = useMemo(() => {
    const checks = [
      {
        id: "nome",
        label: "Nome",
        ok: Boolean(assistantName.trim()),
      },
      {
        id: "prompt",
        label: "Prompt",
        ok: Boolean(assistantNotes.trim()),
      },
      {
        id: "campos",
        label: "Campos",
        ok: attributes.length > 0,
      },
      {
        id: "playbook",
        label: "Playbook",
        ok: playbooks.some((p) => p.is_active && p.content.trim()),
      },
      {
        id: "catalogo",
        label: "Catálogo",
        ok: services.some((s) => s.is_active),
      },
      {
        id: "ligado",
        label: "IA ligada",
        ok: isEnabled,
      },
    ];
    const done = checks.filter((c) => c.ok).length;
    const pct = Math.round((done / checks.length) * 100);
    return { checks, done, pct };
  }, [assistantName, assistantNotes, attributes, playbooks, services, isEnabled]);

  const replyPct =
    aiRepliesLimit <= 0
      ? 0
      : Math.min(100, Math.round((aiRepliesUsed / aiRepliesLimit) * 100));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Plano {planName}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold text-ink">
                Respostas da IA neste mês
              </h2>
              <span className="text-sm tabular-nums text-ink-muted">
                {aiRepliesUsed} / {aiRepliesLimit}
              </span>
            </div>
            <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full rounded-full transition-all ${
                  aiQuotaLocked || replyPct >= 100
                    ? "bg-warn"
                    : replyPct >= 80
                      ? "bg-[#f59e0b]"
                      : "bg-brand"
                }`}
                style={{ width: `${replyPct}%` }}
              />
            </div>
            {aiQuotaLocked ? (
              <p className="mt-2 text-sm text-warn">
                Cota esgotada — a IA foi desligada. Religa no próximo mês ou
                quando o teto do plano aumentar.
              </p>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">
                “Testar IA” não consome esta cota (máx. 10 testes/dia).
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-deep"
          >
            Testar IA
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              Configuração da IA
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold text-ink">
                {progress.pct >= 90 ? "IA pronta" : "IA em treinamento"}
              </h2>
              <span className="text-sm tabular-nums text-ink-muted">
                {progress.pct}%
              </span>
            </div>
            <div className="mt-3 h-2 max-w-md overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {progress.checks.map((c) => (
                <li key={c.id} className="inline-flex items-center gap-1.5">
                  <span>{c.ok ? "☑" : "☐"}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <nav aria-label="Etapas do treinamento" className="space-y-2">
        <p className="text-xs text-ink-muted">
          Clique em uma etapa para navegar
        </p>
        <div
          role="tablist"
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        >
          {STEPS.map((step, i) => {
            const active = tab === step.id;
            const idx = STEPS.findIndex((s) => s.id === tab);
            const done = i < idx;
            return (
              <button
                key={step.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => go(step.id)}
                className={`group flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-brand bg-brand-soft shadow-sm ring-1 ring-brand/30"
                    : "border-line bg-surface hover:border-brand/50 hover:bg-paper"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition ${
                    active
                      ? "bg-brand text-white"
                      : done
                        ? "bg-brand/15 text-brand-deep group-hover:bg-brand/25"
                        : "bg-paper text-ink-muted group-hover:text-ink"
                  }`}
                >
                  {done && !active ? "✓" : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${
                      active
                        ? "font-semibold text-ink"
                        : "font-medium text-ink-muted group-hover:text-ink"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    {active ? "Etapa atual" : "Abrir etapa"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {!hasOpenAiKey ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Defina <code className="font-mono text-xs">OPENAI_API_KEY</code> no
          .env para respostas reais e para o Testar IA.
        </p>
      ) : null}

      {tab === "ligar" ? (
        <AiIdentityPanel
          tenantId={tenantId}
          name={assistantName}
          notes={assistantNotes}
          isEnabled={isEnabled}
          closeMode={closeMode}
          quotaLocked={aiQuotaLocked}
        />
      ) : null}

      {tab === "roteiro" ? <PlaybookEditor playbooks={playbooks} /> : null}

      {tab === "campos" ? <FieldsManager attributes={attributes} /> : null}

      {tab === "catalogo" ? (
        <ServicesManager services={services} attributeKeys={attributeKeys} />
      ) : null}

      {testOpen ? (
        <TestAiModal
          tenantId={tenantId}
          assistantName={assistantName}
          onClose={() => setTestOpen(false)}
        />
      ) : null}
    </div>
  );
}

function TestAiModal({
  tenantId,
  assistantName,
  onClose,
}: {
  tenantId: string;
  assistantName: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<
    { role: "user" | "ai"; text: string }[]
  >([]);
  const [state, action, pending] = useActionState(testAiReply, testInitial);

  useEffect(() => {
    if (state.reply) {
      setMessages((prev) => [...prev, { role: "ai", text: state.reply! }]);
    }
  }, [state.reply]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Testar IA</p>
            <p className="text-xs text-ink-muted">
              Simulação com {assistantName || "Assistente"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full text-ink-muted hover:bg-paper"
          >
            ×
          </button>
        </div>

        <div className="inbox-scroll min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#0b141a] p-4">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-white/40">
              Digite como um cliente — veja como a IA responde.
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-[#005c4b] text-white"
                      : "rounded-bl-md bg-[#1f2c34] text-white"
                  }`}
                >
                  {m.role === "ai" ? (
                    <p className="mb-1 text-[10px] font-semibold text-[#8ce7d0]">
                      {assistantName || "IA"}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          action={action}
          className="border-t border-line p-3"
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            const msg = String(fd.get("message") ?? "").trim();
            if (msg) {
              setMessages((prev) => [...prev, { role: "user", text: msg }]);
            }
          }}
        >
          <input type="hidden" name="tenantId" value={tenantId} />
          <div className="flex gap-2">
            <input
              name="message"
              required
              disabled={pending}
              placeholder="Ex: Quero um orçamento"
              className="min-h-10 flex-1 rounded-full border border-line bg-paper px-4 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {pending ? "…" : "Enviar"}
            </button>
          </div>
          {state.error ? (
            <p className="mt-2 text-xs text-danger">{state.error}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function normalizeTab(raw: string | null): TabId {
  if (
    raw === "roteiro" ||
    raw === "campos" ||
    raw === "catalogo" ||
    raw === "ligar"
  ) {
    return raw;
  }
  if (raw === "playbook" || raw === "assistant")
    return raw === "playbook" ? "roteiro" : "ligar";
  if (raw === "fields" || raw === "identidade") return raw === "fields" ? "campos" : "ligar";
  if (raw === "services" || raw === "precos" || raw === "produtos")
    return "catalogo";
  return "ligar";
}
