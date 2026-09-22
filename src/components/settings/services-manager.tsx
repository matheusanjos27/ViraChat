"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createService,
  deleteService,
  updateService,
  type ServiceState,
} from "@/app/actions/services";
import {
  formatQuoteMessage,
  quoteCatalog,
  type BillingType,
  type OfferKind,
  type ServiceForQuote,
  type TierPriceMode,
} from "@/lib/crm/pricing";

const empty: ServiceState = {};
const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

type AttrOption = { key: string; label: string };

type TierDraft = {
  min_units: number;
  max_units: number | null;
  price: number;
  price_mode: TierPriceMode;
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function billingLabel(t: BillingType) {
  if (t === "fixed") return "Fixo";
  if (t === "per_unit") return "Por unidade";
  return "Por faixas";
}

export function ServicesManager({
  services,
  attributeKeys,
}: {
  services: ServiceForQuote[];
  attributeKeys: AttrOption[];
}) {
  const [units, setUnits] = useState(10);
  const [selected, setSelected] = useState<string[]>(
    services.filter((s) => s.is_active).map((s) => s.id),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const quote = useMemo(
    () => quoteCatalog(services, units, selected),
    [services, units, selected],
  );

  function toggleSelected(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold text-ink">Catálogo</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {services.length} itens — produto ou serviço
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Criar item
            </button>
          </div>
          {services.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-ink-muted">
                Nenhum item ainda. Cadastre o primeiro produto ou serviço.
              </p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-4 inline-flex rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper"
              >
                Criar item
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {services.map((s) => (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{s.name}</p>
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                          {s.offer_kind === "service" ? "Serviço" : "Produto"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            s.is_active
                              ? "bg-brand-soft text-brand-deep"
                              : "bg-paper text-ink-muted"
                          }`}
                        >
                          {s.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">
                        {s.billing_type === "fixed" && money(s.base_price)}
                        {s.billing_type === "per_unit" &&
                          `${money(s.base_price)}/${s.unit_label}`}
                        {s.billing_type === "tiered" &&
                          `${s.tiers.length} faixa(s)`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId(editingId === s.id ? null : s.id)
                      }
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper"
                    >
                      {editingId === s.id ? "Fechar" : "Editar"}
                    </button>
                  </div>
                  {editingId === s.id ? (
                    <div className="mt-4 border-t border-line pt-4">
                      <ServiceForm
                        mode="edit"
                        service={s}
                        attributeKeys={attributeKeys}
                        action={updateService}
                      />
                      <DeleteButton id={s.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {createOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="novo-servico-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setCreateOpen(false);
            }}
          >
            <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <h2
                    id="novo-servico-title"
                    className="text-lg font-semibold text-ink"
                  >
                    Novo item
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    Fixo, por unidade ou por faixas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="size-8 rounded-full text-ink-muted hover:bg-paper"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto p-5">
                <ServiceForm
                  mode="create"
                  attributeKeys={attributeKeys}
                  action={createService}
                  onSuccess={() => setCreateOpen(false)}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] xl:sticky xl:top-4">
        <p className="text-sm font-semibold text-ink">Simulador</p>
        <p className="mt-1 text-xs text-ink-muted">
          Prévia rápida do orçamento que a IA pode usar.
        </p>
        <label className="mt-3 block text-xs font-medium text-ink-muted">
          Unidades
        </label>
        <input
          type="number"
          min={1}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value) || 1)}
          className={`${field} mt-1`}
        />
        <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {services
            .filter((s) => s.is_active)
            .map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 text-xs text-ink-body"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggleSelected(s.id)}
                  className="size-3.5 accent-[var(--brand)]"
                />
                {s.name}
              </label>
            ))}
        </div>
        <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-paper p-3 text-[11px] leading-relaxed text-ink-muted whitespace-pre-wrap">
          {formatQuoteMessage(quote, units)}
        </pre>
      </aside>
    </div>
  );
}
function DeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteService, empty);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg px-3 py-1.5 text-xs text-ink-muted hover:bg-red-50 hover:text-red-700"
      >
        {pending ? "…" : "Remover"}
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function ServiceForm({
  mode,
  service,
  attributeKeys,
  action,
  onSuccess,
}: {
  mode: "create" | "edit";
  service?: ServiceForQuote;
  attributeKeys: AttrOption[];
  action: (
    prev: ServiceState,
    formData: FormData,
  ) => Promise<ServiceState>;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, empty);
  const [billingType, setBillingType] = useState<BillingType>(
    service?.billing_type ?? "fixed",
  );
  const [offerKind, setOfferKind] = useState<OfferKind>(
    service?.offer_kind ?? "product",
  );
  const [tiers, setTiers] = useState<TierDraft[]>(
    service?.tiers?.length
      ? service.tiers.map((t) => ({
          min_units: t.min_units,
          max_units: t.max_units,
          price: t.price,
          price_mode: t.price_mode,
        }))
      : [
          { min_units: 1, max_units: 15, price: 300, price_mode: "flat" },
          { min_units: 16, max_units: null, price: 10, price_mode: "per_unit" },
        ],
  );

  useEffect(() => {
    if (state.success) onSuccess?.();
  }, [state.success, onSuccess]);

  function updateTier(i: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {service && <input type="hidden" name="id" value={service.id} />}
      <input type="hidden" name="tiersJson" value={JSON.stringify(tiers)} />
      <input type="hidden" name="billingType" value={billingType} />
      <input type="hidden" name="offerKind" value={offerKind} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Nome</label>
          <input
            name="name"
            required
            defaultValue={service?.name}
            className={`${field} mt-1`}
            placeholder="Ex: Plano mensal, Consultoria, Produto X"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Descrição</label>
          <input
            name="description"
            defaultValue={service?.description ?? ""}
            className={`${field} mt-1`}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select
            value={offerKind}
            onChange={(e) => setOfferKind(e.target.value as OfferKind)}
            className={`${field} mt-1`}
          >
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Tipo de cobrança</label>
          <select
            value={billingType}
            onChange={(e) => setBillingType(e.target.value as BillingType)}
            className={`${field} mt-1`}
          >
            <option value="fixed">Valor fixo</option>
            <option value="per_unit">Por unidade</option>
            <option value="tiered">Por faixas</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Rótulo da unidade</label>
          <input
            name="unitLabel"
            defaultValue={service?.unit_label ?? "unidade"}
            className={`${field} mt-1`}
            placeholder="unidade, sessão, licença…"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Campo que define a qtd.</label>
          <select
            name="unitAttributeKey"
            defaultValue={service?.unit_attribute_key ?? ""}
            className={`${field} mt-1`}
          >
            <option value="">— manual / perguntar —</option>
            {attributeKeys.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label} ({a.key})
              </option>
            ))}
          </select>
        </div>
        {(billingType === "fixed" || billingType === "per_unit") && (
          <div>
            <label className="text-sm font-medium">
              {billingType === "fixed" ? "Preço" : "Preço por unidade"}
            </label>
            <input
              name="basePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={service?.base_price ?? 0}
              className={`${field} mt-1`}
            />
          </div>
        )}
        {billingType === "per_unit" && (
          <div>
            <label className="text-sm font-medium">Mínimo (opcional)</label>
            <input
              name="minPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={service?.min_price ?? ""}
              className={`${field} mt-1`}
              placeholder="Ex: 100"
            />
          </div>
        )}
        {billingType === "tiered" && (
          <input type="hidden" name="basePrice" value="0" />
        )}
      </div>

      {billingType === "tiered" && (
        <div className="rounded-xl border border-line bg-[#f7faf9] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Faixas</p>
            <button
              type="button"
              onClick={() =>
                setTiers((prev) => [
                  ...prev,
                  {
                    min_units: (prev[prev.length - 1]?.max_units ?? 0) + 1,
                    max_units: null,
                    price: 0,
                    price_mode: "per_unit",
                  },
                ])
              }
              className="text-xs font-medium text-brand"
            >
              + Faixa
            </button>
          </div>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <input
                  type="number"
                  value={t.min_units}
                  onChange={(e) =>
                    updateTier(i, { min_units: Number(e.target.value) || 0 })
                  }
                  className={field}
                  placeholder="De"
                />
                <input
                  type="number"
                  value={t.max_units ?? ""}
                  onChange={(e) =>
                    updateTier(i, {
                      max_units: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className={field}
                  placeholder="Até (vazio = ∞)"
                />
                <input
                  type="number"
                  step="0.01"
                  value={t.price}
                  onChange={(e) =>
                    updateTier(i, { price: Number(e.target.value) || 0 })
                  }
                  className={field}
                  placeholder="Preço"
                />
                <select
                  value={t.price_mode}
                  onChange={(e) =>
                    updateTier(i, {
                      price_mode: e.target.value as TierPriceMode,
                    })
                  }
                  className={field}
                >
                  <option value="flat">Fixo na faixa</option>
                  <option value="per_unit">Por unidade</option>
                </select>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-xl text-xs text-ink-muted hover:text-red-600"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={service?.is_active ?? true}
          className="size-4 accent-[var(--brand)]"
        />
        Ativo (visível para a IA)
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending
          ? "Salvando…"
          : mode === "create"
            ? "Criar item"
            : "Salvar alterações"}
      </button>
    </form>
  );
}
