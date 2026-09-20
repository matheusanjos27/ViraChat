/**
 * Cliente HTTP da Evolution API (Baileys por baixo).
 * Docs: https://doc.evolution-api.com
 */

function baseUrl() {
  const url = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  if (!url) throw new Error("EVOLUTION_API_URL não configurada");
  return url;
}

function apiKey() {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY não configurada");
  return key;
}

function headers() {
  return {
    "Content-Type": "application/json",
    apikey: apiKey(),
  };
}

export function isEvolutionConfigured() {
  return Boolean(
    process.env.EVOLUTION_API_URL?.trim() &&
      process.env.EVOLUTION_API_KEY?.trim(),
  );
}

export function evolutionWebhookUrl() {
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!app) throw new Error("NEXT_PUBLIC_APP_URL não configurada");
  return `${app}/api/webhooks/evolution`;
}

export type CreateInstanceResult = {
  instanceName: string;
  qrcodeBase64: string | null;
  pairingCode: string | null;
};

export async function createEvolutionInstance(params: {
  instanceName: string;
  displayName?: string;
}): Promise<CreateInstanceResult> {
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();

  const body: Record<string, unknown> = {
    instanceName: params.instanceName,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
    webhook: {
      enabled: true,
      url: evolutionWebhookUrl(),
      byEvents: false,
      base64: false,
      events: [
        "QRCODE_UPDATED",
        "CONNECTION_UPDATE",
        "MESSAGES_UPSERT",
      ],
      ...(webhookSecret
        ? {
            headers: {
              authorization: `Bearer ${webhookSecret}`,
            },
          }
        : {}),
    },
  };

  const res = await fetch(`${baseUrl()}/instance/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    instance?: { instanceName?: string; status?: string };
    hash?: { apikey?: string } | string;
    qrcode?: { base64?: string; pairingCode?: string | null; code?: string };
    error?: string;
    message?: string | string[];
    response?: { message?: string | string[] };
  };

  if (!res.ok) {
    const msg =
      data.error ||
      (Array.isArray(data.message) ? data.message.join(", ") : data.message) ||
      (Array.isArray(data.response?.message)
        ? data.response?.message.join(", ")
        : data.response?.message) ||
      `Falha ao criar instância Evolution (HTTP ${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return {
    instanceName: data.instance?.instanceName ?? params.instanceName,
    qrcodeBase64: data.qrcode?.base64 ?? null,
    pairingCode: data.qrcode?.pairingCode ?? null,
  };
}

export async function connectEvolutionInstance(instanceName: string) {
  const res = await fetch(
    `${baseUrl()}/instance/connect/${encodeURIComponent(instanceName)}`,
    { method: "GET", headers: headers() },
  );
  const data = (await res.json()) as {
    base64?: string;
    pairingCode?: string | null;
    code?: string;
    count?: number;
    qrcode?: { base64?: string; pairingCode?: string | null };
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      data.error || data.message || `Falha ao obter QR (HTTP ${res.status})`,
    );
  }
  return {
    qrcodeBase64: data.base64 ?? data.qrcode?.base64 ?? null,
    pairingCode: data.pairingCode ?? data.qrcode?.pairingCode ?? null,
  };
}

export async function getEvolutionConnectionState(instanceName: string) {
  const res = await fetch(
    `${baseUrl()}/instance/connectionState/${encodeURIComponent(instanceName)}`,
    { method: "GET", headers: headers() },
  );
  const data = (await res.json()) as {
    instance?: { instanceName?: string; state?: string };
    state?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Falha ao ler status (HTTP ${res.status})`);
  }
  return (
    data.instance?.state ?? data.state ?? "close"
  ).toLowerCase() as string;
}

export async function deleteEvolutionInstance(instanceName: string) {
  const res = await fetch(
    `${baseUrl()}/instance/delete/${encodeURIComponent(instanceName)}`,
    { method: "DELETE", headers: headers() },
  );
  if (res.status === 404) return;
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(
      data.error || data.message || `Falha ao apagar instância (HTTP ${res.status})`,
    );
  }
}

export async function sendEvolutionText(params: {
  instanceName: string;
  toE164: string;
  text: string;
}) {
  const number = params.toE164.replace(/\D/g, "");
  const res = await fetch(
    `${baseUrl()}/message/sendText/${encodeURIComponent(params.instanceName)}`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        number,
        text: params.text,
      }),
    },
  );
  const data = (await res.json()) as {
    key?: { id?: string };
    message?: { key?: { id?: string } };
    error?: string;
    response?: { message?: string | string[] };
  };
  if (!res.ok) {
    const msg =
      data.error ||
      (Array.isArray(data.response?.message)
        ? data.response.message.join(", ")
        : data.response?.message) ||
      `Falha ao enviar via Evolution (HTTP ${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data.key?.id ?? data.message?.key?.id ?? null;
}
