"use client";

import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  platformAssignTenantPlan,
  platformCreatePlan,
  platformUpdatePlan,
  type PlatformState,
} from "@/app/actions/platform";

const initial: PlatformState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export type PlanRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  max_members: number;
  max_channels: number;
  max_ai_replies_month: number;
  is_custom: boolean;
};

function formatReplies(n: number) {
  if (n <= 0) return "Ilimitado";
  return n.toLocaleString("pt-BR");
}

function PlanFormFields({
  plan,
  defaults,
}: {
  plan?: PlanRow;
  defaults?: { members: number; channels: number; replies: number };
}) {
  const d = defaults ?? { members: 2, channels: 1, replies: 500 };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <label className="text-sm font-medium">Nome</label>
        <input
          name="name"
          required
          defaultValue={plan?.name}
          placeholder="Ex: Starter, Pro, KM Escala"
          className={field}
        />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <label className="text-sm font-medium">Descrição (opcional)</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={plan?.description ?? ""}
          placeholder="O que inclui este plano"
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Máx. equipe</label>
        <input
          name="maxMembers"
          type="number"
          min={1}
          max={500}
          defaultValue={plan?.max_members ?? d.members}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Máx. WhatsApps</label>
        <input
          name="maxChannels"
          type="number"
          min={1}
          max={100}
          defaultValue={plan?.max_channels ?? d.channels}
          className={field}
        />
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1.5">
        <label className="text-sm font-medium">Respostas IA / mês</label>
        <input
          name="maxAiReplies"
          type="number"
          min={0}
          defaultValue={plan?.max_ai_replies_month ?? d.replies}
          className={field}
        />
      </div>
    </div>
  );
}

function PlanModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:bg-paper"
          >
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreatePlanModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(platformCreatePlan, initial);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  return (
    <PlanModalShell
      title="Novo plano"
      subtitle="Defina nome e limites. Depois atribua em Clientes."
      onClose={onClose}
    >
      <form action={action} className="mt-4 space-y-4">
        <PlanFormFields />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? "Criando…" : "Criar plano"}
        </button>
      </form>
    </PlanModalShell>
  );
}

function EditPlanModal({
  plan,
  onClose,
}: {
  plan: PlanRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(platformUpdatePlan, initial);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  return (
    <PlanModalShell
      title="Editar plano"
      subtitle={
        plan.is_custom
          ? `${plan.slug} · personalizado (overrides por cliente)`
          : plan.slug
      }
      onClose={onClose}
    >
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="planId" value={plan.id} />
        <PlanFormFields plan={plan} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>
    </PlanModalShell>
  );
}

export function PlansEditor({ plans }: { plans: PlanRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          {plans.length} plano{plans.length === 1 ? "" : "s"} no catálogo
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          Criar plano
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Equipe</th>
              <th className="px-4 py-3">WhatsApps</th>
              <th className="px-4 py-3">IA / mês</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-ink-muted"
                >
                  Nenhum plano ainda. Crie o primeiro.
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-line last:border-0 hover:bg-surface/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-ink-muted">
                      {p.slug}
                      {p.is_custom ? " · personalizado" : ""}
                    </p>
                    {p.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                        {p.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.max_members}</td>
                  <td className="px-4 py-3 tabular-nums">{p.max_channels}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatReplies(p.max_ai_replies_month)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen ? (
        <CreatePlanModal onClose={() => setCreateOpen(false)} />
      ) : null}
      {editing ? (
        <EditPlanModal plan={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

export function AssignTenantPlanForm({
  tenants,
  plans,
}: {
  tenants: {
    id: string;
    name: string;
    plan_id: string | null;
    custom_max_members: number | null;
    custom_max_channels: number | null;
    custom_max_ai_replies_month: number | null;
  }[];
  plans: PlanRow[];
}) {
  const [state, action, pending] = useActionState(
    platformAssignTenantPlan,
    initial,
  );
  const [selectedPlanByTenant, setSelectedPlanByTenant] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      tenants.map((t) => [
        t.id,
        t.plan_id ?? plans.find((p) => p.slug === "basico")?.id ?? "",
      ]),
    ),
  );

  const customPlanId = useMemo(
    () => plans.find((p) => p.is_custom)?.id ?? "",
    [plans],
  );

  if (tenants.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhum cliente.</p>;
  }

  return (
    <div className="space-y-4">
      {tenants.map((t) => {
        const planId = selectedPlanByTenant[t.id] ?? "";
        const isCustom = planId === customPlanId;
        return (
          <form
            key={t.id}
            action={action}
            className="rounded-xl border border-line bg-paper px-3 py-3"
          >
            <input type="hidden" name="tenantId" value={t.id} />
            <p className="text-sm font-medium">{t.name}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-ink-muted">Plano</label>
                <select
                  name="planId"
                  className={`${field} mt-1`}
                  value={planId}
                  onChange={(e) =>
                    setSelectedPlanByTenant((prev) => ({
                      ...prev,
                      [t.id]: e.target.value,
                    }))
                  }
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {isCustom ? (
                <>
                  <div>
                    <label className="text-xs text-ink-muted">Equipe</label>
                    <input
                      name="customMaxMembers"
                      type="number"
                      min={1}
                      defaultValue={t.custom_max_members ?? 10}
                      className={`${field} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted">WhatsApps</label>
                    <input
                      name="customMaxChannels"
                      type="number"
                      min={1}
                      defaultValue={t.custom_max_channels ?? 10}
                      className={`${field} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-muted">
                      Respostas IA/mês
                    </label>
                    <input
                      name="customMaxAiReplies"
                      type="number"
                      min={0}
                      defaultValue={t.custom_max_ai_replies_month ?? 5000}
                      className={`${field} mt-1`}
                    />
                  </div>
                </>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              Aplicar
            </button>
          </form>
        );
      })}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
    </div>
  );
}
