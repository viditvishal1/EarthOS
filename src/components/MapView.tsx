"use client";

// Shared map for Earth View, Aviation, Maritime and City Twin — now a real
// "mission control" map: switchable basemaps (dark / satellite / streets /
// topo), a 3D globe projection toggle (MapLibre v5), 3D terrain from the free
// AWS terrarium DEM tiles, and heading-rotated aircraft icons. All tile
// sources are free and keyless (CARTO, Esri World Imagery, OSM, OpenTopoMap).

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, StyleSpecification } from "maplibre-gl";
import { Earth, Layers, Mountain } from "lucide-react";
import type { Item } from "@/lib/types";

export interface MapLayer {
  id: string;
  color: string;
  items: Item[];
  radius?: number;
  icon?: "plane"; // symbol layer with per-feature rotation instead of circles
}

export interface MapLine {
  id: string;
  color: string;
  coords: [number, number][]; // [lon, lat]
  width?: number; // default 1.5
  dashed?: boolean; // default true (orbit tracks); solid for roads
}

export type BasemapId = "dark" | "satellite" | "streets" | "topo";

const BASEMAPS: Record<BasemapId, { label: string; build: () => StyleSpecification }> = {
  dark: {
    label: "Dark",
    build: () => ({
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: ["a", "b", "c"].map(
            (s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`,
          ),
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    }),
  },
  satellite: {
    label: "Satellite",
    build: () => ({
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
        },
        labels: {
          type: "raster",
          tiles: ["a", "b", "c"].map(
            (s) => `https://${s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png`,
          ),
          tileSize: 256,
          attribution: "© OpenStreetMap contributors © CARTO",
        },
      },
      layers: [
        { id: "base", type: "raster", source: "base" },
        { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.9 } },
      ],
    }),
  },
  streets: {
    label: "Streets",
    build: () => ({
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    }),
  },
  topo: {
    label: "Terrain",
    build: () => ({
      version: 8,
      sources: {
        base: {
          type: "raster",
          tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
          tileSize: 256,
          maxzoom: 17,
          attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)",
        },
      },
      layers: [{ id: "base", type: "raster", source: "base" }],
    }),
  },
};

const DEM_SOURCE = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256,
  encoding: "terrarium" as const,
  maxzoom: 15,
  attribution: "Terrain: Mapzen/AWS Open Data",
};

function toGeoJSON(items: Item[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items
      .filter((i) => typeof i.lat === "number" && typeof i.lon === "number")
      .map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.lon!, i.lat!] },
        properties: {
          id: i.id,
          title: i.title,
          sev: i.severity ?? 0,
          heading: (i.extra?.heading as number) ?? 0,
        },
      })),
  };
}

