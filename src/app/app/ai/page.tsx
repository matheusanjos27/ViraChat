import { redirect } from "next/navigation";

/** Unificado em Configurações → IA */
export default function AiLegacyRedirect() {
  redirect("/app/settings/ai");
}
