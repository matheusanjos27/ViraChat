import { isMonthlyTokenBudgetExceeded } from "@/lib/ai/budget";
import { AI_SPAM_FLAG_LIMIT, isLikelySpamMessage } from "@/lib/ai/spam";
import {
  AI_LIMITS,
  affirmsHandoffOffer,
  buildHandoffOfferText,
  declinesHandoffOffer,
  isLightContextTurn,
  isOpeningGreetingTurn,
  isShortContinuation,
  offersHandoffConfirmation,
  truncate,
  wantsCatalogList,
  wantsHuman,
} from "@/lib/ai/limits";
import { getDefaultAiProvider } from "@/lib/ai/providers/openai";
import type { AiChatMessage, AiReplyResult } from "@/lib/ai/types";
import { buildAttributePromptBlock, hydrateAttributeValuesFromContact } from "@/lib/crm/attributes";
import {
  AI_CNPJ_ATTEMPT_LIMIT,
  CNPJ_SKIPPED_VALUE,
  classifyCnpjAttempt,
  cnpjRetryText,
} from "@/lib/crm/cnpj";
import {
  extractCollectedFromMessages,
  lastOutboundAskedCnpj,
  mergeCollected,
  requiredAttributesFilled,
  sanitizeCollected,
  wantsToCloseSale,
} from "@/lib/crm/extract-attributes";
import {
  buildPlaybookPromptBlock,
  pickActivePlaybook,
  type Playbook,
} from "@/lib/crm/playbook";
import {
  buildCatalogPromptBlock,
  buildOpeningCatalogOutline,
  formatQuoteMessage,
  quoteCatalogFocused,
  type ServiceForQuote,
} from "@/lib/crm/pricing";
import { sanitizeOutboundAiText } from "@/lib/ai/parse-model-json";
import {
  buildFunnelPromptBlock,
  ensureDealAndAdvanceStage,
  inferDealStageHint,
} from "@/lib/crm/deal-stage";
import { decryptToken } from "@/lib/crypto/tokens";
import { canAiReply, sliceMessagesForAiSession } from "@/lib/conversations/status";
import {
  buildDeterministicHandoffSummary,
  mergeHandoffNote,
} from "@/lib/crm/handoff-summary";
import { createAppNotification } from "@/lib/notifications";
import {
  disableTenantAi,
  getAiReplyUsageThisMonth,
  getTenantPlanLimits,
  recordAiReplyEvent,
} from "@/lib/plans/limits";
import { recordAiUsage } from "@/lib/platform/usage";
import { getPlatformAiHistoryTurns } from "@/lib/platform/settings";
import { sendOutboundText } from "@/lib/whatsapp/send";
import { createServiceClient } from "@/lib/supabase/admin";

