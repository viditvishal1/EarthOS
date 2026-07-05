"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PanelDefinition, PanelInstance } from "@/lib/panels/types";
import { PanelShell } from "@/components/dashboard/PanelShell";
import { QuickPanelInner, type QuickKind } from "@/components/quick/QuickPanels";
import { EventTimelinePanel } from "@/components/panels/EventTimelinePanel";
import { MarketsSnapshotPanel } from "@/components/panels/MarketsSnapshotPanel";
import { MonitorPanel } from "@/components/panels/MonitorPanel";

const GlobeDashboard = dynamic(
  () => import("@/components/GlobeDashboard").then((m) => m.GlobeDashboard),
  { ssr: false, loading: () => <div className="p-4 text-xs text-ink-dim">Loading map…</div> },
);

function ProviderHealthPanel() {
  const [data, setData] = useState<{
    providers?: Array<{ id: string; state: string; recordCount: number; configured?: boolean }>;
    integrations?: Array<{ id: string; label: string; state: string; configured: boolean; liveCount?: number }>;
  } | null>(null);
  useEffect(() => {
    Promise.all([
      fetch("/api/v1/providers/health").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
    ]).then(([health, status]) => {
      setData({ providers: health.providers, integrations: status.integrations });
    }).catch(() => {});
  }, []);

  const highlight = new Set(["aishub", "tomtom-traffic", "opensky", "cctv-agencies"]);

  return (
    <div className="space-y-3 text-[11px]">
      {(data?.integrations ?? []).map((i) => (
        <div key={i.id} className="rounded border border-line/60 bg-panel-2/40 px-2 py-1.5">
          <div className="flex justify-between gap-2">
            <span className="font-medium text-ink">{i.label}</span>
            <span className={`mono shrink-0 ${i.configured ? "text-emerald-400" : "text-amber-400"}`}>
              {i.state}{i.liveCount != null && i.liveCount > 0 ? ` · ${i.liveCount}` : ""}
            </span>
          </div>
        </div>
      ))}
      <p className="text-[10px] uppercase tracking-wide text-ink-dim">All providers</p>
      {(data?.providers ?? [])
        .filter((p) => highlight.has(p.id) || p.state !== "not-covered")
        .slice(0, 14)
        .map((p) => (
        <div key={p.id} className="flex justify-between gap-2 border-b border-line/50 py-1">
          <span className="truncate text-ink">{p.id}</span>
          <span className="mono shrink-0 text-ink-dim">{p.state} · {p.recordCount}</span>
        </div>
      ))}
      {!data && <p className="text-ink-dim">Loading provider health…</p>}
    </div>
  );
}

const QUICK_MAP: Record<string, QuickKind> = {
  "wire-headlines": "wire",
  "aviation-status": "wire",
};

export function PanelContent({
  instance,
  definition,
  onClose,
}: {
  instance: PanelInstance;
  definition: PanelDefinition;
  onClose?: () => void;
}) {
  if (definition.componentId === "globe-map") {
    return (
      <div className="h-full min-h-[320px] overflow-hidden rounded-lg border border-line">
        <GlobeDashboard variant="dashboard" fullBleed region="global" />
      </div>
    );
  }

  if (definition.componentId === "provider-health") {
    return (
      <PanelShell title={definition.title} onClose={onClose}>
        <ProviderHealthPanel />
      </PanelShell>
    );
  }

  if (definition.componentId === "event-timeline") {
    return (
      <PanelShell title={definition.title} source="GDELT / modules" onClose={onClose}>
        <EventTimelinePanel />
      </PanelShell>
    );
  }

  if (definition.componentId === "markets-snapshot") {
    return (
      <PanelShell title={definition.title} source="Stooq EOD · CoinGecko" onClose={onClose}>
        <MarketsSnapshotPanel />
      </PanelShell>
    );
  }

  if (definition.componentId === "my-monitors") {
    return (
      <PanelShell title={definition.title} source="Alert engine" onClose={onClose}>
        <MonitorPanel />
      </PanelShell>
    );
  }

  const quickKind = QUICK_MAP[definition.componentId];
  if (quickKind) {
    return (
      <PanelShell title={definition.title} onClose={onClose}>
        <QuickPanelInner kind={quickKind} />
      </PanelShell>
    );
  }

  if (definition.componentId === "cameras") {
    return (
      <PanelShell title={definition.title} source="Agency feeds" onClose={onClose}>
        <QuickPanelInner kind="cameras" />
      </PanelShell>
    );
  }

  return (
    <PanelShell title={definition.title} onClose={onClose}>
      <p className="text-[11px] text-ink-dim">
        Panel <code className="mono">{definition.key}</code> — dependencies: {definition.dataDependencies.join(", ") || "none"}
      </p>
    </PanelShell>
  );
}
