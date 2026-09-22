import { PlatformAiHistoryForm } from "@/components/platform/platform-settings-form";
import { AI_LIMITS } from "@/lib/ai/limits";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("ai_history_turns")
    .eq("id", 1)
    .maybeSingle();

  const turns = data?.ai_history_turns ?? AI_LIMITS.historyTurns;

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Plataforma
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Configurações globais
        </h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Ajustes que valem para todos os clientes (tenants).
        </p>
      </header>

      <div className="mt-8 max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
        <h2 className="text-sm font-semibold text-ink">Histórico da IA</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Quantas mensagens anteriores entram no contexto do modelo (4–40).
          Padrão {AI_LIMITS.historyTurns}.
        </p>
        <div className="mt-4">
          <PlatformAiHistoryForm currentTurns={turns} />
        </div>
      </div>
    </div>
  );
}
