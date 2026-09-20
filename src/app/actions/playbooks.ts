"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_PLAYBOOK_CONTENT } from "@/lib/crm/playbook";
import { requireTenantAdmin } from "@/lib/crm/auth";

export type PlaybookState = {
  error?: string;
  success?: string;
};

export async function savePlaybook(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const trigger = String(formData.get("trigger") ?? "new_contact") as
    | "new_contact"
    | "keyword"
    | "manual";
  const triggerKeyword =
    String(formData.get("triggerKeyword") ?? "").trim() || null;
  const content = String(formData.get("content") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!name) return { error: "Informe o nome do playbook." };
  if (!content) return { error: "O roteiro não pode ficar vazio." };
  if (trigger === "keyword" && !triggerKeyword) {
    return { error: "Informe a palavra-chave do gatilho." };
  }

  if (id) {
    const { error } = await ctx.supabase
      .from("playbooks")
      .update({
        name,
        trigger,
        trigger_keyword: triggerKeyword,
        content,
        is_active: isActive,
      })
      .eq("id", id)
      .eq("tenant_id", ctx.membership.tenant_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("playbooks").insert({
      tenant_id: ctx.membership.tenant_id,
      name,
      trigger,
      trigger_keyword: triggerKeyword,
      content,
      is_active: isActive,
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/app/settings/playbook");
  return { success: "Playbook salvo." };
}

export async function createPlaybookFromTemplate(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const name =
    String(formData.get("name") ?? "").trim() || "Novo roteiro comercial";

  const { error } = await ctx.supabase.from("playbooks").insert({
    tenant_id: ctx.membership.tenant_id,
    name,
    trigger: "manual",
    is_active: false,
    content: DEFAULT_PLAYBOOK_CONTENT,
  });

  if (error) return { error: error.message };

  revalidatePath("/app/settings/playbook");
  return { success: "Playbook criado a partir do template." };
}

export async function deletePlaybook(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Playbook inválido." };

  const { count } = await ctx.supabase
    .from("playbooks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.membership.tenant_id);

  if ((count ?? 0) <= 1) {
    return { error: "Mantenha pelo menos um playbook." };
  }

  const { error } = await ctx.supabase
    .from("playbooks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/playbook");
  return { success: "Playbook removido." };
}

export async function setPlaybookActive(
  _prev: PlaybookState,
  formData: FormData,
): Promise<PlaybookState> {
  const ctx = await requireTenantAdmin();
  if (ctx.error || !ctx.membership) return { error: ctx.error ?? "Erro" };

  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (!id) return { error: "Playbook inválido." };

  const { error } = await ctx.supabase
    .from("playbooks")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("tenant_id", ctx.membership.tenant_id);

  if (error) return { error: error.message };

  revalidatePath("/app/settings/playbook");
  return { success: isActive ? "Ativado." : "Desativado." };
}
