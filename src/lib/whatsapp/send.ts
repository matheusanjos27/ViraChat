import {
  isEvolutionConfigured,
  sendEvolutionText,
} from "@/lib/evolution/client";

export type OutboundChannel = {
  phone_number_id: string;
  access_token_encrypted: string;
  onboard_source?: string | null;
};

/** Envia texto via Evolution/Baileys. */
export async function sendOutboundText(params: {
  channel: OutboundChannel;
  accessToken: string;
  toE164: string;
  body: string;
}) {
  void params.accessToken;

  if (!isEvolutionConfigured()) {
    throw new Error(
      "EVOLUTION_API_URL/KEY não configuradas — WhatsApp só via Baileys.",
    );
  }

  return sendEvolutionText({
    instanceName: params.channel.phone_number_id,
    toE164: params.toE164,
    text: params.body,
  });
}
