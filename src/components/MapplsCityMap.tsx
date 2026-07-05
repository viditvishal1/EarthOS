"use client";

// Mappls (MapMyIndia) interactive map for India — vector basemap + live traffic overlay.
// Falls back via onUnavailable when SDK load fails or domain is not whitelisted.

import { useEffect, useRef, useState } from "react";

interface MapplsMapLike {
  addListener: (event: string, cb: (e?: { latlng?: { lat: number; lng: number } }) => void) => void;
  setCenter?: (center: { lat: number; lng: number }) => void;
  setZoom?: (zoom: number) => void;
}

declare global {
  interface Window {
    mappls?: {
      Map: new (id: string, opts: Record<string, unknown>) => MapplsMapLike;
      traffic: (opts: { map: MapplsMapLike }) => void;
    };
  }
}

const LOAD_TIMEOUT_MS = 12_000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.mappls) resolve();
      else existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Mappls SDK failed to load"));
    document.head.appendChild(script);
  });
}

export function MapplsCityMap({
  lat,
  lon,
  zoom = 13,
  showTraffic = true,
  className,
  onLocationPick,
  onUnavailable,
}: {
  lat: number;
  lon: number;
  zoom?: number;
  showTraffic?: boolean;
  className?: string;
  onLocationPick?: (lat: number, lon: number) => void;
  /** Called when Mappls cannot render — parent should switch to MapLibre fallback. */
  onUnavailable?: (reason: string) => void;
}) {
  const containerId = useRef(`mappls-${Math.random().toString(36).slice(2)}`);
  const mapRef = useRef<MapplsMapLike | null>(null);
  const trafficOnRef = useRef(false);
  const readyRef = useRef(false);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [detail, setDetail] = useState<string | null>(null);

  const markUnavailable = (reason: string) => {
    setState("unavailable");
    setDetail(reason);
    unavailableRef.current?.(reason);
  };

  useEffect(() => {
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    readyRef.current = false;
    setState("loading");
    setDetail(null);

    fetch("/api/mappls/config")
      .then((r) => r.json())
      .then(async (cfg) => {
        if (cancelled) return;
        if (!cfg.configured || !cfg.sdkUrl) {
          markUnavailable("MAPPLS_API_KEY not configured on server");
          return;
        }
        await loadScript(cfg.sdkUrl);
        if (cancelled || !window.mappls) {
          markUnavailable("Mappls SDK did not initialize");
          return;
        }

        const map = new window.mappls.Map(containerId.current, {
          center: { lat, lng: lon },
          zoom: Math.min(Math.max(zoom, 5), 18),
          zoomControl: true,
          location: false,
          traffic: showTraffic,
          backgroundColor: "#0a0d12",
        });
        mapRef.current = map;

        loadTimer = setTimeout(() => {
          if (!cancelled && !readyRef.current) {
            markUnavailable("Mappls map timed out — check domain whitelist in Mappls Console");
          }
        }, LOAD_TIMEOUT_MS);

        map.addListener("load", () => {
          if (cancelled) return;
          readyRef.current = true;
          if (loadTimer) clearTimeout(loadTimer);
          setState("ready");
          if (showTraffic && window.mappls && !trafficOnRef.current) {
            window.mappls.traffic({ map });
            trafficOnRef.current = true;
          }
        });

        map.addListener("click", (e) => {
          const ll = e?.latlng;
          if (ll && onLocationPick) onLocationPick(ll.lat, ll.lng);
        });
      })
      .catch(() => {
        if (!cancelled) {
          markUnavailable("Mappls SDK could not load — check domain whitelist in Mappls Console");
        }
      });

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      mapRef.current = null;
      trafficOnRef.current = false;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== "ready") return;
    map.setCenter?.({ lat, lng: lon });
    map.setZoom?.(Math.min(Math.max(zoom, 5), 18));
  }, [lat, lon, zoom, state]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || state !== "ready" || !showTraffic || !window.mappls || trafficOnRef.current) return;
    window.mappls.traffic({ map });
    trafficOnRef.current = true;
  }, [showTraffic, state]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        id={containerId.current}
        className="h-full w-full overflow-hidden rounded-lg border border-line bg-panel"
      />
      {state === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-body/60 text-xs text-ink-dim">
          Loading Mappls India map…
        </div>
      )}
      {state === "unavailable" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-body/80 p-4 text-center text-xs text-amber-400/90">
          {detail ?? "Mappls unavailable — using MapLibre fallback"}
        </div>
      )}
      {state === "ready" && showTraffic && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-body/85 px-2 py-1 text-[10px] text-emerald-400/90 backdrop-blur">
          Mappls live traffic · India
        </div>
      )}
    </div>
  );
}
