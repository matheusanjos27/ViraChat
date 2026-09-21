"use server";

import { revalidatePath } from "next/cache";
import { AI_LIMITS, clampSavedText } from "@/lib/ai/limits";
import { requireTenantAdmin } from "@/lib/crm/auth";
import type { BillingType, TierPriceMode } from "@/lib/crm/pricing";

export type ServiceState = {
  error?: string;
  success?: string;
};

function parseMoney(raw: string) {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function clampDescription(raw: string | null) {
  if (!raw) return null;
  return clampSavedText(raw, AI_LIMITS.serviceDescription).value;
}

export async function createService(
  _prev: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const name = String(formData.get("name") ?? "").trim();
  const description = clampDescription(
    String(formData.get("description") ?? "").trim() || null,
  );
  const offerKindRaw = String(formData.get("offerKind") ?? "product");
  const offerKind =
    offerKindRaw === "service" ? ("service" as const) : ("product" as const);
  const billingType = String(formData.get("billingType") ?? "fixed") as BillingType;
  const unitLabel = String(formData.get("unitLabel") ?? "unidade").trim() || "unidade";
  const unitAttributeKey =
    String(formData.get("unitAttributeKey") ?? "").trim() || null;
  const basePrice = parseMoney(String(formData.get("basePrice") ?? "0")) ?? 0;
  const minPriceRaw = String(formData.get("minPrice") ?? "").trim();
  const minPrice = minPriceRaw ? parseMoney(minPriceRaw) : null;
  const isActive = formData.get("isActive") === "on";

  if (!name) return { error: "Informe o nome do item." };
  if (!["fixed", "per_unit", "tiered"].includes(billingType)) {
    return { error: "Tipo de cobrança inválido." };
  }

  const { data: maxSort } = await ctx.supabase
    .from("services")
    .select("sort_order")
    .eq("tenant_id", ctx.membership.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: service, error } = await ctx.supabase
    .from("services")
    .insert({
      tenant_id: ctx.membership.tenant_id,
      name,
      description,
      offer_kind: offerKind,
      billing_type: billingType,
      unit_label: unitLabel,
      unit_attribute_key: unitAttributeKey,
      base_price: basePrice,
      min_price: minPrice,
      is_active: isActive,
      sort_order: (maxSort?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Optional tiers from JSON: [{min,max,price,mode}]
  const tiersJson = String(formData.get("tiersJson") ?? "").trim();
  if (billingType === "tiered" && tiersJson && service) {
    try {
      const tiers = JSON.parse(tiersJson) as {
        min_units: number;
        max_units: number | null;
        price: number;
        price_mode: TierPriceMode;
      }[];
      if (Array.isArray(tiers) && tiers.length > 0) {
        await ctx.supabase.from("service_pricing_tiers").insert(
          tiers.map((t, i) => ({
            service_id: service.id,
            tenant_id: ctx.membership!.tenant_id,
            min_units: t.min_units,
            max_units: t.max_units,
            price: t.price,
            price_mode: t.price_mode ?? "flat",
            sort_order: i,
          })),
        );
      }
    } catch {
      return { error: "Item criado, mas faixas inválidas. Edite as faixas." };
    }
  }

  revalidatePath("/app/settings/services");
  revalidatePath("/app/settings/ai");
  return { success: "Item criado." };
}

export async function updateService(
  _prev: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = clampDescription(
    String(formData.get("description") ?? "").trim() || null,
  );
  const offerKindRaw = String(formData.get("offerKind") ?? "product");
  const offerKind =
    offerKindRaw === "service" ? ("service" as const) : ("product" as const);
  const billingType = String(formData.get("billingType") ?? "fixed") as BillingType;
  const unitLabel = String(formData.get("unitLabel") ?? "unidade").trim() || "unidade";
  const unitAttributeKey =
    String(formData.get("unitAttributeKey") ?? "").trim() || null;
  const basePrice = parseMoney(String(formData.get("basePrice") ?? "0")) ?? 0;
  const minPriceRaw = String(formData.get("minPrice") ?? "").trim();
  const minPrice = minPriceRaw ? parseMoney(minPriceRaw) : null;
  const isActive = formData.get("isActive") === "on";

  if (!id || !name) return { error: "Dados incompletos." };

  const { error } = await ctx.supabase
    .from("services")
    .update({
      name,
      description,
      offer_kind: offerKind,
      billing_type: billingType,
      unit_label: unitLabel,
      unit_attribute_key: unitAttributeKey,
      base_price: basePrice,
      min_price: minPrice,
      is_active: isActive,
    })
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  const tiersJson = String(formData.get("tiersJson") ?? "").trim();
  if (billingType === "tiered" && tiersJson) {
    try {
      const tiers = JSON.parse(tiersJson) as {
        min_units: number;
        max_units: number | null;
        price: number;
        price_mode: TierPriceMode;
      }[];
      await ctx.supabase
        .from("service_pricing_tiers")
        .delete()
        .eq("service_id", id);
      if (Array.isArray(tiers) && tiers.length > 0) {
        await ctx.supabase.from("service_pricing_tiers").insert(
          tiers.map((t, i) => ({
            service_id: id,
            tenant_id: ctx.membership!.tenant_id,
            min_units: t.min_units,
            max_units: t.max_units,
            price: t.price,
            price_mode: t.price_mode ?? "flat",
            sort_order: i,
          })),
        );
      }
    } catch {
      return { error: "Item salvo, mas faixas inválidas." };
    }
  }

  revalidatePath("/app/settings/services");
  revalidatePath("/app/settings/ai");
  return { success: "Item atualizado." };
}

export async function deleteService(
  _prev: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Serviço inválido." };

  const { error } = await ctx.supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/services");
  revalidatePath("/app/settings/ai");
  return { success: "Serviço removido." };
}

export async function toggleServiceActive(
  _prev: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) return { error: "Serviço inválido." };

  const { error } = await ctx.supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/services");
  revalidatePath("/app/settings/ai");
  return { success: isActive ? "Ativado." : "Desativado." };
}
