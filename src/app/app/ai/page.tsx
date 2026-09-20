import { redirect } from "next/navigation";

/** Tela antiga — unificada em Configurações → Assistente. */
export default function AiSettingsRedirect() {
  redirect("/app/settings/assistant");
}
