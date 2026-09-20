import { redirect } from "next/navigation";

export default function FieldsRedirect() {
  redirect("/app/settings/ai?tab=campos");
}
