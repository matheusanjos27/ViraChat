"use server";

import { revalidatePath } from "next/cache";
import { encryptToken } from "@/lib/crypto/tokens";
import {
  exchangeEmbeddedSignupCode,
  fetchPhoneNumberDetails,
  listPhoneNumbersForWaba,
  subscribeWabaToWebhooks,
} from "@/lib/meta/whatsapp";
import { createClient } from "@/lib/supabase/server";

export type ChannelActionState = {
  error?: string;
  success?: string;
};

async function requireTenantAdmin(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Não autenticado." as const, supabase, user: null };
  }

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!membership || !["admin", "supervisor"].includes(membership.role)) {
    return {
      error: "Sem permissão para conectar canais." as const,
      supabase,
      user,
    };
  }

  return { error: null, supabase, user };
}

async function persistWhatsAppChannel(params: {
  tenantId: string;
  displayName: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  onboardSource: "manual" | "embedded_signup" | "business_app";
  metaBusinessId?: string;
}) {
  const gate = await requireTenantAdmin(params.tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }
  const { supabase } = gate;

  let displayPhone: string | null = null;
  let verifiedName: string | null = null;
  let qualityRating: string | null = null;

  try {
    const details = await fetchPhoneNumberDetails(
      params.phoneNumberId,
      params.accessToken,
    );
    displayPhone = details.display_phone_number ?? null;
    verifiedName = details.verified_name ?? null;
    qualityRating = details.quality_rating ?? null;
  } catch {
    // Manual connect may use a token that can't read details yet — still save.
  }

  try {
    await subscribeWabaToWebhooks(params.wabaId, params.accessToken);
  } catch (err) {
    console.warn("[whatsapp] subscribe webhooks", err);
  }

  const encrypted = encryptToken(params.accessToken);

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .insert({
      tenant_id: params.tenantId,
      provider_id: "whatsapp",
      display_name:
        params.displayName ||
        verifiedName ||
        displayPhone ||
        params.phoneNumberId,
      is_active: true,
    })
    .select("id")
    .single();

  if (channelError || !channel) {
    return { error: channelError?.message ?? "Falha ao criar canal." };
  }

  const { error: accountError } = await supabase.from("whatsapp_accounts").insert({
    tenant_id: params.tenantId,
    channel_id: channel.id,
    phone_number_id: params.phoneNumberId,
    waba_id: params.wabaId,
    access_token_encrypted: encrypted,
    display_phone: displayPhone,
    verified_name: verifiedName,
    quality_rating: qualityRating,
    onboard_source: params.onboardSource,
    meta_business_id: params.metaBusinessId ?? null,
  });

  if (accountError) {
    await supabase.from("channels").delete().eq("id", channel.id);
    if (accountError.code === "23505") {
      return { error: "Este número WhatsApp já está conectado em outra conta." };
    }
    return { error: accountError.message };
  }

  revalidatePath("/app/channels");
  revalidatePath("/app");
  return { success: "WhatsApp conectado com sucesso." };
}

export async function connectWhatsAppManual(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const wabaId = String(formData.get("wabaId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!tenantId || !phoneNumberId || !wabaId || !accessToken) {
    return { error: "Preencha phone number ID, WABA ID e token de acesso." };
  }

  return persistWhatsAppChannel({
    tenantId,
    displayName,
    phoneNumberId,
    wabaId,
    accessToken,
    onboardSource: "manual",
  });
}

export async function completeEmbeddedSignup(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  let phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  let wabaId = String(formData.get("wabaId") ?? "").trim();
  const businessId = String(formData.get("businessId") ?? "").trim();
  const event = String(formData.get("event") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!tenantId || !code) {
    return {
      error:
        "Dados incompletos do Embedded Signup. Conclua o fluxo da Meta novamente.",
    };
  }

  let accessToken: string;
  try {
    accessToken = await exchangeEmbeddedSignupCode(code);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Falha ao trocar o código da Meta por token.",
    };
  }

  // If session info missed phone/waba, discover via Graph after token exchange
  if (!wabaId) {
    return {
      error:
        "A Meta não enviou o WABA ID. Conclua o Embedded Signup até o fim e tente de novo.",
    };
  }

  if (!phoneNumberId) {
    try {
      const numbers = await listPhoneNumbersForWaba(wabaId, accessToken);
      if (numbers.length === 0) {
        return {
          error:
            "WABA conectada, mas nenhum número encontrado. Cadastre/verifique o número na Meta e tente de novo.",
        };
      }
      phoneNumberId = numbers[0].id;
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Não foi possível descobrir o número na WABA.",
      };
    }
  }

  const onboardSource =
    event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
      ? "business_app"
      : "embedded_signup";

  return persistWhatsAppChannel({
    tenantId,
    displayName,
    phoneNumberId,
    wabaId,
    accessToken,
    onboardSource,
    metaBusinessId: businessId || undefined,
  });
}

export async function disconnectChannel(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const gate = await requireTenantAdmin(tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }

  const { error } = await gate.supabase
    .from("channels")
    .delete()
    .eq("id", channelId)
    .eq("tenant_id", tenantId);

  if (error) return { error: error.message };
  revalidatePath("/app/channels");
  return { success: "Canal removido." };
}
