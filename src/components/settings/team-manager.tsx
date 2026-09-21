"use client";

import { useActionState, useState } from "react";
import {
  inviteCollaboratorAction,
  removeCollaboratorAction,
  type TeamActionState,
} from "@/app/actions/team";

const initial: TeamActionState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export type TeamMemberRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  isSelf: boolean;
};

export function TeamManager({
  tenantId,
  members,
  used,
  maxMembers,
  canManage,
}: {
  tenantId: string;
  members: TeamMemberRow[];
  used: number;
  maxMembers: number;
  canManage: boolean;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteCollaboratorAction,
    initial,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeCollaboratorAction,
    initial,
  );
  const [roleHelpOpen, setRoleHelpOpen] = useState(false);

  const remaining = Math.max(0, maxMembers - used);
  const atLimit = remaining <= 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Membros</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Assentos: {used} de {maxMembers}
              {atLimit
                ? " · limite atingido"
                : ` · cabem mais ${remaining}`}
            </p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-deep">
            {used}/{maxMembers}
          </span>
        </div>

        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                  {initials(m.fullName || m.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {m.fullName || m.email || "Usuário"}
                    {m.isSelf ? (
                      <span className="ml-2 text-xs font-normal text-ink-muted">
                        (você)
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-ink-muted">
                    {m.email} · {roleLabel(m.role)}
                  </p>
                </div>
              </div>
              {canManage && !m.isSelf && m.role !== "admin" ? (
                <form action={removeAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <button
                    type="submit"
                    disabled={removePending}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-danger hover:bg-red-50 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {removeState.error ? (
          <p className="px-5 py-3 text-sm text-danger">{removeState.error}</p>
        ) : null}
        {removeState.success ? (
          <p className="px-5 py-3 text-sm text-brand">{removeState.success}</p>
        ) : null}
      </section>

      {canManage ? (
        <section className="h-fit rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)] xl:sticky xl:top-4">
          <h2 className="text-lg font-semibold text-ink">Novo colaborador</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Crie com e-mail e senha provisória. No 1º login a pessoa é obrigada
            a trocar a senha.
          </p>
          <form action={inviteAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="fullName">
                Nome
              </label>
              <input
                id="fullName"
                name="fullName"
                required
                className={field}
                placeholder="Maria Silva"
                disabled={atLimit}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={field}
                placeholder="maria@empresa.com"
                disabled={atLimit}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="password">
                Senha provisória
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                minLength={6}
                autoComplete="off"
                className={field}
                placeholder="mín. 6 caracteres"
                disabled={atLimit}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-sm font-medium" htmlFor="role">
                  Papel
                </label>
                <button
                  type="button"
                  onClick={() => setRoleHelpOpen((v) => !v)}
                  aria-expanded={roleHelpOpen}
                  aria-controls="role-help"
                  title="O que cada papel faz"
                  className={`flex size-5 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                    roleHelpOpen
                      ? "border-brand bg-brand-soft text-brand-deep"
                      : "border-line bg-paper text-ink-muted hover:border-brand/40 hover:text-brand"
                  }`}
                >
                  ?
                </button>
              </div>
              <select
                id="role"
                name="role"
                defaultValue="agent"
                className={field}
                disabled={atLimit}
              >
                <option value="agent">Atendente</option>
                <option value="supervisor">Supervisor</option>
              </select>
              {roleHelpOpen ? (
                <div
                  id="role-help"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink-muted"
                >
                  <p>
                    <span className="font-semibold text-ink">Atendente</span> —
                    conversas, leads e funil. Não altera configurações nem
                    equipe.
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-ink">Supervisor</span> —
                    tudo do atendente + convidar pessoas, empresa, IA e
                    pipeline.
                  </p>
                </div>
              ) : null}
            </div>
            {inviteState.error ? (
              <p className="text-sm text-danger">{inviteState.error}</p>
            ) : null}
            {inviteState.success ? (
              <p className="text-sm text-brand">{inviteState.success}</p>
            ) : null}
            <button
              type="submit"
              disabled={invitePending || atLimit}
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {invitePending ? "Criando…" : "Criar usuário"}
            </button>
            {atLimit ? (
              <p className="text-xs text-ink-muted">
                Limite de assentos atingido. Entre em contato conosco para aumentar o plano.
              </p>
            ) : null}
          </form>
        </section>
      ) : (
        <aside className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-muted">
          Você não tem permissão para convidar colaboradores.
        </aside>
      )}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "agent") return "Atendente";
  return role;
}

function initials(name?: string | null) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
