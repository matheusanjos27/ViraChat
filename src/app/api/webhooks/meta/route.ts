import { after, NextResponse } from "next/server";
import { runAiForConversation } from "@/lib/ai/orchestrate";
import { verifyMetaSignature } from "@/lib/meta/whatsapp";
import { processWhatsAppWebhookPayload } from "@/lib/whatsapp/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Meta webhook verification (hub.challenge).
 * Callback URL: {APP_URL}/api/webhooks/meta
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const skipSig =
    process.env.NODE_ENV === "development" &&
    process.env.META_SKIP_SIGNATURE_VERIFY === "true";

  if (!skipSig && !verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processWhatsAppWebhookPayload(
      payload as Parameters<typeof processWhatsAppWebhookPayload>[0],
    );

    const uniqueIds = [...new Set(result.conversationIds ?? [])];
    if (uniqueIds.length > 0) {
      after(async () => {
        for (const conversationId of uniqueIds) {
          try {
            await runAiForConversation(conversationId);
          } catch (err) {
            console.error("[ai] orchestrate failed", conversationId, err);
          }
        }
      });
    }

    return NextResponse.json({ ok: true, handled: result.handled });
  } catch (err) {
    console.error("[meta webhook]", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
