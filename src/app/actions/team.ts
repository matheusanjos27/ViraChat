"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inviteUserToTenant, type InviteRole } from "@/lib/team/invite";

export type TeamActionState = {
  error?: string;
  success?: string;
};

async function requireTenantAdmin(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." as const, user: null, supabase };
  }

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!membership || !["admin", "supervisor"].includes(membership.role)) {
    return {
      error: "Sem permissão para gerenciar a equipe." as const,
      user,
      supabase,
    };
  }

  return { error: null, user, supabase };
}

export async function inviteCollaboratorAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const role = String(formData.get("role") ?? "agent") as InviteRole;
  const password = String(formData.get("password") ?? "").trim();

  const gate = await requireTenantAdmin(tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }

  // Company invites: collaborator roles only (not another admin by default — allow supervisor/agent)
  if (!["agent", "supervisor"].includes(role)) {
    return { error: "Convide como Atendente ou Supervisor." };
  }

  if (!password || password.length < 6) {
    return { error: "Informe uma senha provisória (mín. 6 caracteres)." };
  }

  const result = await inviteUserToTenant({
    tenantId,
    email,
    fullName,
    role,
    password,
    invitedByUserId: gate.user.id,
    enforceSeatLimit: true,
  });

  revalidatePath("/app/settings/team");
  return result;
}

export async function removeCollaboratorAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const gate = await requireTenantAdmin(tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }

  if (!userId) return { error: "Usuário inválido." };
  if (userId === gate.user.id) {
    return { error: "Você não pode remover a si mesmo." };
  }

  const { data: target } = await gate.supabase
    .from("user_tenant_roles")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!target) return { error: "Colaborador não encontrado." };
  if (target.role === "admin") {
    return { error: "Não é possível remover o administrador da empresa." };
  }

  const { error } = await gate.supabase
    .from("user_tenant_roles")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  revalidatePath("/app/settings/team");
  return { success: "Colaborador removido." };
}
