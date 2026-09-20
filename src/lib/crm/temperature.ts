export type LeadTemperature = "hot" | "warm" | "cold";

export function temperatureLabel(t: LeadTemperature) {
  if (t === "hot") return "Quente";
  if (t === "warm") return "Morno";
  return "Frio";
}

export function temperatureClass(t: LeadTemperature) {
  if (t === "hot") return "bg-red-50 text-red-700";
  if (t === "warm") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

/** Heurística genérica — sem regras de negócio de um setor específico. */
export function computeTemperature(input: {
  lastMessageAt: string | null;
  conversationStatus: string | null;
  hasDealInPipeline: boolean;
  dealIsClosedWon: boolean;
  attributeFillRate: number; // 0–1
  inboundCount: number;
}): LeadTemperature {
  if (input.dealIsClosedWon) return "warm";

  let score = 40;

  const daysSince = input.lastMessageAt
    ? (Date.now() - new Date(input.lastMessageAt).getTime()) / 86400000
    : 999;

  if (daysSince <= 0.5) score += 25;
  else if (daysSince <= 1) score += 18;
  else if (daysSince <= 3) score += 8;
  else if (daysSince <= 7) score -= 10;
  else score -= 30;

  if (input.conversationStatus === "waiting_human") score += 20;
  if (input.conversationStatus === "human_active") score += 15;
  if (input.conversationStatus === "ai_active") score += 5;
  if (input.conversationStatus === "resolved") score -= 15;

  if (input.hasDealInPipeline) score += 12;
  score += Math.round(input.attributeFillRate * 20);
  if (input.inboundCount >= 4) score += 10;
  else if (input.inboundCount >= 2) score += 5;

  if (score >= 65) return "hot";
  if (score >= 35) return "warm";
  return "cold";
}
