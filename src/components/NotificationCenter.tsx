"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { Badge } from "@/components/Badge";

interface AlertRow {
  id?: number;
  severity: string;
  title: string;
  message?: string;
  created_at?: string;
  acknowledged?: boolean;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [unackCount, setUnackCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    fetch("/api/v1/alerts?limit=20")
      .then((r) => r.json())
      .then((d) => {
        setAlerts(d.alerts ?? []);
        setUnackCount(d.unackCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource("/api/v1/alerts/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "alert" && data.alert) {
          setAlerts((prev) => [data.alert, ...prev].slice(0, 25));
          setUnackCount((n) => n + 1);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function ackAll() {
    const ids = alerts.filter((a) => a.id && !a.acknowledged).map((a) => a.id!);
    if (!ids.length) return;
    await fetch("/api/v1/alerts/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    refresh();
  }

  const tone = (s: string) => (s === "critical" ? "critical" : s === "warning" ? "warning" : "info");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) refresh(); }}
        className="relative rounded-md border border-line bg-panel p-2 text-ink-dim hover:bg-panel-2 hover:text-ink"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unackCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white">
            {unackCount > 99 ? "99+" : unackCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-line bg-panel shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-medium text-ink">Live alerts</span>
            <div className="flex items-center gap-2">
              {unackCount > 0 && (
                <button type="button" onClick={ackAll} className="text-[10px] text-accent hover:underline">
                  Mark all read
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {alerts.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-ink-dim">No alerts yet — rules fire on ingest</p>
            )}
            {alerts.map((a, i) => (
              <div key={a.id ?? i} className="border-b border-line/40 px-2 py-2 last:border-0">
                <div className="flex items-start gap-2">
                  <Badge tone={tone(a.severity)}>{a.severity}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug text-ink">{a.title}</p>
                    {a.message && <p className="mt-0.5 text-[10px] text-ink-dim line-clamp-2">{a.message}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
