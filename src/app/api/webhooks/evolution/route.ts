import { NextResponse } from "next/server";
import { runAiForConversation } from "@/lib/ai/orchestrate";
import { processEvolutionWebhook } from "@/lib/whatsapp/evolution-webhook";

export const runtime = "nodejs";

function authorize(req: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header =
    req.headers.get("authorization") ||
    req.headers.get("Authorization") ||
    "";
  if (header === `Bearer ${secret}`) return true;
  if (header === secret) return true;
  const apikey = req.headers.get("apikey");
  if (apikey === secret) return true;
  return false;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await processEvolutionWebhook(
      payload as {
        event?: string;
        instance?: string;
        data?: Record<string, unknown>;
      },
    );

    // Dispara IA para cada conversa nova (mesmo padrão do webhook Meta)
    for (const conversationId of result.conversationIds) {
      void runAiForConversation(conversationId).catch((err) =>
        console.error("[evolution] ai error", conversationId, err),
      );
    }

    return NextResponse.json({ ok: true, handled: result.handled });
  } catch (err) {
    console.error("[evolution] webhook error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "webhook_failed" },
      { status: 500 },
    );
  }
}
