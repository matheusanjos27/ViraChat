"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SetPasswordForm } from "@/components/auth/set-password-form";

type Status = "loading" | "ready" | "error" | "need_login";

function SetPasswordContent() {
  const [status, setStatus] = useState<Status>("loading");
  const router = useRouter();
  const searchParams = useSearchParams();
  const force = searchParams.get("force") === "1";

  useEffect(() => {
    async function handleHash() {
      const hash = window.location.hash.substring(1);
      const supabase = createClient();

      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          setStatus("error");
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setStatus("error");
          return;
        }

        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
        setStatus("ready");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus(force ? "need_login" : "ready");
        return;
      }

      setStatus("ready");
    }

    handleHash();
  }, [router, force]);

  if (status === "loading") {
    return (
      <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
        <p className="text-ink-muted text-sm">
          {force ? "Preparando troca de senha…" : "Verificando convite…"}
        </p>
      </main>
    );
  }

  if (status === "need_login") {
    return (
      <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-ink font-medium">Faça login primeiro</p>
          <p className="text-ink-muted mt-1 text-sm">
            Entre com a senha provisória para definir uma nova.
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
          <img
            src="/logo.png"
            alt="ViraChat"
            className="mx-auto h-14 w-auto rounded-xl bg-brand-deep px-4 py-2"
          />
          <h1 className="mt-3 text-lg text-ink-muted">
            {force ? "Troque a senha provisória" : "Crie sua senha"}
          </h1>
          {force ? (
            <p className="mt-2 text-sm text-ink-muted">
              Por segurança, defina uma senha nova antes de entrar no sistema.
            </p>
          ) : null}
        </div>
        <div className="auth-panel rounded-2xl p-7">
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="app-noise flex min-h-dvh items-center justify-center px-4 py-16">
          <p className="text-ink-muted text-sm">Carregando…</p>
        </main>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
