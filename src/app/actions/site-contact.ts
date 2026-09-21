"use server";

import { createServiceClient } from "@/lib/supabase/admin";
import { isUiPreview } from "@/lib/dev/ui-preview";
import { LGPD_CONSENT_VERSION } from "@/lib/marketing/lgpd";

export type SiteContactState = {
  error?: string;
  success?: string;
};

export async function submitSiteContact(
  _prev: SiteContactState,
  formData: FormData,
): Promise<SiteContactState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const lgpd = formData.get("lgpdConsent") === "on";

  if (!fullName || fullName.length < 2) {
    return { error: "Informe seu nome." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }
  if (!lgpd) {
    return {
      error: "É necessário autorizar o tratamento dos dados (LGPD) para continuar.",
    };
  }

  try {
    if (isUiPreview()) {
      return {
        success:
          "Recebemos seu contato! (preview local — não gravou no banco)",
      };
    }
    const admin = createServiceClient();
    const { error } = await admin.from("site_contacts").insert({
      full_name: fullName.slice(0, 120),
      email: email.slice(0, 200),
      lgpd_consent: true,
      lgpd_consent_at: new Date().toISOString(),
      lgpd_text_version: LGPD_CONSENT_VERSION,
      source: "landing",
    });

    if (error) {
      console.error("[site-contact]", error.message);
      return { error: "Não foi possível enviar. Tente de novo em instantes." };
    }

    return {
      success:
        "Recebemos seu contato! Em breve alguém da ViraChat fala com você.",
    };
  } catch (err) {
    console.error("[site-contact]", err);
    return { error: "Não foi possível enviar. Tente de novo em instantes." };
  }
}
