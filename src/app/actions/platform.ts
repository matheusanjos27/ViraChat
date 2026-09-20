"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/admin";
import { isCurrentUserPlatformAdmin } from "@/lib/platform/admin";
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

  revalidatePath("/platform");
  return { success: `Tenant “${name}” criado.` };
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
  const role = (String(formData.get("role") ?? "admin") as
    | "admin"
    | "supervisor"
    | "agent");
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!tenantId || !email) {
    return { error: "Informe tenant e e-mail." };
  }
  if (!["admin", "supervisor", "agent"].includes(role)) {
    return { error: "Papel inválido." };
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const admin = createServiceClient();

  // Record invite
  await admin.from("tenant_invites").upsert(
    {
      tenant_id: tenantId,
      email,
      role,
      invited_by: actor?.id ?? null,
      accepted_at: null,
    },
    { onConflict: "tenant_id,email" },
  );

  // Invite or find existing auth user
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName || email,
        invited_tenant_id: tenantId,
        invited_role: role,
      },
      redirectTo: `${origin}/auth/set-password`,
    });

  let userId = invited?.user?.id;

  if (inviteError) {
    // User may already exist — look up by email
    const { data: listed } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const existing = listed?.users?.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!existing) {
      return { error: inviteError.message };
    }
    userId = existing.id;
  }

  if (!userId) {
    return { error: "Não foi possível obter o usuário convidado." };
  }

  const { error: memberError } = await supabase.rpc(
    "platform_add_tenant_member",
    {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_role: role,
    },
  );

  if (memberError) {
    return { error: memberError.message };
  }

  await admin
    .from("tenant_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("email", email);

  revalidatePath("/platform");
  return {
    success: inviteError
      ? `Usuário existente vinculado a ${email}.`
      : `Convite enviado para ${email}.`,
  };
}
