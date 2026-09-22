import { redirect } from "next/navigation";

/** Convites ficam na ficha do cliente — /platform/tenants/[id]. */
export default function PlatformInvitesRedirectPage() {
  redirect("/platform/tenants");
}
