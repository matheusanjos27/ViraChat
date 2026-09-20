import { redirect } from "next/navigation";

/** Unificado em Configurações → IA */
export default function AssistantRedirect() {
  redirect("/app/settings/ai");
}
