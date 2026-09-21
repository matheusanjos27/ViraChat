import { statfs } from "node:fs/promises";
import { createServiceClient } from "@/lib/supabase/admin";

export type HealthCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  latencyMs: number | null;
};

export type DiskStats = {
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  ok: boolean;
};

function formatGb(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

async function readDiskStats(): Promise<DiskStats | null> {
  for (const path of ["/host", "/"]) {
    try {
      const s = await statfs(path);
      const totalBytes = Number(s.blocks) * Number(s.bsize);
      const freeBytes = Number(s.bavail) * Number(s.bsize);
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      if (totalBytes <= 0) continue;
      // / no container costuma ser pequenininho — preferir /host se existir
      if (path === "/" && totalBytes < 20 * 1024 * 1024 * 1024) {
        // menos de 20GB provavelmente é só o container; tenta /host antes (já tentou)
        if (path === "/") {
          // se só temos /, reporta mesmo assim com aviso no label
        }
      }
      const usedPercent = Math.round((usedBytes / totalBytes) * 100);
      return {
        path,
        totalBytes,
        usedBytes,
        freeBytes,
        usedPercent,
        ok: usedPercent < 90,
      };
    } catch {
      // tenta próximo path
    }
  }
  return null;
}

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
      error: err instanceof Error ? err.message : "falha",
    };
  }
}

export async function collectPlatformHealth(): Promise<{
  overall: "healthy" | "degraded" | "down";
  checks: HealthCheck[];
  disk: DiskStats | null;
  checkedAt: string;
}> {
  const checks: HealthCheck[] = [];
  const disk = await readDiskStats();

  if (disk) {
    const fromHost = disk.path === "/host";
    checks.push({
      id: "disk",
      label: fromHost ? "Disco SSD (VPS)" : "Disco (filesystem do app)",
      ok: disk.ok,
      detail: `${formatGb(disk.usedBytes)} GB usados de ${formatGb(disk.totalBytes)} GB · ${formatGb(disk.freeBytes)} GB livres (${disk.usedPercent}%)`,
      latencyMs: null,
    });
  } else {
    checks.push({
      id: "disk",
      label: "Disco SSD (VPS)",
      ok: false,
      detail: "Não foi possível ler o disco (monte /:/host:ro no container)",
      latencyMs: null,
    });
  }

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

  // App
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

  // Supabase API
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
    disk,
    checkedAt: new Date().toISOString(),
  };
}