export async function runAiForConversation(conversationId: string) {
  const supabase = createServiceClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, status, channel_id, contact_id, ai_session_started_at, handoff_offer_pending_at, ai_spam_flags, ai_spam_blocked_at, ai_cnpj_attempts, contacts(phone_e164, external_id, display_name, email, company_name), channels(id, whatsapp_accounts(phone_number_id, access_token_encrypted, onboard_source))",
    )
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.warn("[ai] conversation missing", conversationId, convError);
    return { skipped: "missing_conversation" as const };
  }

  if (!canAiReply(conversation.status)) {
    return { skipped: "not_ai_active" as const, status: conversation.status };
  }

  const { data: aiConfig } = await supabase
    .from("ai_configs")
    .select("name, instructions, presentation, is_enabled, close_mode")
    .eq("tenant_id", conversation.tenant_id)
    .maybeSingle();

  if (!aiConfig?.is_enabled) {
    return { skipped: "ai_disabled" as const };
  }

  const closeMode =
    aiConfig.close_mode === "callback" ? "callback" : "handoff";

  const { data: tenantProfile } = await supabase
    .from("tenants")
    .select(
      "name, about, phone, website, billing_status, monthly_ai_token_limit",
    )
    .eq("id", conversation.tenant_id)
    .maybeSingle();

  const billing = tenantProfile?.billing_status ?? "active";
  if (billing === "past_due" || billing === "canceled") {
    return { skipped: "billing_blocked" as const, billing };
  }

  const planLimits = await getTenantPlanLimits(conversation.tenant_id);
  if (planLimits && planLimits.maxAiRepliesMonth > 0) {
    const replyUsage = await getAiReplyUsageThisMonth(
      conversation.tenant_id,
      planLimits.maxAiRepliesMonth,
    );
    if (replyUsage.atLimit) {
      await disableTenantAi(conversation.tenant_id);
      return { skipped: "ai_reply_quota" as const, usage: replyUsage };
    }
  }

  const budget = await isMonthlyTokenBudgetExceeded(
    conversation.tenant_id,
    tenantProfile?.monthly_ai_token_limit,
  );
  if (budget.exceeded) {
    await disableTenantAi(conversation.tenant_id);
    return { skipped: "monthly_token_budget" as const };
  }

  const historyTurns = await getPlatformAiHistoryTurns();

  const [
    { data: messages },
    { data: attributes },
    { data: attrValues },
    { data: services },
    { data: tiers },
    { data: playbooks },
    { data: dealStages },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("body, direction, sender_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(Math.max(40, historyTurns + 8)),
    supabase
      .from("contact_attributes")
      .select(
        "id, key, label, type, options, required, collect_via_ai, sort_order, tenant_id, created_at, updated_at",
      )
      .eq("tenant_id", conversation.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("contact_attribute_values")
      .select("attribute_id, value")
      .eq("contact_id", conversation.contact_id),
    supabase
      .from("services")
      .select(
        "id, name, description, offer_kind, billing_type, unit_label, unit_attribute_key, base_price, min_price, is_active",
      )
      .eq("tenant_id", conversation.tenant_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(40),
    supabase
      .from("service_pricing_tiers")
      .select(
        "id, service_id, min_units, max_units, price, price_mode, sort_order",
      )
      .eq("tenant_id", conversation.tenant_id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("playbooks")
      .select("id, name, trigger, trigger_keyword, is_active, content")
      .eq("tenant_id", conversation.tenant_id),
    supabase
      .from("deal_stages")
      .select("id, name, sort_order")
      .eq("tenant_id", conversation.tenant_id)
      .order("sort_order", { ascending: true }),
  ]);

  const sessionSlice = sliceMessagesForAiSession(
    messages ?? [],
    (
      conversation as { ai_session_started_at?: string | null }
    ).ai_session_started_at,
  );
  const sessionMessages = sessionSlice.messages;
  const resumedAfterHuman = sessionSlice.resumedAfterHuman;

  const latestInbound = [...sessionMessages]
    .reverse()
    .find((m) => m.direction === "inbound" && m.body);
  if (!latestInbound?.body) {
    return { skipped: "no_inbound" as const };
  }

  const history: AiChatMessage[] = sessionMessages
    .filter((m) => m.body)
    .slice(0, -1)
    .slice(-historyTurns)
    .map((m) => ({
      role:
        m.direction === "inbound"
          ? ("user" as const)
          : ("assistant" as const),
      content: truncate(m.body as string, AI_LIMITS.messageBody),
    }));

  const attrList = attributes ?? [];
  const valueByAttrId = new Map(
    (attrValues ?? []).map((v) => [v.attribute_id, v.value]),
  );
  const currentValues: Record<string, string | null> = {};
  for (const a of attrList) {
    currentValues[a.key] = valueByAttrId.get(a.id) ?? null;
  }

  const contactEarly = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
    email: string | null;
    company_name: string | null;
  } | null;

  hydrateAttributeValuesFromContact(attrList, currentValues, {
    display_name: contactEarly?.display_name,
    email: contactEarly?.email,
    company_name: contactEarly?.company_name,
  });

  const convSpam = conversation as {
    ai_spam_flags?: number | null;
    ai_spam_blocked_at?: string | null;
  };

  if (convSpam.ai_spam_blocked_at) {
    return { skipped: "spam_blocked" as const };
  }

  const priorInboundBodies = sessionMessages
    .filter((m) => m.direction === "inbound" && m.body)
    .map((m) => String(m.body))
    .slice(0, -1);

  const spamLike = isLikelySpamMessage(latestInbound.body, {
    recentInboundBodies: priorInboundBodies,
  });

  if (spamLike) {
    const nextFlags = Math.min(
      100,
      (Number(convSpam.ai_spam_flags) || 0) + 1,
    );
    await supabase
      .from("conversations")
      .update({ ai_spam_flags: nextFlags })
      .eq("id", conversationId);

    if (nextFlags >= AI_SPAM_FLAG_LIMIT) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("conversations")
        .update({ ai_spam_blocked_at: nowIso })
        .eq("id", conversationId);

      const summary = buildDeterministicHandoffSummary({
        reason: "spam_bloqueado",
        latestUserMessage: latestInbound.body,
        values: currentValues,
      });
      return forceHandoffWithoutLlm({
        supabase,
        conversation,
        text: "Vou te transferir para um atendente. Aguarde um momento.",
        reason: "spam_bloqueado",
        notifyTitle: "IA bloqueou spam",
        notifyBody: truncate(
          `Possível abuso (${nextFlags} flags). ${summary.replace(/\n/g, " · ")}`,
          220,
        ),
        handoffSummary: summary,
      });
    }

    // Aviso leve sem gastar o funil; ainda não bloqueou
    return replyAndStayOnAi({
      supabase,
      conversation,
      text: "Não entendi essa mensagem. Pode reformular com o que você precisa?",
    });
  } else if ((Number(convSpam.ai_spam_flags) || 0) > 0) {
    // Mensagem legítima zera o contador (evita lock por ruído pontual)
    await supabase
      .from("conversations")
      .update({ ai_spam_flags: 0 })
      .eq("id", conversationId);
  }

  // CNPJ: valida em código (dígitos verificadores) — sem gastar token.
  const cnpjAttr = attrList.find(
    (a) => a.collect_via_ai && /cnpj/i.test(a.key),
  );
  const cnpjEmpty = cnpjAttr
    ? !(currentValues[cnpjAttr.key] ?? "").trim()
    : false;
  if (
    cnpjAttr &&
    cnpjEmpty &&
    lastOutboundAskedCnpj(
      sessionMessages.map((m) => ({
        direction: m.direction as "inbound" | "outbound",
        body: m.body,
      })),
    )
  ) {
    const convCnpj = conversation as { ai_cnpj_attempts?: number | null };
    const attempts = Number(convCnpj.ai_cnpj_attempts) || 0;
    const status = classifyCnpjAttempt(latestInbound.body);
    const skipIntent =
      /\b(n[aã]o\s+(tenho|sei|informo)|depois|pular|sem\s+cnpj|agora\s+n[aã]o)\b/i.test(
        latestInbound.body,
      );

    if (status === "valid") {
      if (attempts > 0) {
        await supabase
          .from("conversations")
          .update({ ai_cnpj_attempts: 0 })
          .eq("id", conversationId);
      }
      // Extrator + sanitize gravam o CNPJ válido no fluxo normal.
    } else if (status === "incomplete" || status === "invalid") {
      const nextAttempts = Math.min(20, attempts + 1);
      await supabase
        .from("conversations")
        .update({ ai_cnpj_attempts: nextAttempts })
        .eq("id", conversationId);

      if (nextAttempts < AI_CNPJ_ATTEMPT_LIMIT) {
        return replyAndStayOnAi({
          supabase,
          conversation,
          text: cnpjRetryText(status, nextAttempts),
        });
      }

      // Esgotou tentativas: marca como não informado e segue o funil (1 LLM).
      await persistCollectedAttributes({
        supabase,
        tenantId: conversation.tenant_id,
        contactId: conversation.contact_id,
        attributes: attrList,
        collected: { [cnpjAttr.key]: CNPJ_SKIPPED_VALUE },
      });
      currentValues[cnpjAttr.key] = CNPJ_SKIPPED_VALUE;
      await supabase
        .from("conversations")
        .update({ ai_cnpj_attempts: 0 })
        .eq("id", conversationId);
    } else if (skipIntent) {
      await persistCollectedAttributes({
        supabase,
        tenantId: conversation.tenant_id,
        contactId: conversation.contact_id,
        attributes: attrList,
        collected: { [cnpjAttr.key]: CNPJ_SKIPPED_VALUE },
      });
      currentValues[cnpjAttr.key] = CNPJ_SKIPPED_VALUE;
      if (attempts > 0) {
        await supabase
          .from("conversations")
          .update({ ai_cnpj_attempts: 0 })
          .eq("id", conversationId);
      }
    }
  }

  if (wantsHuman(latestInbound.body)) {
    const summary = buildDeterministicHandoffSummary({
      reason: "explicit_human_request",
      latestUserMessage: latestInbound.body,
      values: currentValues,
    });
    return forceHandoffWithoutLlm({
      supabase,
      conversation,
      text: "Claro — vou te transferir para um atendente humano. Aguarde um momento.",
      reason: "explicit_human_request",
      notifyTitle: "Atendimento humano solicitado",
      notifyBody: truncate(summary.replace(/\n/g, " · "), 220),
      handoffSummary: summary,
    });
  }

  const offerPending = Boolean(
    (conversation as { handoff_offer_pending_at?: string | null })
      .handoff_offer_pending_at,
  );

  const lastAiBody = [...sessionMessages]
    .reverse()
    .find(
      (m) =>
        m.direction === "outbound" &&
        m.sender_type === "ai" &&
        typeof m.body === "string" &&
        m.body.trim(),
    )?.body as string | undefined;

  const awaitingHandoffConfirm =
    offerPending ||
    Boolean(lastAiBody && offersHandoffConfirmation(lastAiBody));

  if (awaitingHandoffConfirm && affirmsHandoffOffer(latestInbound.body)) {
    const summary = buildDeterministicHandoffSummary({
      reason: "cliente_confirmou_atendente",
      latestUserMessage: latestInbound.body,
      values: currentValues,
    });
    return forceHandoffWithoutLlm({
      supabase,
      conversation,
      text: "Perfeito — vou te transferir para um atendente. Aguarde um momento.",
      reason: "cliente_confirmou_atendente",
      notifyTitle: "Atendimento humano solicitado",
      notifyBody: truncate(summary.replace(/\n/g, " · "), 220),
      handoffSummary: summary,
    });
  }

  if (awaitingHandoffConfirm && declinesHandoffOffer(latestInbound.body)) {
    return replyAndStayOnAi({
      supabase,
      conversation,
      text: "Tranquilo — continuo te atendendo por aqui. Em que posso te ajudar?",
      clearHandoffOffer: true,
    });
  }

  const attributeBlock = buildAttributePromptBlock(attrList, currentValues, {
    name: contactEarly?.display_name,
    phone:
      contactEarly?.phone_e164 ||
      (contactEarly?.external_id ? `+${contactEarly.external_id}` : null),
    email: contactEarly?.email,
    company: contactEarly?.company_name,
  });

  const tiersByService = new Map<string, NonNullable<typeof tiers>>();
  for (const t of tiers ?? []) {
    const list = tiersByService.get(t.service_id) ?? [];
    list.push(t);
    tiersByService.set(t.service_id, list);
  }

  const catalog: ServiceForQuote[] = (services ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    offer_kind: (s.offer_kind === "service" ? "service" : "product") as
      | "product"
      | "service",
    billing_type: s.billing_type,
    unit_label: s.unit_label,
    unit_attribute_key: s.unit_attribute_key,
    base_price: Number(s.base_price),
    min_price: s.min_price != null ? Number(s.min_price) : null,
    is_active: s.is_active,
    tiers: (tiersByService.get(s.id) ?? []).map((t) => ({
      id: t.id,
      min_units: t.min_units,
      max_units: t.max_units,
      price: Number(t.price),
      price_mode: t.price_mode,
      sort_order: t.sort_order,
    })),
  }));

  // Abertura: nomes só (IA organiza). Preços entram depois / no orçamento.
  // Formato da mensagem = playbook + prompt, sem template de tenant no código.
  const openingTurn = isOpeningGreetingTurn(
    latestInbound.body,
    history.length,
  );
  const askedCatalogList = wantsCatalogList(latestInbound.body);

  let catalogBlock = openingTurn
    ? buildOpeningCatalogOutline(catalog)
    : buildCatalogPromptBlock(catalog);

  let quotedThisTurn = false;
  let quotedTotal: number | null = null;
  const units = resolveUnits(catalog, currentValues);
  // Só mensagens do cliente — respostas da IA listando o catálogo
  // re-orçavam todos os itens citados nos bastidores.
  const mentionForQuote = [
    latestInbound.body,
    ...sessionMessages
      .filter((m) => m.direction === "inbound" && m.body)
      .slice(-6)
      .map((m) => String(m.body)),
  ].join("\n");
  if (units != null && units > 0 && catalog.length > 0) {
    const quote = quoteCatalogFocused(catalog, units, {
      mentionText: mentionForQuote,
    });
    quotedThisTurn = quote.total > 0;
    quotedTotal = quote.total > 0 ? quote.total : null;
    if (quote.lines.length > 0) {
      catalogBlock = truncate(
        `${catalogBlock}\n\nORÇAMENTO PRÉ-CALCULADO PELO SISTEMA (${units} un. — só itens citados/selecionados) — use estes números, não some o catálogo inteiro:\n${formatQuoteMessage(quote, units)}`,
        AI_LIMITS.catalogBlock,
      );
    }
  }

  const funnelBlock = buildFunnelPromptBlock(dealStages ?? []);

  const provider = getDefaultAiProvider();
  const activePlaybook = pickActivePlaybook(
    (playbooks ?? []) as Playbook[],
    latestInbound.body,
  );
  const playbookBlock = buildPlaybookPromptBlock(activePlaybook);

  const tenant = tenantProfile;

  const companyBlock = tenant
    ? [
        `EMPRESA QUE VOCÊ REPRESENTA: ${tenant.name}`,
        tenant.about
          ? `Sobre: ${truncate(tenant.about, AI_LIMITS.about)}`
          : null,
        tenant.phone ? `Telefone: ${tenant.phone}` : null,
        tenant.website ? `Site: ${tenant.website}` : null,
        "Use esses dados na apresentação e quando o cliente perguntar sobre a empresa.",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const closeModeBlock =
    closeMode === "callback"
      ? `MODO DE FECHAMENTO: callback.
- NÃO ofereça transferir para atendente ao final do orçamento.
- Quando a proposta estiver pronta, agradeça e diga que a equipe entrará em contato.
- Só use action=handoff se o cliente pedir atendente/humano/consultor EXPLICITAMENTE.`
      : `MODO DE FECHAMENTO: handoff.
- Quando for fechar, o sistema pergunta se deseja atendente (não invente transferência sozinho).`;

  const resumeBlock = resumedAfterHuman
    ? `SESSÃO NOVA (após atendimento humano/encerramento):
- Ignore o histórico antigo da venda — esta é uma conversa retomada.
- NÃO faça handoff só porque os dados do lead já estão na base.
- Só ofereça atendente se o cliente pedir agora ou quiser fechar/contratar de novo nesta mensagem — e SEMPRE pergunte antes (action=reply).
- Cumprimente de forma breve e pergunte como pode ajudar hoje.`
    : "";

  const offerPendingBlock = awaitingHandoffConfirm
    ? `OFERTA DE ATENDENTE PENDENTE: você já perguntou se o cliente quer falar com um humano/consultor.
- Se confirmar (sim/ok/quero/pode), use action=handoff.
- Se recusar (não), use action=reply e continue ajudando.
- Se a mensagem for outro assunto, use action=reply e ajude no assunto (sem transferir).
- NÃO reinicie a conversa nem cumprimente de novo.`
    : "";

  const continueBlock =
    !resumedAfterHuman &&
    history.length > 2 &&
    isShortContinuation(latestInbound.body)
      ? `CONVERSA EM ANDAMENTO: o cliente só confirmou/cutucou ("${truncate(latestInbound.body, 40)}").
- NÃO cumprimente de novo. NÃO reapresente a empresa. NÃO reinicie o funil.
- Continue exatamente de onde parou (orçamento, dados pendentes ou próximo passo).
- Se o orçamento já foi combinado e falta só fechar, confirme e ofereça atendente (sim/não) se ainda não ofereceu.`
      : "";

  const light =
    !openingTurn &&
    !askedCatalogList &&
    !awaitingHandoffConfirm &&
    !continueBlock &&
    isLightContextTurn(latestInbound.body, history.length);

  let result: AiReplyResult = await provider.generateReply({
    agentName: aiConfig.name,
    instructions: aiConfig.instructions,
    presentation: aiConfig.presentation,
    history,
    latestUserMessage: latestInbound.body,
    playbookBlock: light
      ? [
          companyBlock,
          closeModeBlock,
          resumeBlock,
          offerPendingBlock,
          continueBlock,
          playbookBlock,
        ]
          .filter(Boolean)
          .join("\n\n")
      : [
          companyBlock,
          closeModeBlock,
          resumeBlock,
          offerPendingBlock,
          continueBlock,
          playbookBlock,
          funnelBlock,
        ]
          .filter(Boolean)
          .join("\n\n"),
    // Abertura: não cobre dados ainda. Demais turnos: sempre injeta conhecidos.
    attributeBlock: openingTurn ? undefined : attributeBlock,
    catalogBlock: light ? undefined : catalogBlock,
  });

  await recordAiReplyEvent({
    tenantId: conversation.tenant_id,
    conversationId,
  });

  if (planLimits && planLimits.maxAiRepliesMonth > 0) {
    const after = await getAiReplyUsageThisMonth(
      conversation.tenant_id,
      planLimits.maxAiRepliesMonth,
    );
    if (after.atLimit) {
      await disableTenantAi(conversation.tenant_id);
    }
  }

  await recordAiUsage({
    tenantId: conversation.tenant_id,
    conversationId,
    provider: provider.id,
    usage: result.usage,
  });

  const extracted = extractCollectedFromMessages(
    attrList,
    currentValues,
    sessionMessages.map((m) => ({
      direction: m.direction as "inbound" | "outbound",
      body: m.body,
      sender_type: m.sender_type,
    })),
    latestInbound.body,
  );
  // Extractor wins over model (avoids CNPJ fragment → ramo/colaboradores).
  const collected = sanitizeCollected(
    attrList,
    mergeCollected(result.collected, extracted),
  );

  // Snapshot: se os dados já estavam completos antes deste turno, NÃO forçar handoff
  // (bug: segunda conversa com lead já preenchido era jogada pra humano à toa).
  const wasReadyBefore = requiredAttributesFilled(attrList, currentValues);

  if (Object.keys(collected).length > 0) {
    await persistCollectedAttributes({
      supabase,
      tenantId: conversation.tenant_id,
      contactId: conversation.contact_id,
      attributes: attrList,
      collected,
    });
    for (const [k, v] of Object.entries(collected)) {
      currentValues[k] = v;
    }
  }

  const filledAttrCount = Object.values(currentValues).filter(
    (v) => (v ?? "").trim().length > 0,
  ).length;

  // Recompute after collect (ex.: citou um item + qty no atributo).
  // Não mistura a resposta da IA — ela pode repetir o catálogo e inflar o total.
  {
    const unitsAfter = resolveUnits(catalog, currentValues);
    if (unitsAfter != null && unitsAfter > 0 && catalog.length > 0) {
      const quote = quoteCatalogFocused(catalog, unitsAfter, {
        mentionText: mentionForQuote,
      });
      if (quote.total > 0) {
        quotedThisTurn = true;
        quotedTotal = quote.total;
      } else if (!quotedThisTurn) {
        quotedTotal = null;
      }
    }
  }

  const aiSaidQuote =
    result.action === "reply" &&
    /r\$\s*\d|valor\s+total|or[cç]amento/i.test(result.text ?? "");

  const dataReady = requiredAttributesFilled(attrList, currentValues);
  const justBecameReady = dataReady && !wasReadyBefore;
  const buyIntent = wantsToCloseSale(latestInbound.body);
  const askedForHuman = wantsHuman(latestInbound.body);
  const confirmedOffer =
    awaitingHandoffConfirm && affirmsHandoffOffer(latestInbound.body);

  const shouldCloseSale =
    result.action === "reply" &&
    !awaitingHandoffConfirm &&
    (buyIntent ||
      (!resumedAfterHuman &&
        justBecameReady &&
        (quotedThisTurn || aiSaidQuote || catalog.length === 0)));

  let markHandoffOfferPending = false;
  let markCallbackClose = false;

  const CALLBACK_CLOSE_TEXT =
    "Perfeito! Registrei suas informações e o interesse no orçamento. Nossa equipe vai entrar em contato em breve para dar continuidade. Obrigado!";

  // Modelo já perguntou sim/não → só marca pendente (modo handoff).
  if (
    closeMode === "handoff" &&
    result.action === "reply" &&
    !awaitingHandoffConfirm &&
    offersHandoffConfirmation(result.text ?? "")
  ) {
    markHandoffOfferPending = true;
  } else if (confirmedOffer && result.action === "reply") {
    result = {
      action: "handoff",
      reason: "cliente_confirmou_atendente",
      text: "Perfeito — vou te transferir para um atendente. Aguarde um momento.",
      handoff_summary: buildDeterministicHandoffSummary({
        reason: "cliente_confirmou_atendente",
        latestUserMessage: latestInbound.body,
        values: currentValues,
        quotedTotal,
      }),
      collected: result.collected,
      usage: result.usage,
    };
  } else if (shouldCloseSale) {
    if (closeMode === "callback") {
      const prior =
        (result.text ?? "").trim() &&
        !/entrar em contato|equipe vai|atendente|transfer/i.test(
          result.text ?? "",
        )
          ? `${result.text!.trim()}\n\n`
          : "";
      const dealStage =
        result.action === "reply" ? result.deal_stage : undefined;
      result = {
        action: "reply",
        text: `${prior}${CALLBACK_CLOSE_TEXT}`,
        collected: result.collected,
        usage: result.usage,
        deal_stage: dealStage,
      };
      markCallbackClose = true;
    } else {
      const dealStage =
        result.action === "reply" ? result.deal_stage : undefined;
      result = {
        action: "reply",
        text: buildHandoffOfferText(result.text),
        collected: result.collected,
        usage: result.usage,
        deal_stage: dealStage,
      };
      markHandoffOfferPending = true;
    }
  } else if (result.action === "handoff" && !askedForHuman && !confirmedOffer) {
    const spurious =
      resumedAfterHuman || (dataReady && !justBecameReady);
    if (spurious) {
      result = {
        action: "reply",
        text:
          (result.text && !/transfer|atendente humano/i.test(result.text)
            ? result.text
            : null) ||
          (resumedAfterHuman
            ? "Oi! Em que posso te ajudar agora?"
            : "Claro — me conta como posso ajudar."),
        collected: result.collected,
        usage: result.usage,
      };
    } else if (closeMode === "callback") {
      result = {
        action: "reply",
        text: CALLBACK_CLOSE_TEXT,
        collected: result.collected,
        usage: result.usage,
      };
      markCallbackClose = true;
    } else {
      result = {
        action: "reply",
        text: buildHandoffOfferText(result.text),
        collected: result.collected,
        usage: result.usage,
      };
      markHandoffOfferPending = true;
    }
  }

  const stageHint =
    (result.action === "reply" ? result.deal_stage : null) ||
    inferDealStageHint({
      latestUserMessage: latestInbound.body,
      aiReplyText: result.text,
      collectedKeys: Object.keys(collected),
      filledAttrCount,
      quotedThisTurn: quotedThisTurn || aiSaidQuote,
    });

  const contact = conversation.contacts as unknown as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
  } | null;

  if (stageHint || filledAttrCount >= 1 || quotedThisTurn) {
    await ensureDealAndAdvanceStage({
      supabase,
      tenantId: conversation.tenant_id,
      contactId: conversation.contact_id,
      conversationId,
      contactName: contact?.display_name ?? null,
      stageHint,
      dealValue: quotedTotal,
    });
  }

  const { data: fresh } = await supabase
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();

  if (!fresh || !canAiReply(fresh.status)) {
    return { skipped: "status_changed" as const, status: fresh?.status };
  }

  const channel = conversation.channels as unknown as {
    whatsapp_accounts:
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  if (!wa || !to) {
    return { skipped: "missing_channel_or_contact" as const };
  }

  const outboundFallback =
    "Recebi sua mensagem. Pode me confirmar o dado que pedi?";
  const outboundTextRaw =
    result.action === "handoff"
      ? result.text ||
        "Vou te transferir para um atendente humano. Aguarde um momento."
      : result.text;

  const outboundText = sanitizeOutboundAiText(
    outboundTextRaw,
    outboundFallback,
  );

  let providerMessageId: string | null = null;
  try {
    const token = decryptToken(wa.access_token_encrypted);
    providerMessageId = await sendOutboundText({
      channel: wa,
      accessToken: token,
      toE164: to,
      body: outboundText,
    });
  } catch (err) {
    console.error("[ai] send failed", err);
    return {
      error: err instanceof Error ? err.message : "send_failed",
    };
  }

  const now = new Date().toISOString();
  await supabase.from("messages").insert({
    tenant_id: conversation.tenant_id,
    conversation_id: conversationId,
    direction: "outbound",
    sender_type: "ai",
    body: outboundText,
    provider_message_id: providerMessageId,
    created_at: now,
  });

  if (result.action === "handoff") {
    await supabase
      .from("conversations")
      .update({
        status: "waiting_human",
        last_message_at: now,
        waiting_human_at: now,
        handoff_busy_sent_at: null,
        handoff_offer_pending_at: null,
      })
      .eq("id", conversationId)
      .eq("status", "ai_active");

    const summary =
      (result.handoff_summary && result.handoff_summary.trim()) ||
      buildDeterministicHandoffSummary({
        reason: result.reason,
        latestUserMessage: latestInbound.body,
        values: currentValues,
        quotedTotal,
      });

    await persistHandoffNoteOnContact({
      supabase,
      contactId: conversation.contact_id,
      summary,
    });

    const contactLabel =
      contact?.display_name ||
      contact?.phone_e164 ||
      contact?.external_id ||
      "Contato";

    await createAppNotification({
      tenantId: conversation.tenant_id,
      type: "handoff",
      title: "Atendimento humano solicitado",
      body: `${contactLabel}: ${truncate(summary.replace(/\n/g, " · "), 220)}`,
      conversationId,
    });
  } else if (markCallbackClose) {
    const summary = buildDeterministicHandoffSummary({
      reason: "callback_agendado",
      latestUserMessage: latestInbound.body,
      values: currentValues,
      quotedTotal,
    });

    await supabase
      .from("conversations")
      .update({
        status: "resolved",
        last_message_at: now,
        waiting_human_at: null,
        handoff_busy_sent_at: null,
        handoff_offer_pending_at: null,
        assigned_to: null,
      })
      .eq("id", conversationId)
      .eq("status", "ai_active");

    await persistHandoffNoteOnContact({
      supabase,
      contactId: conversation.contact_id,
      summary,
    });

    const contactLabel =
      contact?.display_name ||
      contact?.phone_e164 ||
      contact?.external_id ||
      "Contato";

    await createAppNotification({
      tenantId: conversation.tenant_id,
      type: "handoff",
      title: "Lead pronto — retornar depois",
      body: `${contactLabel}: ${truncate(summary.replace(/\n/g, " · "), 220)}`,
      conversationId,
    });
  } else {
    await supabase
      .from("conversations")
      .update({
        last_message_at: now,
        ...(markHandoffOfferPending
          ? { handoff_offer_pending_at: now }
          : {}),
      })
      .eq("id", conversationId);
  }

  await ensureDealAndAdvanceStage({
    supabase,
    tenantId: conversation.tenant_id,
    contactId: conversation.contact_id,
    conversationId,
    contactName: contact?.display_name ?? null,
    stageHint:
      result.action === "handoff" || markCallbackClose
        ? buyIntent
          ? "Negociação"
          : quotedThisTurn || aiSaidQuote
            ? "Orçamento"
            : "Qualificado"
        : stageHint,
    dealValue: quotedTotal,
  });

  return {
    ok: true as const,
    action: result.action,
    conversationId,
    collected,
    stageHint,
  };
}

