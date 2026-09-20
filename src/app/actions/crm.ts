"use server";

import { revalidatePath } from "next/cache";
import { slugifyAttributeKey } from "@/lib/crm/attributes";
import { requireTenantAdmin, requireTenantMembership } from "@/lib/crm/auth";

export type CrmState = {
  error?: string;
  success?: string;
};

export async function createContactAttribute(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const label = String(formData.get("label") ?? "").trim();
  const type = String(formData.get("type") ?? "text") as
    | "text"
    | "number"
    | "select"
    | "date"
    | "email"
    | "phone";
  const key =
    String(formData.get("key") ?? "").trim() || slugifyAttributeKey(label);
  const required = formData.get("required") === "on";
  const collectViaAi = formData.get("collectViaAi") === "on";
  const optionsRaw = String(formData.get("options") ?? "").trim();
  const options = optionsRaw
    ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (!label) return { error: "Informe o nome do campo." };

  const { data: maxSort } = await ctx.supabase
    .from("contact_attributes")
    .select("sort_order")
    .eq("tenant_id", ctx.membership.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("contact_attributes").insert({
    tenant_id: ctx.membership.tenant_id,
    key,
    label,
    type,
    options,
    required,
    collect_via_ai: collectViaAi,
    sort_order: (maxSort?.sort_order ?? -1) + 1,
  });

  if (error) {
    if (error.code === "23505") return { error: "Já existe um campo com essa chave." };
    return { error: error.message };
  }

  revalidatePath("/app/settings/fields");
  revalidatePath("/app/leads");
  return { success: "Campo criado." };
}

export async function deleteContactAttribute(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Campo inválido." };

  const { error } = await ctx.supabase
    .from("contact_attributes")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/fields");
  revalidatePath("/app/leads");
  return { success: "Campo removido." };
}

export async function updateContactAttributeValue(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantMembership();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const contactId = String(formData.get("contactId") ?? "");
  const attributeId = String(formData.get("attributeId") ?? "");
  const value = String(formData.get("value") ?? "").trim() || null;

  if (!contactId || !attributeId) return { error: "Dados incompletos." };

  const { error } = await ctx.supabase.from("contact_attribute_values").upsert(
    {
      tenant_id: ctx.membership.tenant_id,
      contact_id: contactId,
      attribute_id: attributeId,
      value,
    },
    { onConflict: "contact_id,attribute_id" },
  );

  if (error) return { error: error.message };

  revalidatePath("/app/leads");
  return { success: "Salvo." };
}

export async function createDealStage(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#0c6b5c").trim() || "#0c6b5c";
  if (!name) return { error: "Informe o nome da etapa." };

  const { data: maxSort } = await ctx.supabase
    .from("deal_stages")
    .select("sort_order")
    .eq("tenant_id", ctx.membership.tenant_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("deal_stages").insert({
    tenant_id: ctx.membership.tenant_id,
    name,
    color,
    sort_order: (maxSort?.sort_order ?? -1) + 1,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/settings/pipeline");
  revalidatePath("/app/deals");
  return { success: "Etapa criada." };
}

export async function updateDealStage(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const isClosedWon = formData.get("isClosedWon") === "on";
  const isClosedLost = formData.get("isClosedLost") === "on";

  if (!id || !name) return { error: "Dados incompletos." };

  const { error } = await ctx.supabase
    .from("deal_stages")
    .update({
      name,
      color: color || undefined,
      is_closed_won: isClosedWon,
      is_closed_lost: isClosedLost,
    })
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/pipeline");
  revalidatePath("/app/deals");
  return { success: "Etapa atualizada." };
}

export async function deleteDealStage(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Etapa inválida." };

  const { count } = await ctx.supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("stage_id", id);

  if ((count ?? 0) > 0) {
    return { error: "Há deals nesta etapa. Mova-os antes de excluir." };
  }

  const { error } = await ctx.supabase
    .from("deal_stages")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/pipeline");
  revalidatePath("/app/deals");
  return { success: "Etapa removida." };
}

export async function moveDeal(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantMembership();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const dealId = String(formData.get("dealId") ?? "");
  const stageId = String(formData.get("stageId") ?? "");
  if (!dealId || !stageId) return { error: "Dados incompletos." };

  const { error } = await ctx.supabase
    .from("deals")
    .update({ stage_id: stageId })
    .eq("id", dealId)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/deals");
  revalidatePath("/app/leads");
  return { success: "Deal movido." };
}

export async function createDeal(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantMembership();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const contactId = String(formData.get("contactId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const valueRaw = String(formData.get("value") ?? "").trim();
  const stageId = String(formData.get("stageId") ?? "");
  const conversationId = String(formData.get("conversationId") ?? "") || null;

  if (!contactId || !title) return { error: "Informe contato e título." };

  let resolvedStageId = stageId;
  if (!resolvedStageId) {
    const { data: first } = await ctx.supabase
      .from("deal_stages")
      .select("id")
      .eq("tenant_id", ctx.membership.tenant_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    resolvedStageId = first?.id ?? "";
  }

  if (!resolvedStageId) {
    return { error: "Configure o funil em Configurações → Pipeline." };
  }

  const value = valueRaw ? Number(valueRaw.replace(",", ".")) : null;

  const { error } = await ctx.supabase.from("deals").insert({
    tenant_id: ctx.membership.tenant_id,
    contact_id: contactId,
    conversation_id: conversationId,
    stage_id: resolvedStageId,
    title,
    value: Number.isFinite(value) ? value : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/deals");
  revalidatePath("/app/leads");
  return { success: "Deal criado." };
}

export async function updateDealValue(
  _prev: CrmState,
  formData: FormData,
): Promise<CrmState> {
  const ctx = await requireTenantMembership();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const dealId = String(formData.get("dealId") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim();
  if (!dealId) return { error: "Deal inválido." };

  const value = valueRaw ? Number(valueRaw.replace(",", ".")) : null;

  const { error } = await ctx.supabase
    .from("deals")
    .update({ value: Number.isFinite(value) ? value : null })
    .eq("id", dealId)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/deals");
  return { success: "Valor atualizado." };
}
