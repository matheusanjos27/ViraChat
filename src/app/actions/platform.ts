"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
import { inviteUserToTenant, type InviteRole } from "@/lib/team/invite";
import { createClient } from "@/lib/supabase/server";

export type PlatformState = {
  error?: string;
  success?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function platformCreateTenant(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin pode criar tenants." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);
  const maxMembers = Math.min(
    500,
    Math.max(1, Number.parseInt(String(formData.get("maxMembers") ?? "2"), 10) || 2),
  );
  if (!name || !slug) return { error: "Informe o nome da empresa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") {
      return { error: "Slug já em uso." };
    }
    return { error: error.message };
  }

  // Plano: do form ou Básico por padrão
  {
    const admin = createServiceClient();
    const planIdFromForm = String(formData.get("planId") ?? "").trim();
    let plan =
      planIdFromForm
        ? (
            await admin
              .from("plans")
              .select("id, max_members, is_custom")
              .eq("id", planIdFromForm)
              .maybeSingle()
          ).data
        : null;
    if (!plan) {
      const { data: basico } = await admin
        .from("plans")
        .select("id, max_members, is_custom")
        .eq("slug", "basico")
        .maybeSingle();
      plan = basico;
    }
    if (plan) {
      await admin
        .from("tenants")
        .update({
          plan_id: plan.id,
          max_members: maxMembers !== 2 ? maxMembers : plan.max_members,
        })
        .eq("slug", slug);
    } else if (maxMembers !== 2) {
      await admin.from("tenants").update({ max_members: maxMembers }).eq("slug", slug);
    }
  }

  const feeReais = Number.parseFloat(
    String(formData.get("monthlyFee") ?? "0").replace(",", "."),
  );
  const feeCents = Number.isFinite(feeReais)
    ? Math.max(0, Math.round(feeReais * 100))
    : 0;
  const billingStatus = String(formData.get("billingStatus") ?? "trial");
  if (feeCents > 0 || billingStatus !== "active") {
    const admin = createServiceClient();
    await admin
      .from("tenants")
      .update({
        monthly_fee_cents: feeCents,
        billing_status:
          billingStatus === "trial" ||
          billingStatus === "past_due" ||
          billingStatus === "canceled"
            ? billingStatus
            : "active",
      })
      .eq("slug", slug);
  }

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/finance");

  const admin = createServiceClient();
  const { data: created } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (created?.id) {
    redirect(`/platform/tenants/${created.id}`);
  }
  return { success: `Tenant “${name}” criado (${maxMembers} assentos).` };
}

export async function platformUpdateTenantBilling(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  if (!tenantId) return { error: "Tenant inválido." };

  const feeReais = Number.parseFloat(
    String(formData.get("monthlyFee") ?? "0").replace(",", "."),
  );
  const feeCents = Number.isFinite(feeReais)
    ? Math.max(0, Math.round(feeReais * 100))
    : 0;
  const billingStatus = String(formData.get("billingStatus") ?? "active");
  const status =
    billingStatus === "trial" ||
    billingStatus === "past_due" ||
    billingStatus === "canceled"
      ? billingStatus
      : "active";

  const admin = createServiceClient();
  const { error } = await admin
    .from("tenants")
    .update({ monthly_fee_cents: feeCents, billing_status: status })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/finance");
  return { success: "Financeiro do cliente atualizado." };
}

export async function platformUpdateTenantSeats(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const maxMembers = Math.min(
    500,
    Math.max(1, Number.parseInt(String(formData.get("maxMembers") ?? "2"), 10) || 2),
  );
  if (!tenantId) return { error: "Tenant inválido." };

  const admin = createServiceClient();
  const { error } = await admin
    .from("tenants")
    .update({ max_members: maxMembers })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  return { success: `Limite atualizado para ${maxMembers} colaboradores.` };
}

