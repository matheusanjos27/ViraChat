import { redirect } from "next/navigation";

export default function AssistantRedirect() {
  redirect("/app/settings/ai?tab=ligar");
}
