import { redirect } from "next/navigation";

export default function ServicesRedirect() {
  redirect("/app/settings/ai?tab=catalogo");
}