export async function platformUpdateTenantAiBudget(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const millions = Number.parseFloat(
    String(formData.get("tokenLimitMillions") ?? "2").replace(",", "."),
  );
  // 0 = ilimitado; senão N milhões de tokens
  const monthly_ai_token_limit = !Number.isFinite(millions)
    ? 2_000_000
    : millions <= 0
      ? 0
      : Math.round(millions * 1_000_000);

  if (!tenantId) return { error: "Tenant inválido." };

  const admin = createServiceClient();
  const { error } = await admin
    .from("tenants")
    .update({ monthly_ai_token_limit })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/usage");
  return {
    success:
      monthly_ai_token_limit === 0
        ? "Cota de IA: ilimitada."
        : `Cota de IA: ${(monthly_ai_token_limit / 1_000_000).toFixed(1)}M tokens/mês.`,
  };
}

export async function platformInviteTenantUser(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin pode convidar." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "admin") as InviteRole;
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const result = await inviteUserToTenant({
    tenantId,
    email,
    fullName,
    role,
    password: password || undefined,
    invitedByUserId: actor?.id ?? null,
    enforceSeatLimit: true,
  });

  revalidatePath("/platform");
  revalidatePath("/platform/invites");
  revalidatePath("/platform/tenants");
  if (tenantId) revalidatePath(`/platform/tenants/${tenantId}`);
  return result;
}

export async function platformCancelInvite(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) return { error: "Convite inválido." };

  const admin = createServiceClient();
  const { data: invite, error: fetchError } = await admin
    .from("tenant_invites")
    .select("id, email, tenant_id, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!invite) return { error: "Convite não encontrado." };

  const email = invite.email.trim().toLowerCase();

  // Resolve usuário via profile (mais confiável que listUsers paginado)
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let authUserId = profile?.id ?? null;
  if (!authUserId) {
    const { data: listed } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    authUserId =
      listed?.users?.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  }

  if (authUserId) {
    await admin
      .from("user_tenant_roles")
      .delete()
      .eq("tenant_id", invite.tenant_id)
      .eq("user_id", authUserId);

    const { count } = await admin
      .from("user_tenant_roles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId);

    if ((count ?? 0) === 0) {
      await admin.from("platform_admins").delete().eq("user_id", authUserId);
      await admin.from("profiles").delete().eq("id", authUserId);
      await admin.auth.admin.deleteUser(authUserId);
    }
  }

  const { error: delError } = await admin
    .from("tenant_invites")
    .delete()
    .eq("id", inviteId);

  if (delError) return { error: delError.message };

  revalidatePath("/platform/invites");
  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${invite.tenant_id}`);
  return {
    success: invite.accepted_at
      ? `Acesso de ${email} removido.`
      : `Convite de ${email} excluído.`,
  };
}

export async function platformUpdateTenantMember(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "agent") as InviteRole;
  const password = String(formData.get("password") ?? "").trim();

  if (!tenantId || !userId) return { error: "Membro inválido." };
  if (!["admin", "supervisor", "agent"].includes(role)) {
    return { error: "Papel inválido." };
  }
  if (password && password.length < 6) {
    return { error: "Senha provisória: mínimo 6 caracteres." };
  }

  const admin = createServiceClient();
  const { data: membership } = await admin
    .from("user_tenant_roles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { error: "Usuário não pertence a este cliente." };

  const { error: roleError } = await admin
    .from("user_tenant_roles")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (roleError) return { error: roleError.message };

  if (fullName) {
    await admin
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);
  }

  const authPatch: {
    password?: string;
    user_metadata?: Record<string, unknown>;
  } = {};
  if (password) {
    authPatch.password = password;
    authPatch.user_metadata = { must_change_password: true };
  }
  if (fullName) {
    authPatch.user_metadata = {
      ...(authPatch.user_metadata ?? {}),
      full_name: fullName,
    };
  }
  if (Object.keys(authPatch).length > 0) {
    const { data: existing } = await admin.auth.admin.getUserById(userId);
    const { error: authError } = await admin.auth.admin.updateUserById(userId, {
      ...authPatch,
      user_metadata: {
        ...(existing?.user?.user_metadata ?? {}),
        ...(authPatch.user_metadata ?? {}),
      },
    });
    if (authError) return { error: authError.message };
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${tenantId}`);
  return {
    success: password
      ? "Membro atualizado. Nova senha provisória definida (troca no 1º login)."
      : "Membro atualizado.",
  };
}

