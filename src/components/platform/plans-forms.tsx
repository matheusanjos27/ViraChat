"use client";

import { useActionState, useMemo, useState } from "react";
import {
  platformAssignTenantPlan,
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

export function PlansEditor({ plans }: { plans: PlanRow[] }) {
  const [state, action, pending] = useActionState(platformUpdatePlan, initial);

  return (
    <div className="space-y-4">
      {plans.map((p) => (
        <form
          key={p.id}
          action={action}
          className="rounded-2xl border border-line bg-paper p-4"
        >
          <input type="hidden" name="planId" value={p.id} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {p.slug}
              {p.is_custom ? " · personalizado" : ""}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-ink-muted">Nome</label>
              <input
                name="name"
                required
                defaultValue={p.name}
                className={`${field} mt-1`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-ink-muted">
                Descrição
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={p.description ?? ""}
                className={`${field} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">
                Máx. equipe
              </label>
              <input
                name="maxMembers"
                type="number"
                min={1}
                max={500}
                defaultValue={p.max_members}
                className={`${field} mt-1`}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-muted">
                Máx. WhatsApps
              </label>
              <input
                name="maxChannels"
                type="number"
                min={1}
                max={100}
                defaultValue={p.max_channels}
                className={`${field} mt-1`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-ink-muted">
                Respostas IA / mês
              </label>
              <input
                name="maxAiReplies"
                type="number"
                min={0}
                defaultValue={p.max_ai_replies_month}
                className={`${field} mt-1`}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Salvar plano"}
          </button>
        </form>
      ))}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
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
