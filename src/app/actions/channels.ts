"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { encryptToken } from "@/lib/crypto/tokens";
import {
  connectEvolutionInstance,
  createEvolutionInstance,
  deleteEvolutionInstance,
  getEvolutionConnectionState,
  isEvolutionConfigured,
} from "@/lib/evolution/client";
import { createClient } from "@/lib/supabase/server";

export type ChannelActionState = {
  error?: string;
  success?: string;
  instanceName?: string;
  channelId?: string;
  qrcodeBase64?: string | null;
  pairingCode?: string | null;
  connectionStatus?: string;
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

  const { data: account } = await gate.supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, onboard_source")
    .eq("channel_id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (account && isEvolutionConfigured()) {
    try {
      await deleteEvolutionInstance(account.phone_number_id);
    } catch (err) {
      console.warn("[baileys] delete instance", err);
    }
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

function makeInstanceName(tenantId: string) {
  const short = tenantId.replace(/-/g, "").slice(0, 8);
  const suffix = randomBytes(3).toString("hex");
  return `vira_${short}_${suffix}`;
}

/** Cria instância Evolution/Baileys e devolve QR para o tenant escanear. */
export async function startBaileysChannel(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  if (!isEvolutionConfigured()) {
    return {
      error:
        "Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor.",
    };
  }

  const tenantId = String(formData.get("tenantId") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phoneRaw = String(formData.get("phoneNumber") ?? "").trim();
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    return {
      error:
        "Número inválido. Use DDI+DDD+número, ex.: 5511999999999 (só dígitos).",
    };
  }
  const gate = await requireTenantAdmin(tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }
  const { supabase } = gate;

  const { assertChannelSlotAvailable } = await import("@/lib/plans/limits");
  const slot = await assertChannelSlotAvailable(tenantId);
  if (!slot.ok) {
    return { error: slot.error };
  }

  const instanceName = makeInstanceName(tenantId);
  let created: Awaited<ReturnType<typeof createEvolutionInstance>>;
  try {
    created = await createEvolutionInstance({
      instanceName,
      displayName: displayName || undefined,
      phoneNumber: phoneDigits || null,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Falha ao criar instância WhatsApp (Baileys).",
    };
  }

  const label = displayName || `WhatsApp ${instanceName.slice(-6)}`;
  const encrypted = encryptToken(`evolution:${instanceName}`);

  const { data: channel, error: channelError } = await supabase
    .from("channels")
    .insert({
      tenant_id: tenantId,
      provider_id: "whatsapp",
      display_name: label,
      is_active: true,
    })
    .select("id")
    .single();

  if (channelError || !channel) {
    try {
      await deleteEvolutionInstance(instanceName);
    } catch {
      /* ignore */
    }
    return { error: channelError?.message ?? "Falha ao criar canal." };
  }

  const { error: accountError } = await supabase.from("whatsapp_accounts").insert({
    tenant_id: tenantId,
    channel_id: channel.id,
    phone_number_id: instanceName,
    waba_id: "evolution",
    access_token_encrypted: encrypted,
    display_phone: phoneDigits ? `+${phoneDigits}` : null,
    verified_name: label,
    onboard_source: "baileys",
    connection_status: "pending_qr",
  });

  if (accountError) {
    await supabase.from("channels").delete().eq("id", channel.id);
    try {
      await deleteEvolutionInstance(instanceName);
    } catch {
      /* ignore */
    }
    if (accountError.code === "23505") {
      return { error: "Instância já existe — tente de novo." };
    }
    return { error: accountError.message };
  }

  let qrcodeBase64 = created.qrcodeBase64;
  let pairingCode = created.pairingCode;
  // Sem número a Evolution costuma só mandar QR; com número vem o código de pareamento.
  if (!qrcodeBase64 || (phoneDigits && !pairingCode)) {
    try {
      const again = await connectEvolutionInstance(instanceName, {
        phoneNumber: phoneDigits || null,
      });
      qrcodeBase64 = again.qrcodeBase64 ?? qrcodeBase64;
      pairingCode = again.pairingCode ?? pairingCode;
    } catch (err) {
      console.warn("[baileys] connect for QR", err);
    }
  }

  revalidatePath("/app/channels");
  return {
    success: phoneDigits
      ? "Escaneie o QR ou digite o código de pareamento no WhatsApp."
      : "Escaneie o QR Code no WhatsApp do celular. (Para código de pareamento, informe o número e gere de novo.)",
    instanceName,
    channelId: channel.id,
    qrcodeBase64,
    pairingCode,
    connectionStatus: "pending_qr",
  };
}

export async function refreshBaileysQr(
  channelId: string,
  tenantId: string,
): Promise<ChannelActionState> {
  if (!isEvolutionConfigured()) {
    return { error: "Evolution API não configurada." };
  }
  const gate = await requireTenantAdmin(tenantId);
  if (gate.error || !gate.user) {
    return { error: gate.error ?? "Não autenticado." };
  }

  const { data: account } = await gate.supabase
    .from("whatsapp_accounts")
    .select("phone_number_id, onboard_source, connection_status, display_phone")
    .eq("channel_id", channelId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!account || account.onboard_source !== "baileys") {
    return { error: "Canal WhatsApp não encontrado." };
  }

  try {
    const state = await getEvolutionConnectionState(account.phone_number_id);
    if (state === "open") {
      await gate.supabase
        .from("whatsapp_accounts")
        .update({ connection_status: "open" })
        .eq("channel_id", channelId);
      revalidatePath("/app/channels");
      return {
        success: "WhatsApp conectado.",
        connectionStatus: "open",
        channelId,
        instanceName: account.phone_number_id,
      };
    }

    // Ainda aguardando leitura: tenta QR novo, mas se a Evolution
    // reclamar (QR já emitido / connecting), não trate como falha fatal.
    try {
      const qr = await connectEvolutionInstance(account.phone_number_id, {
        phoneNumber: account.display_phone,
      });
      return {
        connectionStatus: "pending_qr",
        channelId,
        instanceName: account.phone_number_id,
        qrcodeBase64: qr.qrcodeBase64,
        pairingCode: qr.pairingCode,
      };
    } catch (qrErr) {
      console.warn("[baileys] refresh QR (não fatal)", qrErr);
      return {
        connectionStatus:
          state === "connecting" || state === "close" || state === "pairing"
            ? "pending_qr"
            : (account.connection_status ?? "pending_qr"),
        channelId,
        instanceName: account.phone_number_id,
      };
    }
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Falha ao atualizar QR / status.",
    };
  }
}
