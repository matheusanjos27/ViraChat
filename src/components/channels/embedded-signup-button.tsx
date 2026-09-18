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
  const [state, action, pending] = useActionState(
    completeEmbeddedSignup,
    initial,
  );
  const [localError, setLocalError] = useState<string | null>(null);

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
      setReady(Boolean(window.FB));
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [appId, configId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (
          data.event === "FINISH" ||
          data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
        ) {
          sessionRef.current = {
            phoneNumberId: data.data?.phone_number_id,
            wabaId: data.data?.waba_id,
            businessId: data.data?.business_id,
            event: data.event,
          };
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function launch() {
    setLocalError(null);
    if (!window.FB || !configId) {
      setLocalError("SDK da Meta ainda não carregou.");
      return;
    }

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setLocalError("Fluxo cancelado ou sem código de autorização.");
          return;
        }

        window.setTimeout(() => {
          const info = sessionRef.current;
          if (!info.phoneNumberId || !info.wabaId) {
            setLocalError(
              "Não recebemos phone_number_id/waba_id da Meta. Tente de novo.",
            );
            return;
          }
          const form = document.getElementById(
            "embedded-signup-form",
          ) as HTMLFormElement | null;
          if (!form) return;
          (form.elements.namedItem("code") as HTMLInputElement).value = code;
          (
            form.elements.namedItem("phoneNumberId") as HTMLInputElement
          ).value = info.phoneNumberId;
          (form.elements.namedItem("wabaId") as HTMLInputElement).value =
            info.wabaId;
          (form.elements.namedItem("businessId") as HTMLInputElement).value =
            info.businessId ?? "";
          (form.elements.namedItem("event") as HTMLInputElement).value =
            info.event ?? "FINISH";
          form.requestSubmit();
        }, 300);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
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
        disabled={!ready || pending}
        className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#166fe5] disabled:opacity-60"
      >
        {pending ? "Conectando…" : "Conectar com Meta (Embedded Signup)"}
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
        Serve para número novo na Cloud API e também para migrar número do app
        WhatsApp Business.
      </p>
    </div>
  );
}
