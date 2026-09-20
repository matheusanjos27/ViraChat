"use client";

import { useState, useTransition } from "react";
import { refreshBaileysQr } from "@/app/actions/channels";

export function ReconnectChannelButton({
  tenantId,
  channelId,
}: {
  tenantId: string;
  channelId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function onReconnect() {
    setError(null);
    startTransition(async () => {
      const next = await refreshBaileysQr(channelId, tenantId);
      if (next.error) {
        setError(next.error);
        return;
      }
      if (next.connectionStatus === "open") {
        setDone(true);
        setQr(null);
        window.location.reload();
        return;
      }
      if (next.qrcodeBase64) setQr(next.qrcodeBase64);
      if (next.pairingCode) setPairing(next.pairingCode);

      const poll = window.setInterval(() => {
        startTransition(async () => {
          const again = await refreshBaileysQr(channelId, tenantId);
          if (again.connectionStatus === "open") {
            window.clearInterval(poll);
            window.location.reload();
            return;
          }
          if (again.qrcodeBase64) setQr(again.qrcodeBase64);
          if (again.pairingCode) setPairing(again.pairingCode);
          if (again.error) setError(again.error);
        });
      }, 4000);
      window.setTimeout(() => window.clearInterval(poll), 5 * 60 * 1000);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onReconnect}
        disabled={pending || done}
        className="rounded-lg bg-[#b54708] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#9a3c06] disabled:opacity-60"
      >
        {pending ? "Gerando QR…" : done ? "Conectado" : "Reconectar"}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {qr ? (
        <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <p className="mb-2 text-xs font-medium text-amber-900">
            Escaneie o QR no WhatsApp
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
            alt="QR Code WhatsApp"
            className="mx-auto size-40 rounded-lg bg-white p-1"
          />
          {pairing ? (
            <p className="mt-2 text-[11px] text-amber-900/80">
              Código: <span className="font-mono font-semibold">{pairing}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
