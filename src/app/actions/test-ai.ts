"use server";

import OpenAI from "openai";
import {
  assertTestAiAllowed,
  recordTestAiEvent,
} from "@/lib/plans/limits";
import { createClient } from "@/lib/supabase/server";

export type TestAiState = {
  error?: string;
  reply?: string;
};

export async function testAiReply(
  _prev: TestAiState,
  formData: FormData,
): Promise<TestAiState> {
  const tenantId = String(formData.get("tenantId") ?? "");
  const userMessage = String(formData.get("message") ?? "").trim();
  if (!tenantId) return { error: "Tenant inválido." };
  if (!userMessage) return { error: "Digite uma mensagem." };
  if (!process.env.OPENAI_API_KEY) {
    return { error: "OPENAI_API_KEY não configurada no servidor." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!membership || !["admin", "supervisor"].includes(membership.role)) {
    return { error: "Sem permissão." };
  }

  const testGate = await assertTestAiAllowed(tenantId);
  if (!testGate.ok) {
    return { error: testGate.error };
  }

  const [{ data: config }, { data: tenant }, { data: playbook }] =
    await Promise.all([
      supabase
        .from("ai_configs")
        .select("name, instructions, is_enabled")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("tenants")
        .select("name, about")
        .eq("id", tenantId)
        .maybeSingle(),
      supabase
        .from("playbooks")
        .select("name, content, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

  const assistantName = config?.name || "Assistente";
  const company = tenant?.name || "a empresa";
  const system = [
    `Você é ${assistantName}, assistente de atendimento no WhatsApp da ${company}.`,
    "Responda em português do Brasil, mensagens curtas (estilo WhatsApp).",
    config?.instructions ? `Instruções:\n${config.instructions}` : "",
    tenant?.about ? `Sobre a empresa:\n${tenant.about}` : "",
    playbook?.content
      ? `Roteiro ativo (${playbook.name}):\n${playbook.content.slice(0, 2500)}`
      : "",
    "Esta é uma simulação de teste — não invente preços. Seja natural.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 400,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) return { error: "A IA não retornou texto." };

    await recordTestAiEvent({ tenantId, userId: user.id });
    return { reply };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Falha ao testar a IA.",
    };
  }
}
