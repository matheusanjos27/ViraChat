"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  refreshBaileysQr,
  startBaileysChannel,
  type ChannelActionState,
} from "@/app/actions/channels";

const initial: ChannelActionState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function BaileysConnectForm({
  tenantId,
  enabled,
  disabledMessage,
}: {
  tenantId: string;
  enabled: boolean;
  disabledMessage?: string;
}) {
  const [state, action, pending] = useActionState(
    startBaileysChannel,
    initial,
  );
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.qrcodeBase64) setQr(state.qrcodeBase64);
    if (state.pairingCode) setPairing(state.pairingCode);
    if (state.channelId) setChannelId(state.channelId);
    if (state.connectionStatus) setStatus(state.connectionStatus);
  }, [state]);

  useEffect(() => {
    if (!channelId || status === "open") return;

    const tick = () => {
      startTransition(async () => {
        const next = await refreshBaileysQr(channelId, tenantId);
        if (next.error) {
          setPollError(next.error);
          return;
        }
        setPollError(null);
        if (next.qrcodeBase64) setQr(next.qrcodeBase64);
        if (next.pairingCode) setPairing(next.pairingCode);
        if (next.connectionStatus) setStatus(next.connectionStatus);
        if (next.connectionStatus === "open") {
          window.location.reload();
        }
      });
    };

    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [channelId, status, tenantId]);

  if (!enabled) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {disabledMessage ?? (
          <>
            Evolution/Baileys ainda não está ligado neste ambiente. No servidor,
            configure <code className="font-mono">EVOLUTION_API_URL</code> e{" "}
            <code className="font-mono">EVOLUTION_API_KEY</code> (veja{" "}
            <code className="font-mono">docker/README.md</code>).
          </>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="tenantId" value={tenantId} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="baileysDisplayName">
            Nome do canal (opcional)
          </label>
          <input
            id="baileysDisplayName"
            name="displayName"
            placeholder="Vendas · Principal"
            className={field}
            disabled={Boolean(channelId) && status !== "open"}
          />
        </div>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || (Boolean(channelId) && status === "pending_qr")}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {pending
            ? "Gerando QR…"
            : channelId && status === "pending_qr"
              ? "Aguardando leitura do QR…"
              : "Gerar QR Code"}
        </button>
      </form>

      {(qr || pairing || pollError) && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <p className="text-sm font-medium text-ink">
            No celular: WhatsApp → Aparelhos conectados → Conectar aparelho
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                qr.startsWith("data:")
                  ? qr
                  : `data:image/png;base64,${qr}`
              }
              alt="QR Code WhatsApp"
              className="mx-auto mt-4 h-56 w-56 rounded-lg bg-white p-2"
            />
          )}
          {pairing && (
            <p className="mt-3 text-center text-sm text-ink-muted">
              Código de pareamento:{" "}
              <span className="font-mono font-semibold text-ink">{pairing}</span>
            </p>
          )}
          {pollError && (
            <p className="mt-2 text-sm text-red-600">{pollError}</p>
          )}
          {status === "pending_qr" && (
            <p className="mt-2 text-center text-xs text-ink-muted">
              Atualizando status a cada 4s…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
