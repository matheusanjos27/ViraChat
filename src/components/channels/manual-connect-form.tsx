"use client";

import { useActionState } from "react";
import {
  connectWhatsAppManual,
  type ChannelActionState,
} from "@/app/actions/channels";

const initial: ChannelActionState = {};

const field =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

export function ManualConnectForm({ tenantId }: { tenantId: string }) {
  const [state, action, pending] = useActionState(
    connectWhatsAppManual,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="displayName">
          Nome do canal
        </label>
        <input
          id="displayName"
          name="displayName"
          placeholder="Vendas · Principal"
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="phoneNumberId">
          Phone Number ID
        </label>
        <input
          id="phoneNumberId"
          name="phoneNumberId"
          required
          className={`${field} font-mono`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="wabaId">
          WABA ID
        </label>
        <input
          id="wabaId"
          name="wabaId"
          required
          className={`${field} font-mono`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium" htmlFor="accessToken">
          Access Token
        </label>
        <textarea
          id="accessToken"
          name="accessToken"
          required
          rows={3}
          className={`${field} font-mono`}
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-brand">{state.success}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Salvando…" : "Conectar com token"}
      </button>
    </form>
  );
}
