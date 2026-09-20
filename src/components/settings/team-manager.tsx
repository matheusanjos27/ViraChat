"use client";

import { useActionState } from "react";
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

  const remaining = Math.max(0, maxMembers - used);
  const atLimit = remaining <= 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand/15 bg-brand-soft/60 px-4 py-3 text-sm text-brand-deep">
        <p className="font-semibold">
          Assentos: {used} de {maxMembers} em uso
        </p>
        <p className="mt-1 text-brand-deep/80">
          Padrão da plataforma: empresa + 1 colaborador. O super admin pode
          aumentar o limite.
          {atLimit
            ? " Limite atingido — não é possível convidar agora."
            : ` Ainda cabem ${remaining}.`}
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        <h2 className="text-lg font-semibold">Equipe</h2>
        <ul className="mt-4 divide-y divide-line">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
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
              {canManage && !m.isSelf && m.role !== "admin" ? (
                <form action={removeAction}>
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <button
                    type="submit"
                    disabled={removePending}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Remover
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {removeState.error ? (
          <p className="mt-2 text-sm text-red-600">{removeState.error}</p>
        ) : null}
        {removeState.success ? (
          <p className="mt-2 text-sm text-brand">{removeState.success}</p>
        ) : null}
      </section>

      {canManage ? (
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Convidar colaborador</h2>
          <p className="mt-1 text-sm text-ink-muted">
            A pessoa recebe um e-mail, define a senha e acessa só esta empresa.
          </p>
          <form action={inviteAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>
            <div className="flex flex-col gap-1.5 sm:max-w-xs">
              <label className="text-sm font-medium" htmlFor="role">
                Papel
              </label>
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
            </div>
            {inviteState.error ? (
              <p className="text-sm text-red-600">{inviteState.error}</p>
            ) : null}
            {inviteState.success ? (
              <p className="text-sm text-brand">{inviteState.success}</p>
            ) : null}
            <button
              type="submit"
              disabled={invitePending || atLimit}
              className="w-fit rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {invitePending ? "Enviando…" : "Enviar convite"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Administrador";
  if (role === "supervisor") return "Supervisor";
  if (role === "agent") return "Atendente";
  return role;
}