function resolveUnits(
  catalog: ServiceForQuote[],
  values: Record<string, string | null>,
): number | null {
  const keys = new Set<string>();
  for (const s of catalog) {
    if (s.unit_attribute_key) keys.add(s.unit_attribute_key);
  }
  keys.add("tamanho");
  keys.add("funcionarios");
  keys.add("colaboradores");

  for (const key of keys) {
    const raw = values[key];
    if (!raw) continue;
    const n = Number(String(raw).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

type ConvRow = {
  id: string;
  tenant_id: string;
  contact_id: string;
  contacts: unknown;
  channels: unknown;
};

async function forceHandoffWithoutLlm({
  supabase,
  conversation,
  text,
  reason,
  notifyTitle,
  notifyBody,
  handoffSummary,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  conversation: ConvRow;
  text: string;
  reason: string;
  notifyTitle: string;
  notifyBody: string;
  handoffSummary?: string;
}) {
  const contact = conversation.contacts as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
  } | null;

  const channel = conversation.channels as {
    whatsapp_accounts:
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  const now = new Date().toISOString();

  if (wa && to) {
    try {
      const token = decryptToken(wa.access_token_encrypted);
      const providerMessageId = await sendOutboundText({
        channel: wa,
        accessToken: token,
        toE164: to,
        body: text,
      });
      await supabase.from("messages").insert({
        tenant_id: conversation.tenant_id,
        conversation_id: conversation.id,
        direction: "outbound",
        sender_type: "ai",
        body: text,
        provider_message_id: providerMessageId,
        created_at: now,
      });
    } catch (err) {
      console.error("[ai] handoff send failed", reason, err);
    }
  }

  await supabase
    .from("conversations")
    .update({
      status: "waiting_human",
      last_message_at: now,
      waiting_human_at: now,
      handoff_busy_sent_at: null,
      handoff_offer_pending_at: null,
      ...(reason === "spam_bloqueado"
        ? { ai_spam_blocked_at: now }
        : {}),
    })
    .eq("id", conversation.id)
    .eq("status", "ai_active");

  const summary =
    handoffSummary?.trim() ||
    buildDeterministicHandoffSummary({ reason });

  await persistHandoffNoteOnContact({
    supabase,
    contactId: conversation.contact_id,
    summary,
  });

  const contactLabel =
    contact?.display_name ||
    contact?.phone_e164 ||
    contact?.external_id ||
    "Contato";

  await createAppNotification({
    tenantId: conversation.tenant_id,
    type: "handoff",
    title: notifyTitle,
    body: `${contactLabel}: ${notifyBody}`,
    conversationId: conversation.id,
  });

  return {
    ok: true as const,
    action: "handoff" as const,
    conversationId: conversation.id,
    skippedLlm: true as const,
    reason,
  };
}

async function replyAndStayOnAi({
  supabase,
  conversation,
  text,
  clearHandoffOffer,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  conversation: ConvRow;
  text: string;
  clearHandoffOffer?: boolean;
}) {
  const contact = conversation.contacts as {
    phone_e164: string | null;
    external_id: string | null;
    display_name: string | null;
  } | null;

  const channel = conversation.channels as {
    whatsapp_accounts:
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }
      | {
          phone_number_id: string;
          access_token_encrypted: string;
          onboard_source?: string;
        }[]
      | null;
  } | null;

  const wa = Array.isArray(channel?.whatsapp_accounts)
    ? channel?.whatsapp_accounts[0]
    : channel?.whatsapp_accounts;

  const to =
    contact?.phone_e164 ||
    (contact?.external_id ? `+${contact.external_id}` : null);

  const now = new Date().toISOString();

  if (wa && to) {
    try {
      const token = decryptToken(wa.access_token_encrypted);
      const providerMessageId = await sendOutboundText({
        channel: wa,
        accessToken: token,
        toE164: to,
        body: text,
      });
      await supabase.from("messages").insert({
        tenant_id: conversation.tenant_id,
        conversation_id: conversation.id,
        direction: "outbound",
        sender_type: "ai",
        body: text,
        provider_message_id: providerMessageId,
        created_at: now,
      });
    } catch (err) {
      console.error("[ai] stay-on-ai send failed", err);
      return {
        error: err instanceof Error ? err.message : "send_failed",
      };
    }
  }

  await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      ...(clearHandoffOffer ? { handoff_offer_pending_at: null } : {}),
    })
    .eq("id", conversation.id);

  return {
    ok: true as const,
    action: "reply" as const,
    conversationId: conversation.id,
    skippedLlm: true as const,
  };
}

