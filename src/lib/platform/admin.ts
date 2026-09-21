import { createClient } from "@/lib/supabase/server";

export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function isCurrentUserPlatformAdmin() {
  const { isUiPreview } = await import("@/lib/dev/ui-preview");
  if (isUiPreview()) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return true;

  // Bootstrap via env (first login)
  const email = user.email?.toLowerCase() ?? "";
  if (platformAdminEmails().includes(email)) {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    await admin.from("platform_admins").upsert({ user_id: user.id });
    return true;
  }

  return false;
}
