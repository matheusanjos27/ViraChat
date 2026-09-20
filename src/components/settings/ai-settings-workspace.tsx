"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AiConfigForm } from "@/components/ai/ai-config-form";
import { FieldsManager } from "@/components/settings/fields-manager";
import { PlaybookEditor } from "@/components/settings/playbook-editor";
import { ServicesManager } from "@/components/settings/services-manager";
import type { Playbook } from "@/lib/crm/playbook";
import type { ServiceForQuote } from "@/lib/crm/pricing";

const TABS = [
  { id: "ligar", label: "1. Ligar e identificar" },
  { id: "roteiro", label: "2. Roteiro da conversa" },
  { id: "campos", label: "3. Campos do lead" },
  { id: "catalogo", label: "4. Catálogo e preços" },
] as const;

type TabId = (typeof TABS)[number]["id"];

type Attr = {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  collect_via_ai: boolean;
  sort_order: number;
};

export function AiSettingsWorkspace({
  tenantId,
  assistantName,
  assistantNotes,
  isEnabled,
  hasOpenAiKey,
  playbooks,
  attributes,
  services,
  attributeKeys,
}: {
  tenantId: string;
  assistantName: string;
  assistantNotes: string;
  isEnabled: boolean;
  hasOpenAiKey: boolean;
  playbooks: Playbook[];
  attributes: Attr[];
  services: ServiceForQuote[];
  attributeKeys: { key: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = normalizeTab(searchParams.get("tab"));
  const [tab, setTab] = useState<TabId>(initial);

  useEffect(() => {
    setTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  function go(next: TabId) {
    setTab(next);
    router.replace(`/app/settings/ai?tab=${next}`, { scroll: false });
  }

  return (
    <div>
      <nav className="sticky top-0 z-10 -mx-6 mb-6 border-b border-line bg-[#eef1f0]/95 px-6 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto py-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => go(t.id)}
                className={`shrink-0 rounded-xl px-3.5 py-2.5 text-sm transition ${
                  active
                    ? "bg-brand font-semibold text-white shadow-sm"
                    : "font-medium text-ink-muted hover:bg-white hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "ligar" && (
        <section>
          <p className="mb-4 max-w-xl text-sm text-ink-muted">
            Ligue o atendimento automático e defina como a IA se apresenta.
          </p>
          <div className="max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
            <AiConfigForm
              tenantId={tenantId}
              name={assistantName}
              notes={assistantNotes}
              isEnabled={isEnabled}
            />
          </div>
          {!hasOpenAiKey ? (
            <p className="mt-3 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Defina <code className="font-mono text-xs">OPENAI_API_KEY</code> no
              .env para respostas com OpenAI.
            </p>
          ) : null}
        </section>
      )}

      {tab === "roteiro" && (
        <section>
          <p className="mb-4 max-w-2xl text-sm text-ink-muted">
            Como a IA conduz o atendimento: abertura, coleta, orçamento,
            objeções e quando passar para humano.
          </p>
          <PlaybookEditor playbooks={playbooks} />
        </section>
      )}

      {tab === "campos" && (
        <section>
          <p className="mb-4 max-w-2xl text-sm text-ink-muted">
            Dados que a IA coleta na conversa e grava no lead — genérico para
            qualquer setor.
          </p>
          <FieldsManager attributes={attributes} />
        </section>
      )}

      {tab === "catalogo" && (
        <section>
          <p className="mb-4 max-w-2xl text-sm text-ink-muted">
            Serviços e regras de preço. A IA usa esta tabela para orçar sem
            inventar valores.
          </p>
          <ServicesManager services={services} attributeKeys={attributeKeys} />
        </section>
      )}
    </div>
  );
}

function normalizeTab(raw: string | null): TabId {
  if (raw === "roteiro" || raw === "campos" || raw === "catalogo" || raw === "ligar") {
    return raw;
  }
  // aliases from old URLs
  if (raw === "playbook" || raw === "assistant") return raw === "playbook" ? "roteiro" : "ligar";
  if (raw === "fields") return "campos";
  if (raw === "services" || raw === "precos") return "catalogo";
  return "ligar";
}
