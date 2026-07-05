"use client";

// Settings — connector status board (per-connector isolation visible here),
// AI configuration state, and key setup instructions.

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Settings as SettingsIcon, XCircle } from "lucide-react";
import { timeAgo } from "@/components/ModuleView";
import type { ConnectorStatus } from "@/lib/types";

type RedisHealth = {
  configured?: boolean;
  reachable?: boolean;
  status?: string;
  latencyMs?: number | null;
  errorCategory?: string | null;
};

type LiveHealth = {
  cacheState?: string;
  redis?: RedisHealth;
  seedMeta?: Record<string, { recordCount?: number; seededAt?: string; source?: string } | null>;
  snapshots?: Record<string, { count?: number; stale?: boolean; cold?: boolean; ageSeconds?: number | null }>;
};

function liveCacheLabel(state?: string): { text: string; className: string } {
  switch (state) {
    case "healthy":
      return { text: "healthy — cache populated", className: "text-emerald-400" };
    case "stale":
      return { text: "healthy — cache stale (awaiting next seed)", className: "text-amber-400" };
    case "not_seeded":
      return { text: "Redis OK — live cache not yet seeded", className: "text-amber-400" };
    case "redis_unreachable":
      return { text: "configured but unreachable", className: "text-red-400" };
    case "redis_not_configured":
      return { text: "not configured", className: "text-amber-400" };
    case "empty":
      return { text: "reachable but empty", className: "text-amber-400" };
    default:
      return { text: state ?? "unknown", className: "text-ink-dim" };
  }
}

function redisLabel(h?: RedisHealth | null): { text: string; className: string } {
  if (!h) return { text: "checking…", className: "text-ink-dim" };
  if (!h.configured) return { text: "not configured", className: "text-amber-400" };
  if (h.reachable) {
    return {
      text: `healthy${h.latencyMs != null ? ` · ${h.latencyMs}ms` : ""}`,
      className: "text-emerald-400",
    };
  }
  return {
    text: `unreachable${h.errorCategory ? ` (${h.errorCategory})` : ""}`,
    className: "text-red-400",
  };
}

