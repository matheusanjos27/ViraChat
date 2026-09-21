import { createServiceClient } from "@/lib/supabase/admin";

export type InviteRole = "admin" | "supervisor" | "agent";

export async function getTenantSeatUsage(tenantId: string) {
  const admin = createServiceClient();
  const [{ data: tenant }, { count }] = await Promise.all([
    admin
      .from("tenants")
      .select("id, name, max_members")
      .eq("id", tenantId)
      .maybeSingle(),
    admin
      .from("user_tenant_roles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const maxMembers = tenant?.max_members ?? 2;
  const used = count ?? 0;
  return {
    tenantName: tenant?.name ?? null,
    maxMembers,
    used,
    remaining: Math.max(0, maxMembers - used),
    atLimit: used >= maxMembers,
  };
}

export async function inviteUserToTenant(input: {
  tenantId: string;
  email: string;
  fullName?: string;
  role: InviteRole;
  invitedByUserId: string | null;
  /** When true, platform admin can still invite past soft checks after raising seats */
  enforceSeatLimit?: boolean;
  /**
   * Atalho sem SMTP: cria o usuário já com senha (email confirmado).
   * Se vazio, usa invite por e-mail (precisa SMTP no Supabase).
   */
  password?: string;
}): Promise<{ error?: string; success?: string }> {
  const email = input.email.trim().toLowerCase();
  const fullName = (input.fullName ?? "").trim();
  const role = input.role;
  const tenantId = input.tenantId;
  const enforce = input.enforceSeatLimit !== false;
  const password = (input.password ?? "").trim();
  const withPassword = password.length > 0;

  if (!tenantId || !email) {
    return { error: "Informe e-mail e empresa." };
  }
  if (!["admin", "supervisor", "agent"].includes(role)) {
    return { error: "Papel inválido." };
  }
  if (withPassword && password.length < 6) {
    return { error: "Senha provisória: mínimo 6 caracteres." };
  }

  const admin = createServiceClient();
  const seats = await getTenantSeatUsage(tenantId);
  if (enforce && seats.atLimit) {
    return {
      error: `Limite de colaboradores atingido (${seats.used}/${seats.maxMembers}). Peça ao super admin para aumentar o limite.`,
    };
  }

  // Already a member?
  const { data: existingUsers } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existingAuth = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (existingAuth) {
    const { data: membership } = await admin
      .from("user_tenant_roles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", existingAuth.id)
      .maybeSingle();
    if (membership) {
      return { error: "Este e-mail já é colaborador desta empresa." };
    }
  }

  await admin.from("tenant_invites").upsert(
    {
      tenant_id: tenantId,
      email,
      role,
      invited_by: input.invitedByUserId,
      accepted_at: null,
    },
    { onConflict: "tenant_id,email" },
  );

  let userId: string | undefined;
  let createdWithPassword = false;
  let linkedExistingWithoutInvite = false;

  if (withPassword) {
    if (existingAuth) {
      const { error: pwError } = await admin.auth.admin.updateUserById(
        existingAuth.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || existingAuth.user_metadata?.full_name || email,
          },
        },
      );
      if (pwError) return { error: pwError.message };
      userId = existingAuth.id;
    } else {
      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || email,
            invited_tenant_id: tenantId,
            invited_role: role,
          },
        });
      if (createError) return { error: createError.message };
      userId = created.user?.id;
      createdWithPassword = true;
    }
  } else {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName || email,
          invited_tenant_id: tenantId,
          invited_role: role,
        },
        redirectTo: `${origin}/auth/set-password`,
      });

    userId = invited?.user?.id;

    if (inviteError) {
      if (!existingAuth) {
        return { error: inviteError.message };
      }
      userId = existingAuth.id;
      linkedExistingWithoutInvite = true;
    }
  }

  if (!userId) {
    return { error: "Não foi possível obter o usuário convidado." };
  }

  if (fullName) {
    await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: fullName,
        email,
      },
      { onConflict: "id" },
    );
  }

  const { error: memberError } = await admin.from("user_tenant_roles").insert({
    user_id: userId,
    tenant_id: tenantId,
    role,
  });

  if (memberError && !/duplicate|unique/i.test(memberError.message)) {
    return { error: memberError.message };
  }

  await admin
    .from("tenant_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("email", email);

  if (withPassword) {
    return {
      success: createdWithPassword
        ? `Usuário criado: ${email}. Pode entrar em /login com a senha provisória.`
        : `Usuário existente vinculado e senha atualizada: ${email}.`,
    };
  }

  return {
    success: linkedExistingWithoutInvite
      ? `Usuário existente vinculado: ${email}.`
      : `Convite enviado para ${email}. A pessoa define a senha pelo e-mail.`,
  };
}
