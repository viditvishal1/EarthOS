"use client";

// City Digital Twin — interactive map with pin-drop geocoding,
// layer toggles (weather, air quality, news, streets). Live traffic requires a provider (Phase 3).

import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudSun, MapPin, Newspaper, Map, Wind, Car } from "lucide-react";
import type { Item } from "@/lib/types";
import { MapView, type MapLine } from "@/components/MapView";
import { ItemCard } from "@/components/ModuleView";
import { ReaderPane } from "@/components/ReaderPane";

const FALLBACK_PRESETS = [
  { id: "delhi", name: "New Delhi", lat: 28.61, lon: 77.21 },
  { id: "london", name: "London", lat: 51.51, lon: -0.13 },
  { id: "nyc", name: "New York", lat: 40.71, lon: -74.01 },
];

type Layer = "weather" | "news" | "streets" | "air" | "traffic";

interface TrafficSegment {
  id?: string;
  roadName?: string;
  currentSpeed: number;
  freeFlowSpeed: number;
  confidence: number;
  coords?: [number, number][]; // [lon, lat]
}

interface Weather {
  temperatureC: number; windKmh: number; humidity: number;
  precipitationMm: number; aqiUs?: number; pm25?: number; fetchedAt: string;
}

interface GeoPlace {
  displayName: string; city?: string; state?: string; country?: string; lat: number; lon: number;
}

