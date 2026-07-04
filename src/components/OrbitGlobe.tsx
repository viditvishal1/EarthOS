"use client";

// Orbit tracker — real satellites propagated client-side from CelesTrak TLEs
// with satellite.js (SGP4), rendered as live points on the 3D globe. Click a
// satellite to draw its ±50-minute ground track.

import { useEffect, useMemo, useState } from "react";
import * as sat from "satellite.js";
import type { Item } from "@/lib/types";
import { MapView, type MapLine } from "@/components/MapView";

interface Tracked {
  name: string;
  satrec: sat.SatRec;
}

const GROUP_OPTIONS = [
  { id: "stations", label: "Space stations" },
  { id: "last-30-days", label: "Launched < 30 days" },
  { id: "starlink", label: "Starlink" },
  { id: "gps-ops", label: "GPS constellation" },
  { id: "weather", label: "Weather sats" },
  { id: "active-geosynchronous", label: "Geosynchronous" },
];

function parseTle(text: string): Tracked[] {
  const lines = text.split("\n").map((l) => l.trimEnd()).filter(Boolean);
  const out: Tracked[] = [];
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const [name, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue;
    try {
      out.push({ name: name.trim(), satrec: sat.twoline2satrec(l1, l2) });
    } catch { /* skip malformed TLE */ }
  }
  return out.slice(0, 150);
}

function positionOf(t: Tracked, when: Date): { lat: number; lon: number; altKm: number } | null {
  try {
    const pv = sat.propagate(t.satrec, when);
    if (!pv?.position || typeof pv.position === "boolean") return null;
    const gmst = sat.gstime(when);
    const geo = sat.eciToGeodetic(pv.position, gmst);
    return {
      lat: sat.degreesLat(geo.latitude),
      lon: sat.degreesLong(geo.longitude),
      altKm: geo.height,
    };
  } catch {
    return null;
  }
}

export function OrbitGlobe() {
  const [group, setGroup] = useState("stations");
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [tick, setTick] = useState(0);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTracked([]);
    setSelectedName(null);
    setError(null);
    fetch(`/api/space/tle?group=${group}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => setTracked(parseTle(t)))
      .catch((e) => setError(String(e.message ?? e)));
  }, [group]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo((): Item[] => {
    const now = new Date();
    return tracked.flatMap((t): Item[] => {
      const p = positionOf(t, now);
      if (!p) return [];
      return [{
        id: `orbit:${t.name}`,
        module: "space",
        connectorId: "orbit_globe",
        title: t.name,
        summary: `Alt ${p.altKm.toFixed(0)} km · ${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}° · SGP4 from CelesTrak TLE`,
        source: "CelesTrak / SGP4",
        timestamp: now.toISOString(),
        lat: p.lat,
        lon: p.lon,
        tags: ["satellite"],
        entities: [{ name: t.name, type: "satellite" }],
        contentPolicy: "full_cache",
      }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked, tick]);

  const trackLine = useMemo((): MapLine[] => {
    if (!selectedName) return [];
    const t = tracked.find((x) => x.name === selectedName);
    if (!t) return [];
    const coords: [number, number][] = [];
    let prevLon: number | null = null;
    for (let m = -50; m <= 50; m += 2) {
      const p = positionOf(t, new Date(Date.now() + m * 60000));
      if (!p) continue;
      // Split at the antimeridian so the track doesn't smear across the map.
      if (prevLon !== null && Math.abs(p.lon - prevLon) > 180) break;
      prevLon = p.lon;
      coords.push([p.lon, p.lat]);
    }
    return coords.length > 1 ? [{ id: "track", color: "#c4b5fd", coords }] : [];
  }, [selectedName, tracked, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {GROUP_OPTIONS.map((g) => (
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
