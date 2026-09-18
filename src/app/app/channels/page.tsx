import { redirect } from "next/navigation";
import { DisconnectChannelButton } from "@/components/channels/disconnect-channel-button";
import { EmbeddedSignupButton } from "@/components/channels/embedded-signup-button";
import { ManualConnectForm } from "@/components/channels/manual-connect-form";
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

  const { data: channels } = await supabase
    .from("channels")
    .select(
      "id, display_name, is_active, created_at, whatsapp_accounts(display_phone, verified_name, phone_number_id, onboard_source, last_webhook_at)",
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
          last_webhook_at: string | null;
        }
      | {
          display_phone: string | null;
          phone_number_id: string;
          onboard_source: string;
          last_webhook_at: string | null;
        }[]
      | null;
  };

  const rows = (channels ?? []) as unknown as ChannelRow[];

  return (
    <div className="app-noise h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
            Canais
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            WhatsApp
          </h1>
          <p className="mt-2 text-ink-muted">
            Empresa <span className="font-medium text-ink">{tenant.name}</span>.
            Cliente final usa Embedded Signup; token manual é só para teste.
          </p>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <div className="rounded-xl border border-brand/15 bg-brand-soft/70 px-4 py-3 text-sm text-brand-deep">
            <p className="font-semibold">Business e número comum</p>
            <p className="mt-1 text-brand-deep/80">
              Ambos entram só pela Cloud API oficial. Número do app Business
              migra no Embedded Signup. Número comum precisa migrar para a API
              (sai do celular).
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
                return (
                  <li
                    key={ch.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-line bg-paper px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{ch.display_name}</p>
                      <p className="text-sm text-ink-muted">
                        {wa?.display_phone ?? wa?.phone_number_id} ·{" "}
                        {wa?.onboard_source ?? "—"}
                      </p>
                    </div>
                    <DisconnectChannelButton
                      tenantId={tenantId}
                      channelId={ch.id}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Conectar via Meta</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Fluxo oficial Embedded Signup (produção).
          </p>
          <div className="mt-4">
            <EmbeddedSignupButton
              tenantId={tenantId}
              appId={process.env.NEXT_PUBLIC_META_APP_ID}
              configId={process.env.NEXT_PUBLIC_META_CONFIG_ID}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <h2 className="text-lg font-semibold">Conectar com token (dev)</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Phone Number ID, WABA ID e token do painel Meta / sandbox.
          </p>
          <div className="mt-4">
            <ManualConnectForm tenantId={tenantId} />
          </div>
        </section>
      </div>
    </div>
  );
}
