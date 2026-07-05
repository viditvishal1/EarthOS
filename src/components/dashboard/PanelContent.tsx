"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PanelDefinition, PanelInstance } from "@/lib/panels/types";
import { PanelShell } from "@/components/dashboard/PanelShell";
import { QuickPanelInner, type QuickKind } from "@/components/quick/QuickPanels";
import { EventTimelinePanel } from "@/components/panels/EventTimelinePanel";

const GlobeDashboard = dynamic(
  () => import("@/components/GlobeDashboard").then((m) => m.GlobeDashboard),
  { ssr: false, loading: () => <div className="p-4 text-xs text-ink-dim">Loading map…</div> },
);

function ProviderHealthPanel() {
  const [data, setData] = useState<{ providers?: Array<{ id: string; state: string; recordCount: number }> } | null>(null);
  useEffect(() => {
    fetch("/api/v1/providers/health").then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  return (
    <div className="space-y-1 text-[11px]">
      {(data?.providers ?? []).slice(0, 12).map((p) => (
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
  "markets-snapshot": "stocks",
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