export async function platformRemoveTenantMember(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!tenantId || !userId) return { error: "Membro inválido." };

  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  const { error: delRole } = await admin
    .from("user_tenant_roles")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (delRole) return { error: delRole.message };

  if (profile?.email) {
    await admin
      .from("tenant_invites")
      .delete()
      .eq("tenant_id", tenantId)
      .ilike("email", profile.email);
  }

  const { count } = await admin
    .from("user_tenant_roles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) === 0) {
    await admin.from("platform_admins").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }

  revalidatePath("/platform/tenants");
  revalidatePath(`/platform/tenants/${tenantId}`);
  return {
    success: `Acesso removido${profile?.email ? ` (${profile.email})` : ""}.`,
  };
}

function slugifyPlanName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "plano";
}

export async function platformCreatePlan(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const maxMembers = Math.min(
    500,
    Math.max(1, Number.parseInt(String(formData.get("maxMembers") ?? "2"), 10) || 2),
  );
  const maxChannels = Math.min(
    100,
    Math.max(1, Number.parseInt(String(formData.get("maxChannels") ?? "1"), 10) || 1),
  );
  const maxAiReplies = Math.max(
    0,
    Number.parseInt(String(formData.get("maxAiReplies") ?? "500"), 10) || 0,
  );

  if (!name) return { error: "Informe o nome do plano." };

  const admin = createServiceClient();
  const { data: last } = await admin
    .from("plans")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? 0) + 10;

  let slug = slugifyPlanName(name);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data: created, error } = await admin
      .from("plans")
      .insert({
        slug: candidate,
        name,
        description,
        max_members: maxMembers,
        max_channels: maxChannels,
        max_ai_replies_month: maxAiReplies,
        is_custom: false,
        sort_order: sortOrder,
        is_active: true,
      })
      .select("id, name")
      .maybeSingle();

    if (!error && created) {
      revalidatePath("/platform");
      revalidatePath("/platform/plans");
      revalidatePath("/platform/tenants");
      return {
        success: `Plano “${created.name}” criado. Já aparece na lista e pode atribuir a um cliente.`,
      };
    }
    if (error?.code === "23505") continue; // slug duplicado
    if (error) return { error: error.message };
  }

  return { error: "Não foi possível gerar um identificador único para o plano." };
}

