import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  createPreviewSupabase,
  isUiPreview,
} from "@/lib/dev/ui-preview";
import type { Database } from "@/lib/supabase/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function createClient(): Promise<AnyClient> {
  if (isUiPreview()) {
    return createPreviewSupabase();
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when proxy refreshes sessions.
          }
        },
      },
    },
  );
}
