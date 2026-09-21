import { createBrowserClient } from "@supabase/ssr";
import {
  createPreviewSupabase,
  isUiPreview,
} from "@/lib/dev/ui-preview";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  if (isUiPreview()) {
    return createPreviewSupabase() as unknown as ReturnType<
      typeof createBrowserClient<Database>
    >;
  }

  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
