"use client";

// Maritime — globe-first vessel tracker + shipping news feed.

import { useEffect, useMemo, useState } from "react";
import { Anchor, Ship } from "lucide-react";
import type { Item } from "@/lib/types";
import { MapView } from "@/components/MapView";
import { ReaderPane } from "@/components/ReaderPane";
import { ItemCard, timeAgo } from "@/components/ModuleView";

const MAJOR_PORTS: Item[] = [
  { id: "port:shanghai", module: "maritime", connectorId: "ports", title: "Port of Shanghai", lat: 31.23, lon: 121.47, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Shanghai", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:singapore", module: "maritime", connectorId: "ports", title: "Port of Singapore", lat: 1.26, lon: 103.84, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Singapore", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:rotterdam", module: "maritime", connectorId: "ports", title: "Port of Rotterdam", lat: 51.95, lon: 4.14, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Rotterdam", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:la", module: "maritime", connectorId: "ports", title: "Port of Los Angeles", lat: 33.74, lon: -118.27, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Los Angeles", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:dubai", module: "maritime", connectorId: "ports", title: "Jebel Ali (Dubai)", lat: 25.01, lon: 55.06, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Dubai", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:mumbai", module: "maritime", connectorId: "ports", title: "Nhava Sheva (Mumbai)", lat: 18.95, lon: 72.95, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Mumbai", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:hk", module: "maritime", connectorId: "ports", title: "Port of Hong Kong", lat: 22.29, lon: 114.15, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Hong Kong", type: "location" }], contentPolicy: "metadata_only" },
  { id: "port:busan", module: "maritime", connectorId: "ports", title: "Port of Busan", lat: 35.1, lon: 129.04, source: "Major port", timestamp: new Date().toISOString(), tags: ["port"], entities: [{ name: "Busan", type: "location" }], contentPolicy: "metadata_only" },
];

export default function MaritimePage() {
  const [vessels, setVessels] = useState<Item[]>([]);
  const [news, setNews] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [tab, setTab] = useState<"globe" | "news">("globe");
  const [fetchedAt, setFetchedAt] = useState<string>();
  const [hasAis, setHasAis] = useState(false);

  useEffect(() => {
    fetch("/api/modules/maritime").then((r) => r.json()).then((d) => {
      const items: Item[] = d.items ?? [];
      const v = items.filter((i) => i.tags.includes("vessel"));
      setVessels(v);
      setNews(items.filter((i) => i.tags.includes("maritime-news")));
      setHasAis(v.length > 0);
      setFetchedAt(d.fetchedAt);
    });
  }, []);

  const mapItems = useMemo(() => {
    if (vessels.length > 0) return vessels;
    return MAJOR_PORTS;
  }, [vessels]);

  const layers = useMemo(
    () => [{
      id: "vessels",
      color: vessels.length ? "#22d3ee" : "#64748b",
      items: mapItems,
      radius: vessels.length ? 5 : 7,
    }],
    [mapItems, vessels.length],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 flex items-center gap-2 text-lg font-semibold text-ink">
          <Anchor className="h-5 w-5 text-cyan-400" /> Maritime
        </h1>
        <button onClick={() => setTab("globe")}
          className={`rounded-full border px-2.5 py-1 text-xs ${tab === "globe" ? "border-cyan-700 bg-cyan-950/50 text-cyan-300" : "border-line text-ink-dim"}`}>
          Globe tracker
        </button>
        <button onClick={() => setTab("news")}
          className={`rounded-full border px-2.5 py-1 text-xs ${tab === "news" ? "border-cyan-700 bg-cyan-950/50 text-cyan-300" : "border-line text-ink-dim"}`}>
          Shipping news
        </button>
        <span className="ml-auto text-[11px] text-ink-dim">
          {hasAis ? `${vessels.length} live vessels` : "Major ports (set AISHUB_API_KEY for live AIS)"}
          {fetchedAt ? ` · ${timeAgo(fetchedAt)}` : ""}
        </span>
      </div>

      {tab === "globe" && (
        <div className="relative">
          <MapView
            layers={layers}
            center={[20, 25]}
            zoom={1.6}
            defaultGlobe
            defaultBasemap="dark"
            className="h-[55vh] w-full"
            onSelect={(id) => setSelected(mapItems.find((v) => v.id === id) ?? null)}
          />
          {selected && (
            <div className="absolute right-3 top-3 z-20 max-h-[85%] w-80">
              <ReaderPane item={selected} onClose={() => setSelected(null)} />
            </div>
          )}
          {!hasAis && (
            <div className="mt-2 rounded-md border border-line bg-panel px-3 py-2 text-xs text-ink-dim">
              <Ship className="mb-1 inline h-3.5 w-3.5 text-cyan-400" /> Live AIS positions need <code className="mono">AISHUB_API_KEY</code> in Settings. Showing global major ports until enabled.
            </div>
          )}
        </div>
      )}

      {tab === "news" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="max-h-[65vh] overflow-y-auto">
            {news.map((n) => (
              <ItemCard key={n.id} item={n} selected={selected?.id === n.id} onSelect={() => setSelected(n)} />
            ))}
          </div>
          <div>{selected ? <ReaderPane item={selected} onClose={() => setSelected(null)} /> : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line p-8 text-sm text-ink-dim">
              Select a shipping story to read in-app
            </div>
          )}</div>
        </div>
      )}
    </div>
  );
}
