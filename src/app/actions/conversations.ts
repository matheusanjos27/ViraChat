"use server";

import { revalidatePath } from "next/cache";
import { decryptToken } from "@/lib/crypto/tokens";
import { sendWhatsAppText } from "@/lib/meta/whatsapp";
import { createClient } from "@/lib/supabase/server";

export type ConversationActionState = {
  error?: string;
  success?: string;
};

async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." as const, supabase, user: null };
  return { error: null, supabase, user };
}

export async function sendAgentMessage(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || !body) {
    return { error: "Escreva uma mensagem." };
  }

  const gate = await getSession();
  if (gate.error || !gate.user) return { error: gate.error ?? "Não autenticado." };
  const { supabase, user } = gate;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, status, channel_id, contact_id, contacts(phone_e164, external_id), channels(id, whatsapp_accounts(phone_number_id, access_token_encrypted))",
    )
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return { error: "Conversa não encontrada." };
  }

  if (conversation.status !== "human_active") {
    return {
      error:
        "Assuma a conversa antes de responder (status precisa ser atendimento humano).",
    };
  }

  const contact = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
  } | null;

  const channel = conversation.channels as unknown as {
    whatsapp_accounts:
      | {
          phone_number_id: string;
          access_token_encrypted: string;
        }
      | {
          phone_number_id: string;
          access_token_encrypted: string;
        }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to = contact?.phone_e164 || (contact?.external_id ? `+${contact.external_id}` : null);
  if (!wa || !to) {
    return { error: "Canal WhatsApp ou telefone do contato indisponível." };
  }

  let providerMessageId: string | null = null;
  try {
    const token = decryptToken(wa.access_token_encrypted);
    providerMessageId = await sendWhatsAppText({
      phoneNumberId: wa.phone_number_id,
      accessToken: token,
      toE164: to,
      body,
    });
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Falha ao enviar mensagem pelo WhatsApp.",
    };
  }

  const now = new Date().toISOString();
  const { error: msgError } = await supabase.from("messages").insert({
    tenant_id: conversation.tenant_id,
    conversation_id: conversation.id,
    direction: "outbound",
    sender_type: "agent",
    sender_user_id: user.id,
    body,
    provider_message_id: providerMessageId,
    created_at: now,
  });

  if (msgError) return { error: msgError.message };

  await supabase
    .from("conversations")
    .update({ last_message_at: now })
    .eq("id", conversation.id);

  revalidatePath("/app/conversations");
  return { success: "Mensagem enviada." };
}

export async function assumeConversationAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const gate = await getSession();
  if (gate.error || !gate.user) return { error: gate.error ?? "Não autenticado." };

  const { error } = await gate.supabase.rpc("assume_conversation", {
    p_conversation_id: conversationId,
  });

  if (error) {
    return { error: error.message || "Não foi possível assumir a conversa." };
  }

  revalidatePath("/app/conversations");
  return { success: "Você assumiu a conversa." };
}

export async function releaseToAiAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const gate = await getSession();
  if (gate.error || !gate.user) return { error: gate.error ?? "Não autenticado." };

  const { error } = await gate.supabase.rpc("release_conversation_to_ai", {
    p_conversation_id: conversationId,
  });

  if (error) {
    return { error: error.message || "Não foi possível devolver à IA." };
  }

  revalidatePath("/app/conversations");
  return { success: "Conversa devolvida à IA." };
}

export async function resolveConversationAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const conversationId = String(formData.get("conversationId") ?? "");
  const gate = await getSession();
  if (gate.error || !gate.user) return { error: gate.error ?? "Não autenticado." };

  const { error } = await gate.supabase
    .from("conversations")
    .update({ status: "resolved", assigned_to: null })
    .eq("id", conversationId);

  if (error) return { error: error.message };
  revalidatePath("/app/conversations");
  return { success: "Conversa resolvida." };
}
