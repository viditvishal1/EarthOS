"use client";

// Aviation — live flight positions per region (OpenSky) on the shared map,
// plus FAA airport delay feed as the list. Aircraft detail cards in-app.

import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/types";
import { MapView } from "@/components/MapView";
import { ReaderPane } from "@/components/ReaderPane";
import { ModuleView, timeAgo } from "@/components/ModuleView";

const REGION_OPTIONS = [
  { id: "global", label: "🌍 Global", center: [20, 25] as [number, number], zoom: 1.7 },
  { id: "europe", label: "Europe", center: [10, 50] as [number, number], zoom: 3.8 },
  { id: "usa", label: "United States", center: [-98, 38] as [number, number], zoom: 3.8 },
  { id: "india", label: "India / South Asia", center: [79, 22] as [number, number], zoom: 3.8 },
  { id: "easia", label: "East Asia", center: [115, 33] as [number, number], zoom: 3.8 },
  { id: "mideast", label: "Middle East", center: [47, 27] as [number, number], zoom: 3.8 },
];

export default function AviationPage() {
  const [region, setRegion] = useState(REGION_OPTIONS[0]);
  const [flights, setFlights] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>();

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/flights?region=${region.id}`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setFlights(d.items ?? []);
          setError(d.error ?? null);
          setFetchedAt(new Date().toISOString());
        })
        .catch(() => alive && setError("flight fetch failed"));
    load();
    const t = setInterval(load, 90_000);
    return () => { alive = false; clearInterval(t); };
  }, [region]);

  const layers = useMemo(
    () => [{ id: "flights", color: "#facc15", items: flights, icon: "plane" as const }],
    [flights],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-lg font-semibold text-ink">Aviation</h1>
          {REGION_OPTIONS.map((r) => (
            <button key={r.id} onClick={() => setRegion(r)}
              className={`rounded-full border px-2.5 py-1 text-xs ${region.id === r.id ? "border-blue-700 bg-blue-950/50 text-blue-300" : "border-line text-ink-dim hover:text-ink"}`}>
              {r.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-ink-dim">
            {flights.length.toLocaleString()} aircraft{fetchedAt ? ` · ${timeAgo(fetchedAt)}` : ""} · {flights[0]?.source ?? "OpenSky / adsb.lol"}
          </span>
        </div>
        {error && (
          <div className="mb-2 rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">{error}</div>
        )}
        <div className="relative">
          <MapView
            layers={layers}
            center={region.center}
            zoom={region.zoom}
            className="h-[52vh] w-full"
            onSelect={(id) => setSelected(flights.find((f) => f.id === id) ?? null)}
          />
          {selected && (
            <div className="absolute right-3 top-3 z-20 max-h-[85%] w-80 max-w-[85%]">
              <ReaderPane item={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </div>
      </div>
      <ModuleView
        module="aviation"
        title="Airport status & flight feed"
        subtitle="FAA National Airspace System delays + tracked aircraft"
      />
    </div>
  );
}
