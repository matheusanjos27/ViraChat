import { redirect } from "next/navigation";

/** Unificado em Configurações → IA */
export default function PlaybookRedirect() {
  redirect("/app/settings/ai");
}