export default function SettingsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [supabase, setSupabase] = useState<{ configured?: boolean; ok?: boolean; mode?: string; error?: string; url?: string } | null>(null);
  const [usage, setUsage] = useState<{ quotaLevel?: string; r2Enabled?: boolean; redisEnabled?: boolean } | null>(null);
  const [redisHealth, setRedisHealth] = useState<RedisHealth | null>(null);
  const [liveHealth, setLiveHealth] = useState<LiveHealth | null>(null);
  const [at, setAt] = useState<string>();

  useEffect(() => {
    const load = () =>
      Promise.all([
        fetch("/api/status"),
        fetch("/api/usage"),
        fetch("/api/health/redis"),
        fetch("/api/health/live"),
      ])
        .then(([s, u, r, l]) => Promise.all([s.json(), u.json(), r.json(), l.json()]))
        .then(([d, ud, rh, lh]) => {
          setConnectors(d.connectors ?? []);
          setAiEnabled(d.aiEnabled ?? false);
          setSupabase(d.supabase ?? null);
          setUsage(ud.usage ?? null);
          setRedisHealth(rh);
          setLiveHealth(lh);
          setAt(d.fetchedAt);
        });
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const liveLabel = liveCacheLabel(liveHealth?.cacheState);
  const redisStatus = redisLabel(liveHealth?.redis ?? redisHealth);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold text-ink">
        <SettingsIcon className="h-5 w-5 text-accent" /> Settings & connector status
      </h1>

      <section className="mb-5 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
          <KeyRound className="h-4 w-4 text-ink-dim" /> API keys
        </h2>
        <div className="space-y-2 text-xs text-ink-dim">
          <p>
            AI (Gemini):{" "}
            {aiEnabled == null ? "checking…" : aiEnabled ? (
              <span className="text-emerald-400">configured — AI Analyst and briefings are live</span>
            ) : (
              <span className="text-amber-400">not configured</span>
            )}
          </p>
          <p>
            Supabase:{" "}
            {supabase == null ? "checking…" : !supabase.configured ? (
              <span className="text-amber-400">not configured</span>
            ) : supabase.ok ? (
              <span className="text-emerald-400">connected ({supabase.mode} key) · {supabase.url}</span>
            ) : (
              <span className="text-amber-400" title={supabase.error}>configured but not ready — {supabase.error}</span>
            )}
          </p>
          <p>
            Keys are set server-side in <code className="mono rounded bg-panel-2 px-1">.env.local</code> (never
            exposed to the browser, never committed): <code className="mono rounded bg-panel-2 px-1">GEMINI_API_KEY</code> for
            AI features, <code className="mono rounded bg-panel-2 px-1">AISHUB_API_KEY</code> for live vessel positions,{" "}
            <code className="mono rounded bg-panel-2 px-1">UPSTASH_REDIS_REST_URL</code> +{" "}
            <code className="mono rounded bg-panel-2 px-1">UPSTASH_REDIS_REST_TOKEN</code> for distributed live cache,{" "}
            <code className="mono rounded bg-panel-2 px-1">CRON_SECRET</code> for scheduled seeding,{" "}
            <code className="mono rounded bg-panel-2 px-1">SUPABASE_URL</code> +{" "}
            <code className="mono rounded bg-panel-2 px-1">SUPABASE_PUBLISHABLE_KEY</code> for cloud persistence.
            Restart the dev server after changing them.
          </p>
        </div>
      </section>

      <section className="mb-5 rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-sm font-medium text-ink">Live data cache (Redis)</h2>
        <div className="grid gap-2 text-xs text-ink-dim md:grid-cols-2">
          <div>
            Redis: <span className={redisStatus.className}>{redisStatus.text}</span>
          </div>
          <div>
            Live cache: <span className={liveLabel.className}>{liveLabel.text}</span>
          </div>
        </div>
        {liveHealth?.seedMeta && (
          <div className="mt-3 overflow-x-auto rounded border border-line">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-panel-2 text-ink-dim">
                <tr>
                  <th className="px-2 py-1.5">Domain</th>
                  <th className="px-2 py-1.5">Count</th>
                  <th className="px-2 py-1.5">Seeded</th>
                  <th className="px-2 py-1.5">Source</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(liveHealth.seedMeta).map(([domain, meta]) => (
                  <tr key={domain} className="border-t border-line">
                    <td className="mono px-2 py-1.5 text-ink">{domain}</td>
                    <td className="mono px-2 py-1.5">{meta?.recordCount ?? "—"}</td>
                    <td className="px-2 py-1.5">{meta?.seededAt ? timeAgo(meta.seededAt) : "never"}</td>
                    <td className="px-2 py-1.5 text-ink-dim">{meta?.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-dim">
          Primary scheduler: Supabase Cron every 2 minutes. Optional Rust worker fallback uses{" "}
          <code className="mono rounded bg-panel-2 px-1">LIVE_SEED_INTERVAL_SECS</code> (default 90s).
          Warm manually with <code className="mono rounded bg-panel-2 px-1">GET /api/cron/live</code> + Bearer token.
        </p>
      </section>

      {usage && (
        <section className="mb-5 rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium text-ink">Platform usage</h2>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-dim md:grid-cols-4">
            <div>Quota level: <span className="text-ink">{usage.quotaLevel ?? "normal"}</span></div>
            <div>R2 archive: <span className="text-ink">{usage.r2Enabled ? "on" : "off"}</span></div>
            <div>Redis env: <span className="text-ink">{usage.redisEnabled ? "configured" : "missing vars"}</span></div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Connectors ({connectors.length})</h2>
          {at && <span className="text-[11px] text-ink-dim">checked {timeAgo(at)}</span>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel text-[11px] uppercase tracking-wide text-ink-dim">
              <tr>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Latency</th>
                <th className="px-3 py-2">Last fetch</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-3 py-2 text-ink-dim">{c.module}</td>
                  <td className="px-3 py-2 text-ink">{c.source}</td>
                  <td className="px-3 py-2">
                    {c.health === "unknown" ? (
                      <span className="text-ink-dim">unknown</span>
                    ) : c.health === "key_gated" ? (
                      <span className="text-amber-400">key required</span>
                    ) : c.health === "healthy" && !c.stale ? (
                      <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> healthy</span>
                    ) : c.health === "degraded" || c.stale ? (
                      <span className="text-amber-400" title={c.lastError}>degraded (cached)</span>
                    ) : c.health === "disabled" ? (
                      <span className="text-ink-dim">disabled</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400" title={c.lastError}><XCircle className="h-3 w-3" /> {c.health}</span>
                    )}
                  </td>
                  <td className="mono px-3 py-2 text-ink-dim">{c.itemCount}</td>
                  <td className="mono px-3 py-2 text-ink-dim">{c.latencyMs != null ? `${c.latencyMs}ms` : "—"}</td>
                  <td className="px-3 py-2 text-ink-dim">{c.lastFetch ? timeAgo(c.lastFetch) : "not yet run"}</td>
                </tr>
              ))}
              {connectors.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-ink-dim">Loading connector registry…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-ink-dim">
          Connectors are isolated: a failing or rate-limited source degrades only its own module and serves
          its last good cache. Errors here never take down the rest of the platform.
        </p>
      </section>
    </div>
  );
}