export default function CityPage() {
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [loc, setLoc] = useState(FALLBACK_PRESETS[0]);
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [layer, setLayer] = useState<Layer>("weather");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [news, setNews] = useState<Item[]>([]);
  const [traffic, setTraffic] = useState<{ enabled: boolean; segments: TrafficSegment[]; message?: string } | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [globe, setGlobe] = useState(false);
  const [mapZoom, setMapZoom] = useState(11);

  const label = place?.city ?? place?.displayName?.split(",")[0] ?? loc.name;

  const loadPlace = useCallback((lat: number, lon: number, nameHint?: string) => {
    setLoc({ id: "custom", name: nameHint ?? "Selected", lat, lon });
    setSelected(null);
    fetch(`/api/geocode?lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.displayName) setPlace(d);
        else setPlace({ displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon });
      })
      .catch(() => setPlace({ displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon }));
  }, []);

  useEffect(() => {
    fetch("/api/config/cities")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.cities) && d.cities.length > 0) {
          const mapped = d.cities.map((c: { id: string; name: string; lat: number; lon: number }) => ({
            id: c.id, name: c.name, lat: c.lat, lon: c.lon,
          }));
          setPresets(mapped);
          setLoc(mapped[0]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPlace(loc.lat, loc.lon, loc.name);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (layer !== "traffic") return;
    const pad = 0.05;
    fetch(`/api/traffic?minLat=${loc.lat - pad}&minLon=${loc.lon - pad}&maxLat=${loc.lat + pad}&maxLon=${loc.lon + pad}`)
      .then((r) => r.json())
      .then(setTraffic)
      .catch(() => setTraffic({ enabled: false, segments: [], message: "Traffic unavailable" }));
  }, [layer, loc.lat, loc.lon]);

  useEffect(() => {
    setWeather(null);
    setNews([]);
    setTraffic(null);
    fetch(`/api/weather?lat=${loc.lat}&lon=${loc.lon}`).then((r) => r.json())
      .then((d) => typeof d.temperatureC === "number" && setWeather(d));
    const q = encodeURIComponent(label);
    fetch(`/api/search?q=${q}`).then((r) => r.json())
      .then((d) => {
        const all: Item[] = Object.values(d.grouped ?? {}).flat() as Item[];
        setNews(all.filter((i) => i.module === "news").slice(0, 15));
      });
  }, [loc.lat, loc.lon, label]);

  const basemap = layer === "streets" ? "streets" as const : layer === "weather" ? "satellite" as const : "dark" as const;
  const zoom = layer === "streets" ? 14 : layer === "traffic" ? 13 : mapZoom;

  // Congestion-colored road polylines for the traffic layer.
  const trafficLines: MapLine[] = useMemo(() => {
    if (layer !== "traffic" || !traffic?.enabled) return [];
    return traffic.segments
      .filter((s) => s.coords && s.coords.length > 1)
      .map((s, i) => {
        const ratio = s.freeFlowSpeed > 0 ? s.currentSpeed / s.freeFlowSpeed : 1;
        return {
          id: s.id ?? `traffic-${i}`,
          color: ratio < 0.5 ? "#ef4444" : ratio < 0.75 ? "#f59e0b" : "#22c55e",
          coords: s.coords!,
          width: 4,
          dashed: false,
        };
      });
  }, [layer, traffic]);

  const gmapsKey = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY : undefined;

  const layerBtn = (id: Layer, icon: React.ReactNode, text: string) => (
    <button
      onClick={() => { setLayer(id); if (id === "streets") setMapZoom(14); }}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        layer === id ? "border-indigo-600 bg-indigo-950/40 text-indigo-300" : "border-line text-ink-dim hover:text-ink"
      }`}
    >
      {icon}{text}
    </button>
  );

  const sidePanel = useMemo(() => {
    if (selected) return <ReaderPane item={selected} onClose={() => setSelected(null)} />;
    if (layer === "weather" && weather) {
      return (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">{label} — live weather</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-panel-2 p-3">
              <div className="text-[11px] uppercase text-ink-dim">Temperature</div>
              <div className="mono text-2xl font-semibold text-ink">{weather.temperatureC.toFixed(1)}°C</div>
              <div className="text-xs text-ink-dim">Humidity {weather.humidity}%</div>
            </div>
            <div className="rounded-md bg-panel-2 p-3">
              <div className="text-[11px] uppercase text-ink-dim">Wind</div>
              <div className="mono text-2xl font-semibold text-ink">{weather.windKmh.toFixed(0)} km/h</div>
              <div className="text-xs text-ink-dim">Precip {weather.precipitationMm} mm</div>
            </div>
            <div className="col-span-2 rounded-md bg-panel-2 p-3">
              <div className="text-[11px] uppercase text-ink-dim">Air quality (US AQI)</div>
              <div className={`mono text-2xl font-semibold ${(weather.aqiUs ?? 0) > 100 ? "text-orange-400" : "text-emerald-400"}`}>
                {weather.aqiUs ?? "—"}
              </div>
              {weather.pm25 != null && <div className="text-xs text-ink-dim">PM2.5 {weather.pm25} µg/m³ · Open-Meteo</div>}
            </div>
          </div>
        </div>
      );
    }
    if (layer === "air" && weather) {
      return (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Air quality — {label}</h2>
          <p className="mono text-4xl font-bold text-ink">{weather.aqiUs ?? "—"}</p>
          <p className="mt-2 text-sm text-ink-dim">
            {(weather.aqiUs ?? 0) <= 50 ? "Good" : (weather.aqiUs ?? 0) <= 100 ? "Moderate" : (weather.aqiUs ?? 0) <= 150 ? "Unhealthy for sensitive groups" : "Unhealthy"}
          </p>
          <p className="mt-3 text-xs text-ink-dim">PM2.5 {weather.pm25 ?? "—"} µg/m³ · Open-Meteo Air Quality API</p>
        </div>
      );
    }
    if (layer === "traffic") {
      return (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Traffic — {label}</h2>
          {!traffic && <p className="text-xs text-ink-dim">Loading traffic flow…</p>}
          {traffic && !traffic.enabled && (
            <p className="text-xs text-amber-400/90">{traffic.message ?? "Set TOMTOM_API_KEY for live traffic. Streets layer shows OSM roads only."}</p>
          )}
          {traffic?.enabled && traffic.segments.length === 0 && (
            <p className="text-xs text-ink-dim">No traffic segments in this viewport.</p>
          )}
          {traffic?.enabled && traffic.segments.length > 0 && (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {traffic.segments.slice(0, 20).map((s, i) => {
                const ratio = s.freeFlowSpeed > 0 ? s.currentSpeed / s.freeFlowSpeed : 1;
                const congested = ratio < 0.6;
                return (
                  <div key={i} className="rounded bg-panel-2 p-2 text-xs">
                    <div className="font-medium text-ink">{s.roadName ?? "Road segment"}</div>
                    <div className={congested ? "text-amber-400" : "text-ink-dim"}>
                      {Math.round(s.currentSpeed)} km/h · free flow {Math.round(s.freeFlowSpeed)} km/h
                    </div>
                    <div className="text-ink-dim">TomTom · confidence {(s.confidence * 100).toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    if (layer === "streets") {
      return (
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Streets — {label}</h2>
          <p className="mb-3 text-xs text-ink-dim">
            Zoom the map to street level (OpenStreetMap roads). This layer shows streets only — not live traffic.
            Traffic flow, congestion, and routing require a traffic provider (TomTom or equivalent) in Phase 3.
          </p>
          {gmapsKey ? (
            <iframe
              title="Street view"
              className="h-48 w-full rounded-md border border-line"
              src={`https://www.google.com/maps/embed/v1/streetview?key=${gmapsKey}&location=${loc.lat},${loc.lon}&heading=0&pitch=0&fov=80`}
              allowFullScreen
            />
          ) : (
            <p className="text-xs text-amber-400/90">Pin a location and use Streets basemap at max zoom for road-level detail (free OSM tiles).</p>
          )}
        </div>
      );
    }
    return (
      <>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">News — {label}</h2>
        <div className="flex max-h-[65vh] flex-col gap-1.5 overflow-y-auto">
          {news.map((n) => (
            <ItemCard key={n.id} item={n} selected={false} onSelect={() => setSelected(n)} />
          ))}
          {news.length === 0 && <div className="py-4 text-xs text-ink-dim">Searching local news…</div>}
        </div>
      </>
    );
  }, [selected, layer, weather, label, news, loc, gmapsKey, traffic]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3">
        <h1 className="text-lg font-semibold text-ink">City Digital Twin</h1>
        <p className="text-xs text-ink-dim">Click the map to drop a pin · toggle layers · Streets layer uses OSM at max zoom</p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-ink-dim">Quick jump</span>
        {presets.map((c) => (
          <button key={c.id} onClick={() => loadPlace(c.lat, c.lon, c.name)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              Math.abs(loc.lat - c.lat) < 0.05 && Math.abs(loc.lon - c.lon) < 0.05
                ? "border-indigo-600 bg-indigo-950/40 text-indigo-300"
                : "border-line text-ink-dim hover:border-indigo-800 hover:text-ink"
            }`}>
            {c.name}
          </button>
        ))}
        <button onClick={() => setGlobe((g) => !g)}
          className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] ${globe ? "border-indigo-600 text-indigo-300" : "border-line text-ink-dim"}`}>
          {globe ? "3D Globe" : "2D Map"}
        </button>
      </div>

      {place && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-xs">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <span className="truncate text-ink">{place.displayName}</span>
          <span className="mono shrink-0 text-ink-dim">{loc.lat.toFixed(4)}°, {loc.lon.toFixed(4)}°</span>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {layerBtn("weather", <CloudSun className="h-3.5 w-3.5" />, "Weather")}
        {layerBtn("air", <Wind className="h-3.5 w-3.5" />, "Air quality")}
        {layerBtn("news", <Newspaper className="h-3.5 w-3.5" />, "News")}
        {layerBtn("streets", <Map className="h-3.5 w-3.5" />, "Streets")}
        {layerBtn("traffic", <Car className="h-3.5 w-3.5" />, "Traffic")}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <MapView
          layers={[]}
          lines={trafficLines}
          pin={place ? { lat: loc.lat, lon: loc.lon, label: label } : null}
          center={[loc.lon, loc.lat]}
          zoom={zoom}
          maxZoom={19}
          className="h-[58vh] w-full"
          defaultBasemap={basemap}
          defaultGlobe={globe}
          onLocationPick={(lat, lon) => loadPlace(lat, lon)}
        />
        <div className="max-h-[58vh] overflow-y-auto">{sidePanel}</div>
      </div>
    </div>
  );
}
