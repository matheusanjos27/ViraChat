import { redirect } from "next/navigation";
import { BaileysConnectForm } from "@/components/channels/baileys-connect-form";
import { DisconnectChannelButton } from "@/components/channels/disconnect-channel-button";
import { ReconnectChannelButton } from "@/components/channels/reconnect-channel-button";
import { isEvolutionConfigured } from "@/lib/evolution/client";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("user_tenant_roles")
    .select("tenant_id, tenants!inner(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/app");

  const tenant = membership.tenants as unknown as { id: string; name: string };
  const tenantId = membership.tenant_id;
  const evolutionOn = isEvolutionConfigured();

  const { data: channels } = await supabase
    .from("channels")
    .select(
      "id, display_name, is_active, created_at, whatsapp_accounts(display_phone, verified_name, phone_number_id, onboard_source, connection_status, last_webhook_at)",
    )
    .eq("tenant_id", tenantId)
    .eq("provider_id", "whatsapp")
    .order("created_at", { ascending: false });

  type ChannelRow = {
    id: string;
    display_name: string;
    whatsapp_accounts:
      | {
          display_phone: string | null;
          phone_number_id: string;
          onboard_source: string;
          connection_status?: string | null;
          last_webhook_at: string | null;
        }
      | {
          display_phone: string | null;
          phone_number_id: string;
          onboard_source: string;
          connection_status?: string | null;
          last_webhook_at: string | null;
        }[]
      | null;
  };

  const rows = (channels ?? []) as unknown as ChannelRow[];
  const disconnected = rows.filter((ch) => {
    const wa = Array.isArray(ch.whatsapp_accounts)
      ? ch.whatsapp_accounts[0]
      : ch.whatsapp_accounts;
    const status = wa?.connection_status ?? "open";
    return status === "close" || status === "pending_qr";
  });

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="flex flex-col gap-6 px-6 py-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Canais
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            WhatsApp
          </h1>
          <p className="mt-2 text-ink-muted">
            Empresa <span className="font-medium text-ink">{tenant.name}</span>.
            Conecte números por QR (Baileys). A IA responde em todos.
          </p>
        </header>

        {disconnected.length > 0 ? (
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            <p className="font-semibold">
              {disconnected.length === 1
                ? "1 número precisa reconectar"
                : `${disconnected.length} números precisam reconectar`}
            </p>
            <p className="mt-1 text-amber-900/80">
              A sessão do WhatsApp caiu. Use <strong>Reconectar</strong> e
              escaneie o QR no celular.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <div className="rounded-xl border border-brand/15 bg-brand-soft/70 px-4 py-3 text-sm text-brand-deep">
            <p className="font-semibold">Conexão por QR</p>
            <p className="mt-1 text-brand-deep/80">
              Escaneie no celular. O número continua no aparelho. Cada empresa
              pode cadastrar N números.
            </p>
          </div>

          <h2 className="mt-6 text-lg font-semibold">Números conectados</h2>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Nenhum WhatsApp conectado ainda.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {rows.map((ch) => {
                const wa = Array.isArray(ch.whatsapp_accounts)
                  ? ch.whatsapp_accounts[0]
                  : ch.whatsapp_accounts;
                const status = wa?.connection_status ?? "open";
                const needsReconnect =
                  status === "close" || status === "pending_qr";
                const statusLabel =
                  status === "open"
                    ? "conectado"
                    : status === "pending_qr"
                      ? "aguardando QR"
                      : "desconectado";
                return (
                  <li
                    key={ch.id}
                    className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${
                      needsReconnect
                        ? "border-amber-300 bg-amber-50/80"
                        : "border-line bg-paper"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{ch.display_name}</p>
                      <p className="text-sm text-ink-muted">
                        {wa?.display_phone ?? wa?.phone_number_id} ·{" "}
                        <span
                          className={
                            needsReconnect
                              ? "font-semibold text-[#b54708]"
                              : "text-[#1f9d55]"
                          }
                        >
                          {statusLabel}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {needsReconnect ? (
                        <ReconnectChannelButton
                          tenantId={tenantId}
                          channelId={ch.id}
                        />
                      ) : null}
                      <DisconnectChannelButton
                        tenantId={tenantId}
                        channelId={ch.id}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Conectar WhatsApp</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Evolution API (Baileys) — sem Meta Business Manager.
          </p>
          <div className="mt-4">
            <BaileysConnectForm tenantId={tenantId} enabled={evolutionOn} />
          </div>
        </section>
      </div>
    </div>
  );
}
