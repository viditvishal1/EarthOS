"use client";

import { useEffect, useState } from "react";
import { ModuleFeedPanel } from "@/components/panels/ModuleFeedPanel";

export function ConflictEventsPanel() {
  return (
    <ModuleFeedPanel
      modules={["conflict"]}
      minSeverity={4}
      showSeverity
      emptyLabel="Loading conflict events from UCDP / ACLED / GDELT…"
      linkHref="/conflict"
    />
  );
}

export function AviationStatusPanel() {
  const [flightCount, setFlightCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/flights?region=global&limit=1")
      .then((r) => r.json())
      .then((d) => setFlightCount(d.count ?? d.flights?.length ?? null))
      .catch(() => setFlightCount(null));
  }, []);

  return (
    <div className="space-y-2">
      {flightCount != null && (
        <div className="rounded border border-line/60 bg-panel-2/40 px-2 py-1.5 text-[11px]">
          <span className="text-ink-dim">Global ADS-B snapshot: </span>
          <span className="mono font-medium text-live">{flightCount.toLocaleString()}</span>
          <span className="text-ink-dim"> aircraft</span>
        </div>
      )}
      <ModuleFeedPanel
        modules={["aviation"]}
        emptyLabel="Loading aviation notices…"
        linkHref="/aviation"
      />
    </div>
  );
}

export function CyberThreatPanel() {
  return (
    <ModuleFeedPanel
      modules={["cyber"]}
      showSeverity
      emptyLabel="Loading cyber / KEV feed…"
      linkHref="/cyber"
    />
  );
}

export function MaritimeStatusPanel() {
  return (
    <ModuleFeedPanel
      modules={["maritime"]}
      showSeverity
      emptyLabel="Loading maritime AIS and notices…"
      linkHref="/maritime"
    />
  );
}

export function SpaceStatusPanel() {
  return (
    <ModuleFeedPanel
      modules={["space"]}
      emptyLabel="Loading space weather and TLE catalog…"
      linkHref="/space"
    />
  );
}
