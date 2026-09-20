import { NextResponse } from "next/server";
import { processHandoffTimeouts } from "@/lib/handoff/timeout";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron: every minute.
 * Auth: Authorization Bearer CRON_SECRET (Vercel sets this automatically when CRON_SECRET env exists).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processHandoffTimeouts();
  return NextResponse.json({ ok: true, ...result });
}
