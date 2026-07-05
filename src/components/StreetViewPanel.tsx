"use client";

// Inline street-level panorama for City Digital Twin — Google Street View when
// NEXT_PUBLIC_GOOGLE_MAPS_KEY is set, otherwise Mapillary embed. Mini-map corner
// keeps satellite context and supports pin drops.

import { MapView } from "@/components/MapView";

export function googleStreetViewEmbedUrl(key: string, lat: number, lon: number): string {
  return `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(key)}&location=${lat},${lon}&heading=0&pitch=0&fov=80`;
}

export function mapillaryEmbedUrl(lat: number, lon: number): string {
  return `https://www.mapillary.com/embed?lat=${lat}&lng=${lon}&z=17&focus=photo&style=photo`;
}

export function mapillaryAppUrl(lat: number, lon: number): string {
  return `https://www.mapillary.com/app/?lat=${lat}&lng=${lon}&z=17`;
}

interface StreetViewPanelProps {
  lat: number;
  lon: number;
  label?: string;
  googleMapsKey?: string;
  className?: string;
  onLocationPick?: (lat: number, lon: number) => void;
}

export function StreetViewPanel({
  lat,
  lon,
  label,
  googleMapsKey,
  className,
  onLocationPick,
}: StreetViewPanelProps) {
  const useGoogle = Boolean(googleMapsKey);
  const embedUrl = useGoogle
    ? googleStreetViewEmbedUrl(googleMapsKey!, lat, lon)
    : mapillaryEmbedUrl(lat, lon);

  return (
    <div className={`relative overflow-hidden rounded-lg border border-line ${className ?? "h-[58vh] w-full"}`}>
      <iframe
        key={embedUrl}
        title={useGoogle ? "Google Street View" : "Mapillary Street Imagery"}
        className="absolute inset-0 h-full w-full border-0"
        src={embedUrl}
        allowFullScreen
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
        <div className="pointer-events-auto rounded-md border border-line bg-body/90 px-2.5 py-1 text-[10px] text-ink-dim backdrop-blur">
          <span className="font-medium text-ink">{useGoogle ? "Google Street View" : "Mapillary"}</span>
          <span className="mx-1.5 text-line">·</span>
          <span className="mono">
            {lat.toFixed(4)}°, {lon.toFixed(4)}°
          </span>
        </div>
        {!useGoogle && (
          <a
            href={mapillaryAppUrl(lat, lon)}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto rounded-md border border-line bg-body/90 px-2 py-1 text-[10px] text-indigo-300 backdrop-blur hover:bg-panel"
          >
            Open in Mapillary
          </a>
        )}
      </div>
      <div className="absolute bottom-3 right-3 z-20 h-36 w-44 overflow-hidden rounded-md border border-line shadow-lg">
        <MapView
          layers={[]}
          pin={label ? { lat, lon, label } : { lat, lon }}
          center={[lon, lat]}
          zoom={16}
          maxZoom={19}
          defaultBasemap="satellite"
          defaultGlobe={false}
          className="h-full w-full [&>div:first-child]:rounded-none [&>div:first-child]:border-0"
          mapControlsClass="hidden"
          onLocationPick={onLocationPick}
        />
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[55%] rounded-md border border-line bg-body/80 px-2 py-1 text-[10px] text-ink-dim backdrop-blur">
        Click the mini-map to move the pin · panorama updates automatically
      </p>
    </div>
  );
}
