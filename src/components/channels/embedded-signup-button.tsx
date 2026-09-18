"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  completeEmbeddedSignup,
  type ChannelActionState,
} from "@/app/actions/channels";

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const initial: ChannelActionState = {};

const META_ORIGINS = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
  "https://www.business.facebook.com",
]);

type SessionInfo = {
  phoneNumberId?: string;
  wabaId?: string;
  businessId?: string;
  event?: string;
};

type Props = {
  tenantId: string;
  appId?: string;
  configId?: string;
};

export function EmbeddedSignupButton({ tenantId, appId, configId }: Props) {
  const [ready, setReady] = useState(false);
  const sessionRef = useRef<SessionInfo>({});
  const codeRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  const [state, action, pending] = useActionState(
    completeEmbeddedSignup,
    initial,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!appId || !configId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v22.0",
      });
      setReady(true);
    };

    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) setReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [appId, configId]);

  function trySubmit() {
    if (submittedRef.current) return;
    const code = codeRef.current;
    const info = sessionRef.current;
    // Need code + at least waba_id (phone can be discovered server-side)
    if (!code || !info.wabaId) return;

    submittedRef.current = true;
    setWaiting(false);
    const form = document.getElementById(
      "embedded-signup-form",
    ) as HTMLFormElement | null;
    if (!form) return;
    (form.elements.namedItem("code") as HTMLInputElement).value = code;
    (form.elements.namedItem("phoneNumberId") as HTMLInputElement).value =
      info.phoneNumberId ?? "";
    (form.elements.namedItem("wabaId") as HTMLInputElement).value = info.wabaId;
    (form.elements.namedItem("businessId") as HTMLInputElement).value =
      info.businessId ?? "";
    (form.elements.namedItem("event") as HTMLInputElement).value =
      info.event ?? "FINISH";
    form.requestSubmit();
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!META_ORIGINS.has(event.origin)) return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;

        const eventName = String(data.event ?? "").toUpperCase();
        if (eventName === "CANCEL" || eventName === "ERROR") {
          setWaiting(false);
          setLocalError(
            eventName === "CANCEL"
              ? "Fluxo cancelado na Meta."
              : data.data?.error_message || "Erro no Embedded Signup da Meta.",
          );
          return;
        }

        const phone =
          data.data?.phone_number_id ||
          data.data?.phone_number_ids?.[0] ||
          undefined;
        const waba =
          data.data?.waba_id || data.data?.waba_ids?.[0] || undefined;

        if (waba || phone) {
          sessionRef.current = {
            phoneNumberId: phone ?? sessionRef.current.phoneNumberId,
            wabaId: waba ?? sessionRef.current.wabaId,
            businessId: data.data?.business_id ?? sessionRef.current.businessId,
            event: eventName || sessionRef.current.event,
          };
          trySubmit();
        }
      } catch {
        // ignore non-JSON
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function launch() {
    setLocalError(null);
    submittedRef.current = false;
    codeRef.current = null;
    sessionRef.current = {};

    if (!window.FB || !configId) {
      setLocalError("SDK da Meta ainda não carregou. Recarregue a página.");
      return;
    }

    setWaiting(true);

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setWaiting(false);
          setLocalError("Fluxo cancelado ou sem código de autorização.");
          return;
        }

        codeRef.current = code;
        trySubmit();

        // Wait up to ~8s for postMessage session info (race with FB.login)
        let attempts = 0;
        const timer = window.setInterval(() => {
          attempts += 1;
          trySubmit();
          if (submittedRef.current || attempts >= 40) {
            window.clearInterval(timer);
            if (!submittedRef.current) {
              setWaiting(false);
              setLocalError(
                "A Meta não enviou waba_id/phone_number_id. Conclua o fluxo até o fim (escolha o número) e tente de novo. Se persistir, verifique o domínio do SDK e o config_id.",
              );
            }
          }
        }, 200);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  if (!appId || !configId) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Embedded Signup ainda não configurado. Defina{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_META_APP_ID</code> e{" "}
        <code className="font-mono text-xs">NEXT_PUBLIC_META_CONFIG_ID</code> no
        ambiente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <form id="embedded-signup-form" action={action} className="hidden">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="code" defaultValue="" />
        <input type="hidden" name="phoneNumberId" defaultValue="" />
        <input type="hidden" name="wabaId" defaultValue="" />
        <input type="hidden" name="businessId" defaultValue="" />
        <input type="hidden" name="event" defaultValue="" />
        <input type="hidden" name="displayName" defaultValue="" />
      </form>
      <button
        type="button"
        onClick={launch}
        disabled={!ready || pending || waiting}
        className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#166fe5] disabled:opacity-60"
      >
        {pending || waiting
          ? "Conectando…"
          : "Conectar com Meta (Embedded Signup)"}
      </button>
      {(localError || state.error) && (
        <p className="text-sm text-red-600" role="alert">
          {localError ?? state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-teal-700">{state.success}</p>
      )}
      <p className="text-xs text-zinc-500">
        No popup da Meta, complete até escolher/confirmar o número. Não feche
        antes do fim.
      </p>
    </div>
  );
}
