"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createPlaybookFromTemplate,
  deletePlaybook,
  savePlaybook,
  setPlaybookActive,
  type PlaybookState,
} from "@/app/actions/playbooks";
import {
  DEFAULT_PLAYBOOK_CONTENT,
  normalizePlaybookSections,
  serializePlaybookSections,
  type Playbook,
  type PlaybookTrigger,
} from "@/lib/crm/playbook";
import { CharCount } from "@/components/ui/char-count";
import { AI_LIMITS } from "@/lib/ai/limits";

const empty: PlaybookState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

const TEMPLATES = [
  { id: "comercial", label: "Comercial", content: DEFAULT_PLAYBOOK_CONTENT },
  {
    id: "suporte",
    label: "Suporte",
    content: `# Objetivo
Resolver dúvidas e problemas com clareza, sem enrolação.

# Tom de voz
Calmo, empático, objetivo. Mensagens curtas.

# Abertura
Cumprimente e peça o resumo do problema em uma frase.

# Diagnóstico
Pergunte o que já tentou e desde quando ocorre.

# Orçamento
Não oferte planos novos — foque em resolver. Se pedir upgrade, faça handoff.

# Objeções
Se estiver frustrado: reconheça, peça desculpas se couber e ofereça humano.

# Fechamento
Confirme se ficou resolvido e se precisa de mais alguma coisa.

# Transferência
- Pediu humano
- Problema técnico fora do seu conhecimento
- Cobrança / financeiro

# Limites
- Não inventar soluções
- Não prometer prazos sem base
`,
  },
  {
    id: "cobranca",
    label: "Cobrança",
    content: `# Objetivo
Negociar pendências com respeito e clareza, sem pressão agressiva.

# Tom de voz
Educado, firme, transparente.

# Abertura
Identifique-se e confirme se pode falar sobre a pendência.

# Diagnóstico
Entenda o motivo do atraso e a capacidade de pagamento.

# Orçamento
Só use valores oficiais do sistema. Nunca invente descontos.

# Objeções
Ofereça opções dentro da política; fora disso, handoff.

# Fechamento
Confirme o acordo e próximos passos por escrito.

# Transferência
- Pediu gestor
- Contestação complexa
- Desconto especial

# Limites
- Não ameaçar
- Não inventar juros/multas
`,
  },
  {
    id: "pos-venda",
    label: "Pós-venda",
    content: `# Objetivo
Garantir onboarding e satisfação após a venda.

# Tom de voz
Acolhedor e pró-ativo.

# Abertura
Agradeça a compra e pergunte como está a experiência.

# Diagnóstico
Identifique se precisa de ajuda para começar a usar.

# Orçamento
Não foque em upsell no primeiro contato pós-venda.

# Objeções
Se houver reclamação: acolha e ofereça humano quando necessário.

# Fechamento
Deixe canal aberto e confirme se está tudo certo.

# Transferência
- Reclamação grave
- Pediu humano
- Cancelamento

# Limites
- Não pressionar nova venda cedo demais
`,
  },
] as const;