export async function platformUpdatePlan(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const maxMembers = Math.min(
    500,
    Math.max(1, Number.parseInt(String(formData.get("maxMembers") ?? "2"), 10) || 2),
  );
  const maxChannels = Math.min(
    100,
    Math.max(1, Number.parseInt(String(formData.get("maxChannels") ?? "1"), 10) || 1),
  );
  const maxAiReplies = Math.max(
    0,
    Number.parseInt(String(formData.get("maxAiReplies") ?? "500"), 10) || 0,
  );

  if (!planId || !name) return { error: "Dados incompletos." };

  const admin = createServiceClient();
  const { data: plan, error } = await admin
    .from("plans")
    .update({
      name,
      description,
      max_members: maxMembers,
      max_channels: maxChannels,
      max_ai_replies_month: maxAiReplies,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .select("id, is_custom, slug")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!plan) return { error: "Plano não encontrado." };

  // Sincroniza max_members nos tenants deste plano (exceto personalizado com override)
  if (!plan.is_custom) {
    await admin
      .from("tenants")
      .update({ max_members: maxMembers })
      .eq("plan_id", planId)
      .is("custom_max_members", null);
  }

  revalidatePath("/platform");
  revalidatePath("/platform/plans");
  revalidatePath("/platform/tenants");
  return { success: `Plano “${name}” atualizado. Novos limites valem na hora.` };
}

export async function platformAssignTenantPlan(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  if (!tenantId || !planId) return { error: "Selecione empresa e plano." };

  const admin = createServiceClient();
  const { data: plan } = await admin
    .from("plans")
    .select(
      "id, name, is_custom, max_members, max_channels, max_ai_replies_month",
    )
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { error: "Plano inválido." };

  const customMembers = Number.parseInt(
    String(formData.get("customMaxMembers") ?? ""),
    10,
  );
  const customChannels = Number.parseInt(
    String(formData.get("customMaxChannels") ?? ""),
    10,
  );
  const customReplies = Number.parseInt(
    String(formData.get("customMaxAiReplies") ?? ""),
    10,
  );

  const patch: {
    plan_id: string;
    max_members: number;
    custom_max_members: number | null;
    custom_max_channels: number | null;
    custom_max_ai_replies_month: number | null;
  } = {
    plan_id: planId,
    max_members: plan.max_members,
    custom_max_members: null,
    custom_max_channels: null,
    custom_max_ai_replies_month: null,
  };

  if (plan.is_custom) {
    patch.custom_max_members = Number.isFinite(customMembers)
      ? Math.min(500, Math.max(1, customMembers))
      : plan.max_members;
    patch.custom_max_channels = Number.isFinite(customChannels)
      ? Math.min(100, Math.max(1, customChannels))
      : plan.max_channels;
    patch.custom_max_ai_replies_month = Number.isFinite(customReplies)
      ? Math.max(0, customReplies)
      : plan.max_ai_replies_month;
    patch.max_members = patch.custom_max_members;
  }

  const { error } = await admin.from("tenants").update(patch).eq("id", tenantId);
  if (error) return { error: error.message };

  revalidatePath("/platform/tenants");
  revalidatePath("/platform/plans");
  revalidatePath("/app/settings");
  revalidatePath("/app/settings/ai");
  return {
    success: `Plano “${plan.name}” aplicado. O teto mudou; o uso do mês continua contando.`,
  };
}

export async function platformDeleteTenant(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  if (!(await isCurrentUserPlatformAdmin())) {
    return { error: "Apenas super admin." };
  }

  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!tenantId) return { error: "Cliente inválido." };

  const admin = createServiceClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .maybeSingle();

  if (!tenant) return { error: "Cliente não encontrado." };
  if (confirmName.toLowerCase() !== tenant.name.toLowerCase()) {
    return {
      error: `Digite o nome exato “${tenant.name}” para confirmar a exclusão.`,
    };
  }

  // Membros antes do cascade (pra limpar Auth órfão depois)
  const { data: roles } = await admin
    .from("user_tenant_roles")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const memberIds = [...new Set((roles ?? []).map((r) => r.user_id))];

  // WhatsApp / Evolution (best effort)
  const { data: accounts } = await admin
    .from("whatsapp_accounts")
    .select("phone_number_id, onboard_source")
    .eq("tenant_id", tenantId);

  for (const acc of accounts ?? []) {
    if (acc.onboard_source === "baileys" && acc.phone_number_id) {
      try {
        const { deleteEvolutionInstance } = await import(
          "@/lib/evolution/client"
        );
        await deleteEvolutionInstance(acc.phone_number_id);
      } catch (err) {
        console.error(
          "[platform] evolution delete failed",
          acc.phone_number_id,
          err,
        );
      }
    }
  }

  const { error: delError } = await admin
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (delError) return { error: delError.message };

  // Usuários que ficaram sem nenhum tenant → remove Auth + profile
  for (const userId of memberIds) {
    const { count } = await admin
      .from("user_tenant_roles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) > 0) continue;

    const { data: isPlatform } = await admin
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (isPlatform) continue;

    try {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
    } catch (err) {
      console.error("[platform] orphan user cleanup failed", userId, err);
    }
  }

  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/invites");
  revalidatePath("/platform/finance");
  revalidatePath("/platform/usage");
  revalidatePath("/platform/plans");
  return {
    success: `Cliente “${tenant.name}” e todos os dados relacionados foram apagados.`,
  };
}
