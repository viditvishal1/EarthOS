"use client";

// Orbit tracker — real satellites propagated client-side from CelesTrak TLEs
// with satellite.js (SGP4), rendered as live points on the 3D globe.

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { MapView, type MapLine } from "@/components/MapView";
import { listSatelliteGroups } from "@/lib/satellites/registry";
import {
  groundTrack,
  parseTleText,
  propagatePosition,
  type ParsedTle,
} from "@/lib/satellites/tle";

export function OrbitGlobe() {
  const [group, setGroup] = useState("stations");
  const [tracked, setTracked] = useState<ParsedTle[]>([]);
  const [tick, setTick] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTracked([]);
    setSelectedName(null);
    setError(null);
    fetch(`/api/space/tle?group=${group}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => setTracked(parseTleText(t, 150)))
      .catch((e) => setError(String(e.message ?? e)));
  }, [group]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo((): Item[] => {
    const now = new Date();
    return tracked.flatMap((t): Item[] => {
      const p = propagatePosition(t, now);
      if (!p) return [];
      return [{
        id: `orbit:${t.name}`,
        module: "space",
        connectorId: "orbit_globe",
        title: t.name,
        summary: `Alt ${p.altKm.toFixed(0)} km · TLE age ${p.epochAgeHours.toFixed(1)}h${p.stale ? " (stale)" : ""}`,
        source: "CelesTrak / SGP4",
        timestamp: now.toISOString(),
        lat: p.lat,
        lon: p.lng,
        tags: ["satellite"],
        entities: [{ name: t.name, type: "satellite" }],
        contentPolicy: "full_cache",
        extra: { noradId: t.noradId, epochAgeHours: p.epochAgeHours, stale: p.stale },
      }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked, tick]);

  const trackLine = useMemo((): MapLine[] => {
    if (!selectedName) return [];
    const t = tracked.find((x) => x.name === selectedName);
    if (!t) return [];
    const coords = groundTrack(t, new Date(), 50, 2);
    return coords.length > 1 ? [{ id: "track", color: "#c4b5fd", coords }] : [];
  }, [selectedName, tracked, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupOptions = listSatelliteGroups();

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {groupOptions.map((g) => (
          <button key={g.id} onClick={() => setGroup(g.id)}
            className={`rounded-full border px-2.5 py-1 text-xs ${group === g.id ? "border-violet-700 bg-violet-950/50 text-violet-300" : "border-line text-ink-dim hover:text-ink"}`}>
            {g.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-dim">
          {items.length} satellites · positions recomputed every 3s
          {selectedName ? ` · track: ${selectedName}` : " · click a satellite for its ground track"}
        </span>
      </div>
      {error && <div className="mb-2 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">{error}</div>}
      <MapView
        layers={[{ id: "sats", color: "#c4b5fd", items, radius: 4 }]}
        lines={trackLine}
        defaultBasemap="satellite"
        defaultGlobe
        zoom={1.8}
        className="h-[62vh] w-full"
        onSelect={(id) => setSelectedName(id.replace("orbit:", ""))}
      />
    </div>
  );
}
