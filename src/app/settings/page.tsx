"use client";

// Settings — connector status board (per-connector isolation visible here),
// AI configuration state, and key setup instructions.

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Settings as SettingsIcon, XCircle } from "lucide-react";
import { timeAgo } from "@/components/ModuleView";
import type { ConnectorStatus } from "@/lib/types";

export default function SettingsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [supabase, setSupabase] = useState<{ configured?: boolean; ok?: boolean; mode?: string; error?: string; url?: string } | null>(null);
  const [at, setAt] = useState<string>();

  useEffect(() => {
    const load = () =>
      fetch("/api/status").then((r) => r.json()).then((d) => {
        setConnectors(d.connectors ?? []);
        setAiEnabled(d.aiEnabled ?? false);
        setSupabase(d.supabase ?? null);
        setAt(d.fetchedAt);
      });
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

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
            <code className="mono rounded bg-panel-2 px-1">SUPABASE_URL</code> +{" "}
            <code className="mono rounded bg-panel-2 px-1">SUPABASE_PUBLISHABLE_KEY</code> for cloud persistence.
            Restart the dev server after changing them.
          </p>
        </div>
      </section>

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
                <th className="px-3 py-2">State</th>
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
                    {c.keyGated ? (
                      <span className="text-amber-400">key required</span>
                    ) : c.ok ? (
                      <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" /> ok</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-400" title={c.lastError}><XCircle className="h-3 w-3" /> error</span>
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
