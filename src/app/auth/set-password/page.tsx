"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SetPasswordForm } from "@/components/auth/set-password-form";

type Status = "loading" | "ready" | "error";

export default function SetPasswordPage() {
  const [status, setStatus] = useState<Status>("loading");
  const router = useRouter();

  useEffect(() => {
    async function handleHash() {
      const hash = window.location.hash.substring(1); // remove o "#"
      if (!hash) {
        // Se não há hash, talvez o usuário já esteja autenticado
        // (ex: recuperação de senha via token_hash no servidor)
        setStatus("ready");
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        setStatus("error");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setStatus("error");
        return;
      }

      // Limpa o hash da URL sem recarregar a página
      window.history.replaceState(null, "", window.location.pathname);
      setStatus("ready");
    }

    handleHash();
  }, [router]);

  if (status === "loading") {
    return (
      <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
        <p className="text-ink-muted text-sm">Verificando convite…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-ink font-medium">Link inválido ou expirado</p>
          <p className="text-ink-muted mt-1 text-sm">
            Peça ao administrador para reenviar o convite.
          </p>
          <a
            href="/login"
            className="mt-4 inline-block text-sm text-brand hover:underline"
          >
            Ir para login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="rise-in w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="brand-mark text-4xl text-brand-deep">ViraChat</p>
          <h1 className="mt-3 text-lg text-ink-muted">Crie sua senha</h1>
        </div>
        <div className="auth-panel rounded-2xl p-7">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
