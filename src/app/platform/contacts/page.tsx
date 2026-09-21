import { createClient } from "@/lib/supabase/server";

export default async function PlatformContactsPage() {
  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("site_contacts")
    .select(
      "id, full_name, email, lgpd_consent, lgpd_consent_at, lgpd_text_version, source, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Site
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Contatos do site
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Pessoas que pediram contato pela landing. Consentimento LGPD gravado
          com data e versão do texto.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
        {error ? (
          <p className="text-sm text-red-600">
            Não foi possível carregar. Aplique a migration de site_contacts.
          </p>
        ) : (contacts ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nenhum contato ainda. Quando alguém enviar o formulário “Começar
            agora”, aparece aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.08em] text-ink-muted">
                  <th className="pb-2 font-medium">Nome</th>
                  <th className="pb-2 font-medium">E-mail</th>
                  <th className="pb-2 font-medium">LGPD</th>
                  <th className="pb-2 font-medium">Versão</th>
                  <th className="pb-2 font-medium">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(contacts ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 font-medium">{c.full_name}</td>
                    <td className="py-3">
                      <a
                        href={`mailto:${c.email}`}
                        className="text-brand hover:underline"
                      >
                        {c.email}
                      </a>
                    </td>
                    <td className="py-3">
                      {c.lgpd_consent ? (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-deep">
                          Autorizado
                          {c.lgpd_consent_at
                            ? ` · ${new Date(c.lgpd_consent_at).toLocaleDateString("pt-BR")}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 text-ink-muted">
                      {c.lgpd_text_version}
                    </td>
                    <td className="py-3 text-ink-muted">
                      {new Date(c.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
