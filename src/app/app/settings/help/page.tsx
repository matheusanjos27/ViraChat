import Link from "next/link";
import { HelpGuide } from "@/components/settings/help-guide";

export default function HelpSettingsPage() {
  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="px-5 py-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Link href="/app/settings" className="hover:text-ink">
            Configurações
          </Link>
          <span className="text-line">/</span>
          <span className="font-medium text-ink">Ajuda</span>
        </nav>

        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Ajuda
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Guia para quem usa o ViraChat no dia a dia — do WhatsApp à IA.
        </p>

        <div className="mt-6">
          <HelpGuide />
        </div>
      </div>
    </div>
  );
}
