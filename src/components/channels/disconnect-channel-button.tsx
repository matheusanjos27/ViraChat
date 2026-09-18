"use client";

import { useActionState } from "react";
import {
  disconnectChannel,
  type ChannelActionState,
} from "@/app/actions/channels";

const initial: ChannelActionState = {};

export function DisconnectChannelButton({
  tenantId,
  channelId,
}: {
  tenantId: string;
  channelId: string;
}) {
  const [state, action, pending] = useActionState(disconnectChannel, initial);

  return (
    <form action={action}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="channelId" value={channelId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Removendo…" : "Desconectar"}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