/** Draw a small plane silhouette pointing north, tinted per layer color. */
function planeImage(color: string): ImageData {
  const s = 36;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.translate(s / 2, s / 2);
  ctx.scale(s / 24, s / 24);
  ctx.beginPath();
  // fuselage + swept wings + tail, nose at top (0° = north)
  ctx.moveTo(0, -10);
  ctx.bezierCurveTo(1.2, -9, 1.4, -6, 1.4, -3.5);
  ctx.lineTo(10, 1.5);
  ctx.lineTo(10, 3.5);
  ctx.lineTo(1.4, 1);
  ctx.lineTo(1.2, 6);
  ctx.lineTo(4, 8.5);
  ctx.lineTo(4, 10);
  ctx.lineTo(0, 9);
  ctx.lineTo(-4, 10);
  ctx.lineTo(-4, 8.5);
  ctx.lineTo(-1.2, 6);
  ctx.lineTo(-1.4, 1);
  ctx.lineTo(-10, 3.5);
  ctx.lineTo(-10, 1.5);
  ctx.lineTo(-1.4, -3.5);
  ctx.bezierCurveTo(-1.4, -6, -1.2, -9, 0, -10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}

export function MapView({
  layers, lines = [], onSelect, onLocationPick, pin, highlightId,
  center = [10, 25], zoom = 1.6, className,
  defaultBasemap = "dark", defaultGlobe = false, maxZoom = 19,
  autoRotate = false, rotateSpeed = 0.05, onMove,
  mapControlsClass,
}: {
  layers: MapLayer[];
  lines?: MapLine[];
  onSelect?: (id: string) => void;
  /** Highlight the selected entity with a pulsing ring. */
  highlightId?: string | null;
  onLocationPick?: (lat: number, lon: number) => void;
  pin?: { lat: number; lon: number; label?: string } | null;
  center?: [number, number];
  zoom?: number;
  className?: string;
  defaultBasemap?: BasemapId;
  defaultGlobe?: boolean;
  maxZoom?: number;
  autoRotate?: boolean; // slow bearing spin; pauses on interaction, resumes idle
  rotateSpeed?: number; // degrees of bearing per animation frame tick
  onMove?: (s: { lat: number; lon: number; zoom: number }) => void; // center/zoom readout
  /** Override position of basemap / globe / terrain controls (e.g. below a parent toolbar). */
  mapControlsClass?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const knownLayers = useRef<Set<string>>(new Set());
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onLocationPickRef = useRef(onLocationPick);
  onLocationPickRef.current = onLocationPick;
  const pinRef = useRef(pin);
  pinRef.current = pin;
  const highlightIdRef = useRef(highlightId);
  highlightIdRef.current = highlightId;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const [basemap, setBasemap] = useState<BasemapId>(defaultBasemap);
  // A rotating flat map looks wrong — auto-rotate implies the sphere.
  const [globe, setGlobe] = useState(defaultGlobe || autoRotate);
  const [terrain, setTerrain] = useState(false);
  const globeRef = useRef(globe);
  globeRef.current = globe;
  const terrainRef = useRef(terrain);
  terrainRef.current = terrain;

  /** (Re)apply data layers + projection + terrain onto the current style. */
  const applyOverlays = useCallback((map: MlMap) => {
    map.setProjection({ type: globeRef.current ? "globe" : "mercator" });

    if (!map.getSource("dem")) map.addSource("dem", DEM_SOURCE);
    map.setTerrain(terrainRef.current ? { source: "dem", exaggeration: 1.4 } : null);

    for (const layer of layersRef.current) {
      const srcId = `src-${layer.id}`;
      const data = toGeoJSON(layer.items);
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
        continue;
      }
      map.addSource(srcId, { type: "geojson", data });
      if (layer.icon === "plane") {
        const imgId = `plane-${layer.id}`;
        if (!map.hasImage(imgId)) map.addImage(imgId, planeImage(layer.color));
        map.addLayer({
          id: `lyr-${layer.id}`,
          type: "symbol",
          source: srcId,
          layout: {
            "icon-image": imgId,
            "icon-size": 0.62,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
          },
        });
      } else {
        map.addLayer({
          id: `lyr-${layer.id}`,
          type: "circle",
          source: srcId,
          paint: {
            "circle-radius": ["+", layer.radius ?? 4, ["*", 0.7, ["coalesce", ["get", "sev"], 0]]],
            "circle-color": layer.color,
            "circle-opacity": 0.8,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#0a0d12",
          },
        });
      }
      map.on("click", `lyr-${layer.id}`, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        if (!onSelectRef.current) {
          new maplibregl.Popup({ closeButton: false, offset: 8 })
            .setLngLat(e.lngLat)
            .setText(String(f.properties?.title ?? ""))
            .addTo(map);
        }
        if (f.properties?.id) onSelectRef.current?.(String(f.properties.id));
      });
      map.on("mouseenter", `lyr-${layer.id}`, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", `lyr-${layer.id}`, () => { map.getCanvas().style.cursor = ""; });
      knownLayers.current.add(layer.id);
    }

    // Polylines (orbit ground tracks, routes).
    for (const line of linesRef.current) {
      const srcId = `src-line-${line.id}`;
      const geo: GeoJSON.Feature = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: line.coords },
        properties: {},
      };
      const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(geo);
      } else {
        map.addSource(srcId, { type: "geojson", data: geo });
        map.addLayer({
          id: `lyr-line-${line.id}`,
          type: "line",
          source: srcId,
          paint: {
            "line-color": line.color,
            "line-width": line.width ?? 1.5,
            "line-opacity": 0.8,
            ...(line.dashed === false ? {} : { "line-dasharray": [2, 1.5] }),
          },
        });
        knownLayers.current.add(`line-${line.id}`);
      }
    }

    // Drop layers/lines that were toggled off.
    for (const known of [...knownLayers.current]) {
      const stillWanted = known.startsWith("line-")
        ? linesRef.current.some((l) => `line-${l.id}` === known)
        : known === "pin"
          ? Boolean(pinRef.current)
          : known === "highlight"
            ? Boolean(highlightIdRef.current)
            : layersRef.current.some((l) => l.id === known);
      if (!stillWanted) {
        const lid = known === "pin" ? "lyr-pin" : known === "highlight" ? "lyr-highlight" : `lyr-${known}`;
        const sid = known === "pin" ? "src-pin" : known === "highlight" ? "src-highlight" : `src-${known}`;
        if (map.getLayer(lid)) map.removeLayer(lid);
        if (map.getSource(sid)) map.removeSource(sid);
        knownLayers.current.delete(known);
      }
    }

    // Selected entity highlight ring
    const highlightItem = highlightIdRef.current
      ? layersRef.current.flatMap((l) => l.items).find((i) => i.id === highlightIdRef.current)
      : undefined;
    if (highlightItem && typeof highlightItem.lat === "number" && typeof highlightItem.lon === "number") {
      const geo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "Point", coordinates: [highlightItem.lon, highlightItem.lat] },
          properties: { id: highlightItem.id },
        }],
      };
      const existing = map.getSource("src-highlight") as maplibregl.GeoJSONSource | undefined;
      if (existing) existing.setData(geo);
      else {
        map.addSource("src-highlight", { type: "geojson", data: geo });
        map.addLayer({
          id: "lyr-highlight",
          type: "circle",
          source: "src-highlight",
          paint: {
            "circle-radius": 14,
            "circle-color": "#facc15",
            "circle-opacity": 0.25,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#facc15",
            "circle-stroke-opacity": 0.9,
          },
        });
        knownLayers.current.add("highlight");
      }
    } else if (map.getLayer("lyr-highlight")) {
      map.removeLayer("lyr-highlight");
      if (map.getSource("src-highlight")) map.removeSource("src-highlight");
      knownLayers.current.delete("highlight");
    }

    // User-placed pin
    if (pinRef.current) {
      const { lat, lon, label } = pinRef.current;
      const geo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: { title: label ?? "Selected location" },
        }],
      };
      const existing = map.getSource("src-pin") as maplibregl.GeoJSONSource | undefined;
      if (existing) existing.setData(geo);
      else {
        map.addSource("src-pin", { type: "geojson", data: geo });
        map.addLayer({
          id: "lyr-pin",
          type: "circle",
          source: "src-pin",
          paint: {
            "circle-radius": 8,
            "circle-color": "#6366f1",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        knownLayers.current.add("pin");
      }
    }
  }, []);

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: BASEMAPS[defaultBasemap].build(),
      center,
      zoom,
      maxZoom,
      attributionControl: { compact: true },
      maxPitch: 75,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.on("load", () => applyOverlays(map));
    map.on("click", (e) => {
      if (onLocationPickRef.current) onLocationPickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    const emitMove = () => {
      const c = map.getCenter();
      onMoveRef.current?.({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    };
    map.on("move", emitMove);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; knownLayers.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-rotate loop — pauses on user interaction, resumes after 4s idle.
  // Honors prefers-reduced-motion (globe stays still).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !autoRotate) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let interacting = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const spin = () => {
      if (!interacting) map.setBearing((map.getBearing() + rotateSpeed) % 360);
      frame = requestAnimationFrame(spin);
    };
    const pause = () => { interacting = true; if (idleTimer) clearTimeout(idleTimer); };
    const resume = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { interacting = false; }, 4000);
    };

    map.on("dragstart", pause);
    map.on("zoomstart", pause);
    map.on("dragend", resume);
    map.on("zoomend", resume);
    map.on("wheel", pause);
    frame = requestAnimationFrame(spin);

    return () => {
      cancelAnimationFrame(frame);
      map.off("dragstart", pause);
      map.off("zoomstart", pause);
      map.off("dragend", resume);
      map.off("zoomend", resume);
      map.off("wheel", pause);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [autoRotate, rotateSpeed]);

  // Data layers changed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) applyOverlays(map);
    else map.once("load", () => applyOverlays(map));
  }, [layers, lines, pin, highlightId, applyOverlays]);

  // Fly to a new center/zoom when the parent changes region.
  useEffect(() => {
    mapRef.current?.easeTo({ center, zoom, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  // Projection / terrain toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setProjection({ type: globe ? "globe" : "mercator" });
    if (!map.getSource("dem")) map.addSource("dem", DEM_SOURCE);
    map.setTerrain(terrain ? { source: "dem", exaggeration: 1.4 } : null);
    if (terrain && map.getPitch() === 0) map.easeTo({ pitch: 55, duration: 800 });
    if (!terrain && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  }, [globe, terrain]);

  // Basemap switch: setStyle wipes sources/layers, so re-apply overlays after.
  const switchBasemap = (id: BasemapId) => {
    setBasemap(id);
    const map = mapRef.current;
    if (!map) return;
    knownLayers.current.clear();
    map.setStyle(BASEMAPS[id].build());
    map.once("styledata", () => {
      // styledata can fire before the style is usable for addSource; idle is safe.
      map.once("idle", () => applyOverlays(map));
      try { applyOverlays(map); } catch { /* retried on idle */ }
    });
  };

  return (
    <div className={`relative ${className ?? "h-[calc(100vh-12rem)] w-full"}`}>
      <div ref={el} className="h-full w-full overflow-hidden rounded-lg border border-line" />
      <div className={`absolute z-10 flex max-w-[calc(100%-1rem)] flex-col gap-1.5 ${mapControlsClass ?? "left-2 top-2"}`}>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-body/90 p-1 shadow-sm backdrop-blur">
          <Layers className="ml-1 h-3.5 w-3.5 shrink-0 text-ink-dim" />
          {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
            <button
              key={id}
              onClick={() => switchBasemap(id)}
              className={`shrink-0 rounded-md px-2 py-1 text-[11px] ${
                basemap === id ? "bg-panel-2 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              {BASEMAPS[id].label}
            </button>
          ))}
        </div>
        <div className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-line bg-body/90 p-1 shadow-sm backdrop-blur">
          <button
            onClick={() => setGlobe((g) => !g)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              globe ? "bg-panel-2 text-accent" : "text-ink-dim hover:text-ink"
            }`}
            title="Toggle 3D globe projection"
          >
            <Earth className="h-3.5 w-3.5" /> Globe
          </button>
          <button
            onClick={() => setTerrain((t) => !t)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
              terrain ? "bg-panel-2 text-accent" : "text-ink-dim hover:text-ink"
            }`}
            title="Toggle 3D terrain (tilt the map to see relief)"
          >
            <Mountain className="h-3.5 w-3.5" /> 3D terrain
          </button>
        </div>
      </div>
    </div>
  );
}
