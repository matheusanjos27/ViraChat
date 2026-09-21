"use server";

import { revalidatePath } from "next/cache";
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

  if (maxMembers !== 2) {
    const admin = createServiceClient();
    await admin.from("tenants").update({ max_members: maxMembers }).eq("slug", slug);
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

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const result = await inviteUserToTenant({
    tenantId,
    email,
    fullName,
    role,
    invitedByUserId: actor?.id ?? null,
    enforceSeatLimit: true,
  });

  revalidatePath("/platform");
  revalidatePath("/platform/invites");
  revalidatePath("/platform/tenants");
  return result;
}
