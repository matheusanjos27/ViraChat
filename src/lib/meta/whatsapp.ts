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

  // Prefer unversioned OAuth endpoint with form body (Embedded Signup / Login for Business).
  // GET /{version}/oauth/access_token is sometimes parsed as a Graph field and returns
  // "(#100) Tried accessing nonexisting field (access_token)".
  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  const endpoints = [
    "https://graph.facebook.com/oauth/access_token",
    `${GRAPH_BASE}/oauth/access_token`,
  ];

  let lastError = "Failed to exchange Meta code";
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as {
      access_token?: string;
      error?: { message?: string; code?: number; error_subcode?: number };
    };
    if (res.ok && data.access_token) {
      return data.access_token;
    }
    lastError =
      data.error?.message ??
      `Failed to exchange Meta code (HTTP ${res.status})`;
  }

  throw new Error(lastError);
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

/**
 * When the WA_EMBEDDED_SIGNUP postMessage is missing (common if the spawn
 * domain is not in Allowed Domains), recover the shared WABA from the token.
 * Newest WABA is first in target_ids.
 */
export async function discoverWabaIdFromToken(accessToken: string) {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META app credentials are not configured");
  }

  const url = new URL(`${GRAPH_BASE}/debug_token`);
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const res = await fetch(url, { method: "GET" });
  const payload = (await res.json()) as {
    data?: {
      is_valid?: boolean;
      scopes?: string[];
      granular_scopes?: { scope?: string; target_ids?: string[] }[];
    };
    error?: { message?: string };
  };

  if (!res.ok || payload.error) {
    throw new Error(
      payload.error?.message ?? "Failed to inspect Meta access token",
    );
  }

  const granular = payload.data?.granular_scopes ?? [];
  const management = granular.find(
    (s) => s.scope === "whatsapp_business_management",
  );
  const messaging = granular.find(
    (s) => s.scope === "whatsapp_business_messaging",
  );
  const wabaId =
    management?.target_ids?.[0] ?? messaging?.target_ids?.[0] ?? null;

  return {
    wabaId,
    scopes: payload.data?.scopes ?? [],
    isValid: payload.data?.is_valid !== false,
  };
}

/** When Embedded Signup returns only waba_id, discover the first phone number. */
export async function listPhoneNumbersForWaba(
  wabaId: string,
  accessToken: string,
) {
  const url = new URL(`${GRAPH_BASE}/${wabaId}/phone_numbers`);
  url.searchParams.set(
    "fields",
    "id,display_phone_number,verified_name,quality_rating",
  );
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    data?: {
      id: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
    }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to list WABA phone numbers");
  }
  return data.data ?? [];
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
