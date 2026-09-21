"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withTimeout } from "@/lib/async/with-timeout";
import { createClient } from "@/lib/supabase/client";

const REFRESH_EVERY_MS = 4 * 60 * 1000;
const EXPIRING_SOON_MS = 2 * 60 * 1000;
const AUTH_TIMEOUT_MS = 12_000;

/**
 * Mantém a sessão Supabase viva com a aba aberta e reanima ao voltar
 * do background (evita “site travado” após idle — só F5 liberava).
 */
export function useSupabaseKeepAlive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let busy = false;
    let busySince = 0;

    async function refresh(reason: string) {
      // Se um refresh anterior travou, libera após timeout.
      if (busy && Date.now() - busySince > AUTH_TIMEOUT_MS + 1000) {
        busy = false;
      }
      if (busy) return;
      if (document.hidden && reason !== "visible") return;

      busy = true;
      busySince = Date.now();
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          "getSession",
        );
        if (error) {
          console.warn("[auth] getSession", reason, error.message);
        }
        const expiresAt = (data.session?.expires_at ?? 0) * 1000;
        const needsRefresh =
          !data.session ||
          !expiresAt ||
          expiresAt - Date.now() < EXPIRING_SOON_MS;

        if (needsRefresh) {
          const { error: refreshError } = await withTimeout(
            supabase.auth.refreshSession(),
            AUTH_TIMEOUT_MS,
            "refreshSession",
          );
          if (refreshError) {
            console.warn("[auth] refreshSession", reason, refreshError.message);
            if (
              /refresh|session|expired|invalid/i.test(refreshError.message)
            ) {
              window.location.href = "/login";
              return;
            }
          }
        }

        if (reason === "visible" || reason === "mount") {
          router.refresh();
        }
      } catch (err) {
        console.warn("[auth] keep-alive failed", reason, err);
      } finally {
        busy = false;
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        // Destrava keep-alive e puxa dados frescos do servidor.
        busy = false;
        void refresh("visible");
      }
    }

    void refresh("mount");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const id = window.setInterval(() => {
      void refresh("interval");
    }, REFRESH_EVERY_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(id);
    };
  }, [router]);
}
