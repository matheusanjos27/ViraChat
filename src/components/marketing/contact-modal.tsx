"use client";

import { useActionState, useEffect, useState } from "react";
import {
  submitSiteContact,
  type SiteContactState,
} from "@/app/actions/site-contact";
import { LGPD_CONSENT_TEXT } from "@/lib/marketing/lgpd";

const initial: SiteContactState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-placeholder focus:border-brand focus:ring-2 focus:ring-brand/20";

export function ContactModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(submitSiteContact, initial);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rise-in w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="contact-title" className="text-lg font-semibold text-ink">
              Fale com a ViraChat
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Deixe seus dados — retornamos em breve.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full text-ink-muted hover:bg-paper hover:text-ink"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {state.success ? (
          <div className="space-y-4 px-5 py-8 text-center">
            <p className="text-sm text-brand">{state.success}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form action={action} className="space-y-4 px-5 py-5">
            <div>
              <label
                className="text-sm font-medium text-ink"
                htmlFor="fullName"
              >
                Nome
              </label>
              <input
                id="fullName"
                name="fullName"
                required
                autoComplete="name"
                placeholder="Seu nome"
                className={`${field} mt-1.5`}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className={`${field} mt-1.5`}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 text-left">
              <input
                type="checkbox"
                name="lgpdConsent"
                required
                className="mt-1 size-4 shrink-0 accent-brand"
              />
              <span className="text-xs leading-relaxed text-ink-muted">
                {LGPD_CONSENT_TEXT}
              </span>
            </label>

            {state.error ? (
              <p className="text-sm text-danger" role="alert">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviar"}
              {!pending ? <span aria-hidden>→</span> : null}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function useContactModal() {
  const [open, setOpen] = useState(false);
  return {
    open,
    openContact: () => setOpen(true),
    closeContact: () => setOpen(false),
  };
}
