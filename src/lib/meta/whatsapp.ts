import { createHmac, timingSafeEqual } from "crypto";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v22.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex"),
    );
  } catch {
    return false;
  }
}

export async function exchangeEmbeddedSignupCode(code: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META app credentials are not configured");
  }

  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const res = await fetch(url, { method: "GET" });
  const data = (await res.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Failed to exchange Meta code");
  }
  return data.access_token;
}

export async function subscribeWabaToWebhooks(
  wabaId: string,
  accessToken: string,
) {
  const res = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: { message?: string } }).error?.message ??
        "Failed to subscribe WABA webhooks",
    );
  }
  return data;
}

export async function fetchPhoneNumberDetails(
  phoneNumberId: string,
  accessToken: string,
) {
  const url = new URL(`${GRAPH_BASE}/${phoneNumberId}`);
  url.searchParams.set(
    "fields",
    "display_phone_number,verified_name,quality_rating",
  );
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to fetch phone number");
  }
  return data;
}

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  body: string;
}) {
  const to = params.toE164.replace(/\D/g, "");
  const res = await fetch(
    `${GRAPH_BASE}/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: params.body },
      }),
    },
  );
  const data = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to send WhatsApp message");
  }
  return data.messages?.[0]?.id ?? null;
}
