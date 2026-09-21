import { collectPlatformHealth } from "@/lib/platform/health";

export const dynamic = "force-dynamic";

function formatGb(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

export default async function PlatformHealthPage() {
  const health = await collectPlatformHealth();
  const label =
    health.overall === "healthy"
      ? "Tudo certo"
      : health.overall === "degraded"
        ? "Degradado"
        : "Com problemas";
  const tone =
    health.overall === "healthy"
      ? "bg-[#e8f7ee] text-[#1f9d55]"
      : health.overall === "degraded"
        ? "bg-amber-50 text-[#b54708]"
        : "bg-red-50 text-red-700";

  const disk = health.disk;

  return (
    <div className="px-6 py-8 lg:px-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-brand">
          Operação
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Saúde</h1>
        <p className="mt-2 text-ink-muted">
          Disco da VPS, app, Evolution, API Supabase e memória do container.
        </p>
      </header>

      <div className={`mt-6 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${tone}`}>
        {label}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Atualizado em {new Date(health.checkedAt).toLocaleString("pt-BR")}
      </p>

      {disk ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-muted">
                Disco SSD
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {formatGb(disk.usedBytes)} GB{" "}
                <span className="text-base font-normal text-ink-muted">
                  usados de {formatGb(disk.totalBytes)} GB
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {formatGb(disk.freeBytes)} GB livres · {disk.usedPercent}%
                ocupado
                {disk.path === "/host" ? " · VPS (host)" : " · container"}
              </p>
            </div>
            <p
              className={`text-sm font-semibold ${
                disk.ok ? "text-[#1f9d55]" : "text-red-600"
              }`}
            >
              {disk.ok ? "OK" : "Quase cheio"}
            </p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#e8eeeb]">
            <div
              className={`h-full rounded-full transition-all ${
                disk.usedPercent >= 90
                  ? "bg-red-500"
                  : disk.usedPercent >= 75
                    ? "bg-[#f59e0b]"
                    : "bg-[#0c6b5c]"
              }`}
              style={{ width: `${Math.min(100, disk.usedPercent)}%` }}
            />
          </div>
        </section>
      ) : null}

      <ul className="mt-8 space-y-3">
        {health.checks.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-[var(--shadow)]"
          >
            <div>
              <p className="font-semibold">{c.label}</p>
              <p className="mt-1 text-sm text-ink-muted">{c.detail}</p>
            </div>
            <div className="text-right">
              <p
                className={`text-sm font-semibold ${
                  c.ok ? "text-[#1f9d55]" : "text-red-600"
                }`}
              >
                {c.ok ? "OK" : "Falha"}
              </p>
              {c.latencyMs != null ? (
                <p className="mt-1 text-xs text-ink-muted">{c.latencyMs} ms</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
