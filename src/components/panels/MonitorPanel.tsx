"use client";

import { useCallback, useEffect, useState } from "react";

interface AlertRow {
  id?: number;
  severity: string;
  title: string;
  message?: string;
  created_at?: string;
}

interface RuleRow {
  id: string;
  name: string;
  enabled: boolean;
  ruleType: string;
}

export function MonitorPanel() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [watchlists, setWatchlists] = useState<{ id: string; name: string }[]>([]);

  const refresh = useCallback(() => {
    Promise.all([
      fetch("/api/v1/alerts?limit=15").then((r) => r.json()),
      fetch("/api/watchlists").then((r) => r.json()),
    ]).then(([a, w]) => {
      setAlerts(a.alerts ?? []);
      setRules(a.rules ?? []);
      setWatchlists((w.watchlists ?? []).slice(0, 5));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource("/api/v1/alerts/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "alert" && data.alert) {
          setAlerts((prev) => [data.alert, ...prev].slice(0, 15));
        }
      } catch {
        /* ignore */
      }
    };
    const interval = setInterval(refresh, 60_000);
    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="space-y-3 text-[11px]">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-dim">Active rules ({rules.filter((r) => r.enabled).length})</p>
        {rules.slice(0, 6).map((r) => (
          <div key={r.id} className="flex justify-between gap-2 py-0.5">
            <span className={r.enabled ? "text-ink" : "text-ink-dim line-through"}>{r.name}</span>
            <span className="mono text-ink-dim">{r.ruleType}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-dim">Recent alerts (live)</p>
        {alerts.slice(0, 8).map((a, i) => (
          <div key={a.id ?? i} className="border-b border-line/40 py-1">
            <span className={a.severity === "critical" ? "text-red-400" : "text-amber-400"}>{a.severity}</span>
            {" · "}
            <span className="text-ink">{a.title}</span>
          </div>
        ))}
        {alerts.length === 0 && <p className="text-ink-dim">No alert events yet — rules evaluate on ingest</p>}
      </div>
      {watchlists.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-ink-dim">Watchlists</p>
          {watchlists.map((w) => (
            <div key={w.id} className="py-0.5 text-ink">{w.name}</div>
          ))}
        </div>
      )}
    </div>
  );
}