async function persistHandoffNoteOnContact({
  supabase,
  contactId,
  summary,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  contactId: string;
  summary: string;
}) {
  const { data: row } = await supabase
    .from("contacts")
    .select("notes")
    .eq("id", contactId)
    .maybeSingle();

  const notes = mergeHandoffNote(row?.notes, summary);
  const { error } = await supabase
    .from("contacts")
    .update({ notes })
    .eq("id", contactId);
  if (error) {
    console.error("[ai] handoff note failed", error.message);
  }
}

async function persistCollectedAttributes({
  supabase,
  tenantId,
  contactId,
  attributes,
  collected,
}: {
  supabase: ReturnType<typeof createServiceClient>;
  tenantId: string;
  contactId: string;
  attributes: { id: string; key: string }[];
  collected: Record<string, string>;
}) {
  const byKey = new Map(attributes.map((a) => [a.key, a.id]));
  const contactPatch: {
    company_name?: string;
    email?: string;
    display_name?: string;
  } = {};

  for (const [key, value] of Object.entries(collected)) {
    const attributeId = byKey.get(key);
    const trimmed = value.trim();
    if (!attributeId || !trimmed) continue;

    const { error } = await supabase.from("contact_attribute_values").upsert(
      {
        tenant_id: tenantId,
        contact_id: contactId,
        attribute_id: attributeId,
        value: trimmed,
      },
      { onConflict: "contact_id,attribute_id" },
    );
    if (error) {
      console.error("[ai] persist attribute failed", key, error.message);
      continue;
    }

    if (key === "empresa" || key === "company" || key === "company_name") {
      contactPatch.company_name = trimmed;
    }
    if (key === "email") contactPatch.email = trimmed;
    if (key === "responsavel" || key === "nome") {
      contactPatch.display_name = trimmed;
    }
  }

  if (Object.keys(contactPatch).length > 0) {
    const { error } = await supabase
      .from("contacts")
      .update(contactPatch)
      .eq("id", contactId);
    if (error) {
      console.error("[ai] contact patch failed", error.message);
    }
  }
}
