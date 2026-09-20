"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createPlaybookFromTemplate,
  deletePlaybook,
  savePlaybook,
  setPlaybookActive,
  type PlaybookState,
} from "@/app/actions/playbooks";
import {
  DEFAULT_PLAYBOOK_CONTENT,
  parsePlaybookSections,
  type Playbook,
  type PlaybookTrigger,
} from "@/lib/crm/playbook";

const empty: PlaybookState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

const SECTION_HINTS = [
  "Objetivo",
  "Tom de voz",
  "Abertura",
  "Dados a coletar",
  "Diagnóstico",
  "Orçamento",
  "Objeções",
  "Fechamento",
  "Transferir para humano quando",
  "O que NÃO fazer",
];

export function PlaybookEditor({ playbooks }: { playbooks: Playbook[] }) {
  const [selectedId, setSelectedId] = useState(playbooks[0]?.id ?? null);
  const selected =
    playbooks.find((p) => p.id === selectedId) ?? playbooks[0] ?? null;

  const [createState, createAction, createPending] = useActionState(
    createPlaybookFromTemplate,
    empty,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Roteiros
          </p>
          <ul className="mt-2 space-y-1">
            {playbooks.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selected?.id === p.id
                      ? "bg-[#e7f4ef] font-semibold text-brand-deep"
                      : "hover:bg-[#f4f7f6]"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.is_active && (
                    <span className="size-1.5 shrink-0 rounded-full bg-[#1f9d55]" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <form action={createAction} className="mt-3 px-1">
            <button
              type="submit"
              disabled={createPending}
              className="w-full rounded-lg border border-dashed border-line px-3 py-2 text-xs font-medium text-ink-muted hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {createPending ? "…" : "+ Novo do template"}
            </button>
          </form>
          {createState.error && (
            <p className="mt-2 px-2 text-xs text-red-600">{createState.error}</p>
          )}
        </div>
      </aside>

      {selected ? (
        <PlaybookForm key={selected.id} playbook={selected} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-ink-muted">
          Nenhum playbook. Crie um a partir do template.
        </div>
      )}
    </div>
  );
}

function PlaybookForm({ playbook }: { playbook: Playbook }) {
  const [content, setContent] = useState(playbook.content);
  const [trigger, setTrigger] = useState<PlaybookTrigger>(playbook.trigger);
  const [state, action, pending] = useActionState(savePlaybook, empty);
  const [delState, delAction, delPending] = useActionState(deletePlaybook, empty);
  const [actState, actAction] = useActionState(setPlaybookActive, empty);

  const sections = useMemo(() => parsePlaybookSections(content), [content]);

  function insertSection(title: string) {
    if (content.includes(`# ${title}`)) return;
    setContent((prev) => `${prev.trim()}\n\n# ${title}\n\n`);
  }

  function resetTemplate() {
    if (
      confirm(
        "Substituir o conteúdo atual pelo template padrão? Alterações não salvas serão perdidas.",
      )
    ) {
      setContent(DEFAULT_PLAYBOOK_CONTENT);
    }
  }

  return (
    <div className="space-y-4">
      <form
        action={action}
        className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]"
      >
        <input type="hidden" name="id" value={playbook.id} />
        <input type="hidden" name="content" value={content} />
        <input type="hidden" name="trigger" value={trigger} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Editar roteiro</h2>
            <p className="mt-1 text-sm text-ink-muted">
              A IA segue este playbook em toda conversa — genérico para qualquer
              setor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetTemplate}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-[#f4f7f6]"
            >
              Restaurar template
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
              <option value="keyword">Palavra-chave na mensagem</option>
              <option value="manual">Manual (só se ativado explicitamente)</option>
            </select>
          </div>
          {trigger === "keyword" && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Palavra-chave</label>
              <input
                name="triggerKeyword"
                defaultValue={playbook.trigger_keyword ?? ""}
                placeholder="Ex: orçamento"
                className={`${field} mt-1`}
              />
            </div>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={playbook.is_active}
            className="size-4 accent-[var(--brand)]"
          />
          Playbook ativo
        </label>

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SECTION_HINTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => insertSection(s)}
                className="rounded-full bg-[#eef3f1] px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:bg-[#e2ebe8] hover:text-ink"
              >
                + {s}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            className={`${field} font-mono text-[13px] leading-relaxed`}
            spellCheck
          />
        </div>

        {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
        {state.success && (
          <p className="mt-2 text-sm text-brand">{state.success}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar playbook"}
          </button>
        </div>
      </form>

      <form action={actAction} className="flex items-center gap-3">
        <input type="hidden" name="id" value={playbook.id} />
        <input
          type="hidden"
          name="isActive"
          value={playbook.is_active ? "false" : "true"}
        />
        <button
          type="submit"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium hover:bg-[#f4f7f6]"
        >
          {playbook.is_active ? "Desativar roteiro" : "Ativar roteiro"}
        </button>
        {actState.success && (
          <p className="text-xs text-brand">{actState.success}</p>
        )}
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="text-sm font-semibold">Seções detectadas</p>
          <p className="mt-1 text-xs text-ink-muted">
            Como o sistema lê o roteiro (títulos com #).
          </p>
          {sections.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">
              Use linhas começando com # Título
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {sections.map((s) => (
                <li
                  key={s.title}
                  className="rounded-xl border border-line bg-[#f7faf9] px-3 py-2"
                >
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                    {s.body || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-[#0b2f2a] p-5 text-white shadow-[var(--shadow)]">
          <p className="text-sm font-semibold text-accent">Preview no prompt</p>
          <p className="mt-1 text-xs text-white/50">
            Trecho que a IA recebe junto com campos e catálogo.
          </p>
          <pre className="mt-4 max-h-72 overflow-auto text-[11px] leading-relaxed whitespace-pre-wrap text-white/80">
            {`ROTEIRO DE CONVERSA ATIVO ("${playbook.name}"):\nSiga este roteiro com prioridade…\n\n${content.slice(0, 1200)}${content.length > 1200 ? "\n…" : ""}`}
          </pre>
        </div>
      </div>

      <form action={delAction} className="flex justify-end">
        <input type="hidden" name="id" value={playbook.id} />
        <button
          type="submit"
          disabled={delPending}
          className="rounded-lg px-3 py-2 text-xs text-ink-muted hover:bg-red-50 hover:text-red-700"
          onClick={(e) => {
            if (!confirm("Remover este playbook?")) e.preventDefault();
          }}
        >
          {delPending ? "…" : "Excluir playbook"}
        </button>
        {delState.error && (
          <p className="ml-3 self-center text-xs text-red-600">{delState.error}</p>
        )}
      </form>
    </div>
  );
}
