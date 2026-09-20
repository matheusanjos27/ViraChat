import {
  isEvolutionConfigured,
  sendEvolutionText,
} from "@/lib/evolution/client";
import { sendWhatsAppText } from "@/lib/meta/whatsapp";

export type OutboundChannel = {
  phone_number_id: string;
  access_token_encrypted: string;
  onboard_source?: string | null;
};

/**
 * Envia texto pelo provedor do canal (Meta Cloud API ou Evolution/Baileys).
 */
export async function sendOutboundText(params: {
  channel: OutboundChannel;
  accessToken: string;
  toE164: string;
  body: string;
}) {
  const source = params.channel.onboard_source ?? "manual";

  if (source === "baileys") {
    if (!isEvolutionConfigured()) {
      throw new Error(
        "Canal Baileys conectado, mas EVOLUTION_API_URL/KEY não estão configuradas.",
      );
    }
    return sendEvolutionText({
      instanceName: params.channel.phone_number_id,
      toE164: params.toE164,
      text: params.body,
    });
  }

  return sendWhatsAppText({
    phoneNumberId: params.channel.phone_number_id,
    accessToken: params.accessToken,
    toE164: params.toE164,
    body: params.body,
  });
}
