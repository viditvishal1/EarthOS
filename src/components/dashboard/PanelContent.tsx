"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { PanelDefinition, PanelInstance } from "@/lib/panels/types";
import { PanelShell } from "@/components/dashboard/PanelShell";
import { QuickPanelInner, type QuickKind } from "@/components/quick/QuickPanels";
import { EventTimelinePanel } from "@/components/panels/EventTimelinePanel";
import { MarketsSnapshotPanel } from "@/components/panels/MarketsSnapshotPanel";
import { MonitorPanel } from "@/components/panels/MonitorPanel";
import {
  AviationStatusPanel,
  ConflictEventsPanel,
  CyberThreatPanel,
  MaritimeStatusPanel,
  SpaceStatusPanel,
} from "@/components/panels/DomainPanels";
import { ModuleFeedPanel } from "@/components/panels/ModuleFeedPanel";

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

  const highlight = new Set(["aishub", "tomtom-traffic", "mappls-traffic", "opensky", "cctv-agencies"]);

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
  "live-news": "streams",
  "stocks-ticker": "stocks",
  "watch-signals": "predictions",
  "defcon-posture": "defcon",
  "outbreaks-monitor": "outbreaks",
};

function shell(
  definition: PanelDefinition,
  onClose: (() => void) | undefined,
  draggable: boolean | undefined,
  source: string | undefined,
  children: ReactNode,
) {
  return (
    <PanelShell title={definition.title} source={source} onClose={onClose} draggable={draggable}>
      {children}
    </PanelShell>
  );
}

export function PanelContent({
  instance,
  definition,
  onClose,
  draggable,
}: {
  instance: PanelInstance;
  definition: PanelDefinition;
  onClose?: () => void;
  draggable?: boolean;
}) {
  if (definition.componentId === "globe-map") {
    return (
      <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div
          className={`panel-header shrink-0 gap-2 ${draggable ? "panel-drag-handle cursor-grab active:cursor-grabbing" : ""}`}
        >
          <span className="min-w-0 truncate text-xs font-medium text-ink">{definition.title}</span>
          {onClose && (
            <button type="button" onClick={onClose} className="ml-auto text-ink-dim hover:text-ink" aria-label="Close panel">
              ×
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <GlobeDashboard variant="dashboard" fullBleed region="global" />
        </div>
      </div>
    );
  }

  if (definition.componentId === "provider-health") {
    return shell(definition, onClose, draggable, undefined, <ProviderHealthPanel />);
  }
  if (definition.componentId === "event-timeline") {
    return shell(definition, onClose, draggable, "GDELT / modules", <EventTimelinePanel />);
  }
  if (definition.componentId === "markets-snapshot") {
    return shell(definition, onClose, draggable, "Stooq EOD · CoinGecko", <MarketsSnapshotPanel />);
  }
  if (definition.componentId === "my-monitors") {
    return shell(definition, onClose, draggable, "Alert engine", <MonitorPanel />);
  }
  if (definition.componentId === "conflict-events") {
    return shell(definition, onClose, draggable, "UCDP · ACLED", <ConflictEventsPanel />);
  }
  if (definition.componentId === "aviation-status") {
    return shell(definition, onClose, draggable, "OpenSky · FAA", <AviationStatusPanel />);
  }
  if (definition.componentId === "cyber-threats") {
    return shell(definition, onClose, draggable, "CISA KEV · NVD", <CyberThreatPanel />);
  }
  if (definition.componentId === "maritime-status") {
    return shell(definition, onClose, draggable, "AIS", <MaritimeStatusPanel />);
  }
  if (definition.componentId === "space-tracker") {
    return shell(definition, onClose, draggable, "CelesTrak · ISS", <SpaceStatusPanel />);
  }

  const quickKind = QUICK_MAP[definition.componentId];
  if (quickKind) {
    return shell(definition, onClose, draggable, undefined, <QuickPanelInner kind={quickKind} />);
  }

  if (definition.componentId === "cameras") {
    return shell(definition, onClose, draggable, "Agency feeds", <QuickPanelInner kind="cameras" />);
  }

  return shell(
    definition,
    onClose,
    draggable,
    undefined,
    <p className="text-[11px] text-ink-dim">
      Panel <code className="mono">{definition.key}</code> — dependencies:{" "}
      {definition.dataDependencies.join(", ") || "none"}
    </p>,
  );
}
