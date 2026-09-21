import { createServiceClient } from "@/lib/supabase/admin";

export type HealthCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  latencyMs: number | null;
};

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return {
      ok: res.ok || res.status < 500,
      status: res.status,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : " falha",
    };
  }
}

export async function collectPlatformHealth(): Promise<{
  overall: "healthy" | "degraded" | "down";
  checks: HealthCheck[];
  checkedAt: string;
}> {
  const checks: HealthCheck[] = [];

  // Database
  {
    const started = Date.now();
    try {
      const supabase = createServiceClient();
      const { error } = await supabase.from("tenants").select("id").limit(1);
      checks.push({
        id: "database",
        label: "Postgres / Supabase",
        ok: !error,
        detail: error ? error.message : "Consulta OK",
        latencyMs: Date.now() - started,
      });
    } catch (err) {
      checks.push({
        id: "database",
        label: "Postgres / Supabase",
        ok: false,
        detail: err instanceof Error ? err.message : "Erro",
        latencyMs: Date.now() - started,
      });
    }
  }

  // App (public URL or local)
  {
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000"
    ).replace(/\/$/, "");
    const r = await timedFetch(`${appUrl}/login`);
    checks.push({
      id: "app",
      label: "ViraChat (app)",
      ok: r.ok,
      detail: r.error ?? `HTTP ${r.status}`,
      latencyMs: r.latencyMs,
    });
  }

  // Evolution
  {
    const evo = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
    if (!evo) {
      checks.push({
        id: "evolution",
        label: "Evolution API",
        ok: false,
        detail: "EVOLUTION_API_URL não configurada",
        latencyMs: null,
      });
    } else {
      const r = await timedFetch(`${evo}/`, {
        headers: {
          apikey: process.env.EVOLUTION_API_KEY ?? "",
        },
      });
      checks.push({
        id: "evolution",
        label: "Evolution API",
        ok: r.ok || r.status === 401 || r.status === 404,
        detail: r.error ?? `HTTP ${r.status}`,
        latencyMs: r.latencyMs,
      });
    }
  }

  // Supabase Kong / Auth
  {
    const sb = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    if (!sb) {
      checks.push({
        id: "supabase_api",
        label: "Supabase API",
        ok: false,
        detail: "NEXT_PUBLIC_SUPABASE_URL vazia",
        latencyMs: null,
      });
    } else {
      const r = await timedFetch(`${sb}/auth/v1/health`);
      checks.push({
        id: "supabase_api",
        label: "Supabase API (Auth)",
        ok: r.ok || r.status === 401,
        detail: r.error ?? `HTTP ${r.status}`,
        latencyMs: r.latencyMs,
      });
    }
  }

  // Process memory (container)
  {
    const mem = process.memoryUsage();
    const heapMb = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    checks.push({
      id: "node_memory",
      label: "Memória do app (container)",
      ok: rssMb < 1500,
      detail: `RSS ${rssMb} MB · heap ${heapMb} MB`,
      latencyMs: null,
    });
  }

  const failed = checks.filter((c) => !c.ok).length;
  const overall =
    failed === 0 ? "healthy" : failed >= checks.length - 1 ? "down" : "degraded";

  return {
    overall,
    checks,
    checkedAt: new Date().toISOString(),
  };
}