export function PlaybookEditor({ playbooks }: { playbooks: Playbook[] }) {
  const [selectedId, setSelectedId] = useState(playbooks[0]?.id ?? null);
  const selected =
    playbooks.find((p) => p.id === selectedId) ?? playbooks[0] ?? null;
  const [createState, createAction, createPending] = useActionState(
    createPlaybookFromTemplate,
    empty,
  );

  useEffect(() => {
    if (createState.id) setSelectedId(createState.id);
  }, [createState.id]);

  useEffect(() => {
    if (
      selectedId &&
      playbooks.length > 0 &&
      !playbooks.some((p) => p.id === selectedId)
    ) {
      setSelectedId(playbooks[0]?.id ?? null);
    }
  }, [playbooks, selectedId]);

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <form action={createAction}>
          <input type="hidden" name="name" value="Roteiro comercial" />
          <button
            type="submit"
            disabled={createPending}
            className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {createPending ? "Criando…" : "Adicionar playbook"}
          </button>
          <p className="mt-2 px-1 text-[11px] leading-snug text-ink-muted">
            Sempre começa com o roteiro padrão do sistema — aí você personaliza.
          </p>
        </form>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Roteiros
          </p>
          <ul className="mt-2 space-y-1">
            {playbooks.length === 0 ? (
              <li className="px-2 py-2 text-xs text-ink-muted">
                Nenhum ainda. Use o botão acima.
              </li>
            ) : (
              playbooks.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      selected?.id === p.id
                        ? "bg-brand-soft font-semibold text-brand-deep"
                        : "hover:bg-paper"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {p.is_active ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-success" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
          {createState.error ? (
            <p className="mt-2 px-2 text-xs text-danger">{createState.error}</p>
          ) : null}
          {createState.success ? (
            <p className="mt-2 px-2 text-xs text-brand">{createState.success}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Outros templates
          </p>
          <ul className="mt-2 space-y-1">
            {TEMPLATES.map((t) => (
              <li key={t.id}>
                <form action={createAction}>
                  <input
                    type="hidden"
                    name="name"
                    value={`Roteiro ${t.label}`}
                  />
                  <input type="hidden" name="content" value={t.content} />
                  <button
                    type="submit"
                    disabled={createPending}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-body transition hover:bg-paper disabled:opacity-60"
                  >
                    {t.label}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {selected ? (
        <PlaybookAccordion key={selected.id} playbook={selected} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-ink-muted">
          Nenhum playbook. Clique em &quot;Adicionar playbook&quot; para começar
          com o padrão do sistema.
        </div>
      )}
    </div>
  );
}

function PlaybookAccordion({ playbook }: { playbook: Playbook }) {
  const [sections, setSections] = useState(() =>
    normalizePlaybookSections(playbook.content),
  );
  const [open, setOpen] = useState<string>("Objetivo");
  const [trigger, setTrigger] = useState<PlaybookTrigger>(playbook.trigger);
  const [state, action, pending] = useActionState(savePlaybook, empty);
  const [delState, delAction, delPending] = useActionState(
    deletePlaybook,
    empty,
  );
  const [actState, actAction] = useActionState(setPlaybookActive, empty);

  const content = useMemo(
    () => serializePlaybookSections(sections),
    [sections],
  );

  function updateBody(title: string, body: string) {
    setSections((prev) => {
      const prevBody = prev.find((s) => s.title === title)?.body ?? "";
      const without = prev.map((s) =>
        s.title === title ? { ...s, body: "" } : s,
      );
      const usedByOthers = serializePlaybookSections(without).length;
      const room = Math.max(0, AI_LIMITS.playbookSaved - usedByOthers);

      let next = body;
      if (body.length > room) {
        // Never wipe existing text when already over budget — only block growth.
        if (room === 0) {
          next = body.length < prevBody.length ? body : prevBody;
        } else {
          next = body.slice(0, room);
        }
      }

      return prev.map((s) =>
        s.title === title ? { ...s, body: next } : s,
      );
    });
  }

  return (
    <div className="space-y-4">
      <form
        action={action}
        className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]"
      >
        <input type="hidden" name="id" value={playbook.id} />
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="trigger" value={trigger} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Ensine a IA</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Cada bloco é uma etapa do atendimento — expanda e edite.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={playbook.is_active}
              className="size-4 accent-[var(--brand)]"
            />
            Ativo
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <input
              name="name"
              required
              defaultValue={playbook.name}
              className={`${field} mt-1`}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Gatilho</label>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as PlaybookTrigger)}
              className={`${field} mt-1`}
            >
              <option value="new_contact">Todo novo contato</option>
              <option value="keyword">Palavra-chave</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          {trigger === "keyword" ? (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Palavra-chave</label>
              <input
                name="triggerKeyword"
                defaultValue={playbook.trigger_keyword ?? ""}
                className={`${field} mt-1`}
              />
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-2">
          {sections.map((s) => {
            const isOpen = open === s.title;
            return (
              <div
                key={s.title}
                className="overflow-hidden rounded-xl border border-line bg-paper"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? "" : s.title)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-ink">
                    {s.title}
                  </span>
                  <span className="text-ink-muted" aria-hidden>
                    {isOpen ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="size-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path
                          d="M9 6l6 6-6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-line px-4 py-3">
                    <textarea
                      value={s.body}
                      onChange={(e) => updateBody(s.title, e.target.value)}
                      rows={5}
                      className={`${field} bg-surface`}
                      placeholder={`Orientações de ${s.title.toLowerCase()}…`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <CharCount value={content} max={AI_LIMITS.playbookSaved} />

        {state.error ? (
          <p className="mt-3 text-sm text-danger">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-3 text-sm text-brand">{state.success}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar playbook"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <form action={actAction}>
          <input type="hidden" name="id" value={playbook.id} />
          <input
            type="hidden"
            name="isActive"
            value={playbook.is_active ? "false" : "true"}
          />
          <button
            type="submit"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium hover:bg-paper"
          >
            {playbook.is_active ? "Desativar" : "Ativar"}
          </button>
        </form>
        <form action={delAction}>
          <input type="hidden" name="id" value={playbook.id} />
          <button
            type="submit"
            disabled={delPending}
            className="rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-red-50 hover:text-danger"
            onClick={(e) => {
              if (!confirm("Remover este playbook?")) e.preventDefault();
            }}
          >
            Excluir
          </button>
        </form>
        {actState.success ? (
          <span className="text-xs text-brand">{actState.success}</span>
        ) : null}
        {delState.error ? (
          <span className="text-xs text-danger">{delState.error}</span>
        ) : null}
      </div>
    </div>
  );
}
