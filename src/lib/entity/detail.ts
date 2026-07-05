import type { Item } from "@/lib/types";

export type EntityKind =
  | "flight"
  | "vessel"
  | "webcam"
  | "cctv"
  | "iss"
  | "quake"
  | "event"
  | "generic";

export interface DetailField {
  label: string;
  value: string;
  mono?: boolean;
}

export function detectEntityKind(item: Item): EntityKind {
  if (item.tags.includes("flight") || item.id.startsWith("flight:")) return "flight";
  if (item.tags.includes("vessel") || item.id.startsWith("vessel:")) return "vessel";
  if (item.tags.includes("webcam") || item.id.startsWith("webcam:")) return "webcam";
  if (item.tags.includes("cctv")) return "cctv";
  if (item.tags.includes("iss") || item.id === "iss") return "iss";
  if (item.tags.includes("earthquake")) return "quake";
  if (item.tags.includes("satellite")) return "generic";
  if (typeof item.lat === "number") return "event";
  return "generic";
}

export function entityKindLabel(kind: EntityKind): string {
  const labels: Record<EntityKind, string> = {
    flight: "Flight",
    vessel: "Vessel",
    webcam: "Webcam",
    cctv: "CCTV",
    iss: "ISS",
    quake: "Earthquake",
    event: "Event",
    generic: "Signal",
  };
  return labels[kind];
}

function fmtCoord(lat?: number, lon?: number): string | null {
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const latH = lat >= 0 ? "N" : "S";
  const lonH = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latH}, ${Math.abs(lon).toFixed(4)}° ${lonH}`;
}

function fmtHeading(deg?: number | null): string | null {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return null;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return `${Math.round(deg)}° ${dirs[idx]}`;
}

export function extractEntityFields(item: Item): DetailField[] {
  const kind = detectEntityKind(item);
  const fields: DetailField[] = [];
  const extra = item.extra ?? {};

  const coords = fmtCoord(item.lat, item.lon);
  if (coords) fields.push({ label: "Coordinates", value: coords, mono: true });

  switch (kind) {
    case "flight": {
      const icao = String(extra.icao24 ?? item.id.replace("flight:", "")).toUpperCase();
      fields.push({ label: "ICAO hex", value: icao, mono: true });
      if (extra.inferredAirlinePrefix) {
        fields.push({ label: "Operator prefix", value: String(extra.inferredAirlinePrefix), mono: true });
      }
      if (extra.originCountry) fields.push({ label: "Origin country", value: String(extra.originCountry) });
      if (extra.aircraftType) fields.push({ label: "Aircraft type", value: String(extra.aircraftType), mono: true });
      if (extra.registration) fields.push({ label: "Registration", value: String(extra.registration), mono: true });
      if (typeof extra.altitudeM === "number") {
        fields.push({
          label: "Altitude",
          value: `${Math.round(extra.altitudeM).toLocaleString()} m (${Math.round(extra.altitudeM * 3.28084).toLocaleString()} ft)`,
          mono: true,
        });
      }
      if (typeof extra.velocityMs === "number") {
        fields.push({
          label: "Ground speed",
          value: `${Math.round(extra.velocityMs * 3.6)} km/h (${Math.round(extra.velocityMs * 1.94384)} kn)`,
          mono: true,
        });
      }
      const hdg = fmtHeading(extra.heading as number | null);
      if (hdg) fields.push({ label: "Heading", value: hdg, mono: true });
      if (typeof extra.onGround === "boolean") {
        fields.push({ label: "On ground", value: extra.onGround ? "Yes" : "No" });
      }
      fields.push({
        label: "Route",
        value: extra.routeKnown ? "Known" : "Unknown (ADS-B state only)",
      });
      break;
    }
    case "vessel": {
      if (extra.mmsi) fields.push({ label: "MMSI", value: String(extra.mmsi), mono: true });
      if (extra.type) fields.push({ label: "Vessel type", value: String(extra.type) });
      if (typeof extra.speedKn === "number" || extra.speedKn != null) {
        fields.push({ label: "Speed", value: `${extra.speedKn} kn`, mono: true });
      }
      if (extra.destination) {
        const dest = String(extra.destination).trim();
        if (dest && dest.toLowerCase() !== "n/a") fields.push({ label: "Destination", value: dest });
      }
      const cog = fmtHeading(extra.cog as number | null ?? extra.heading as number | null);
      if (cog) fields.push({ label: "Course", value: cog, mono: true });
      break;
    }
    case "webcam":
      fields.push({ label: "Provider", value: item.source });
      break;
    case "cctv":
      fields.push({ label: "Agency", value: item.source });
      if (extra.cctvStatus) fields.push({ label: "Status", value: String(extra.cctvStatus) });
      if (typeof extra.refreshSeconds === "number") {
        fields.push({ label: "Refresh", value: `~${Math.round(extra.refreshSeconds / 60)} min` });
      }
      break;
    case "iss":
      fields.push({ label: "Object", value: "International Space Station" });
      break;
    case "quake":
      if (item.severityLabel) fields.push({ label: "Magnitude", value: item.severityLabel, mono: true });
      break;
    default:
      if (item.severityLabel) fields.push({ label: "Severity", value: item.severityLabel, mono: true });
      break;
  }

  fields.push({
    label: "Observed",
    value: new Date(item.timestamp).toUTCString(),
    mono: true,
  });

  return fields;
}

export function entityTrackKey(item: Item | null): string | null {
  if (!item) return null;
  const kind = detectEntityKind(item);
  if (kind === "flight") {
    const icao = String(item.extra?.icao24 ?? item.id.replace("flight:", "")).toLowerCase();
    return icao ? `flight:${icao}` : null;
  }
  if (kind === "vessel") return item.id;
  return null;
}

export function entityTrackColor(kind: EntityKind): string {
  switch (kind) {
    case "flight": return "#39ff8f";
    case "vessel": return "#22d3ee";
    default: return "#a78bfa";
  }
}
