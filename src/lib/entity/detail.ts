import type { Item } from "@/lib/types";
import type { FlightEnrichment } from "@/lib/aviation/adsb-enrichment";

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
  highlight?: boolean;
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

function fmtAltM(m?: number | null): string | null {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  return `${Math.round(m).toLocaleString()} m (${Math.round(m * 3.28084).toLocaleString()} ft)`;
}

function fmtAltFt(ft?: number | null): string | null {
  if (typeof ft !== "number" || !Number.isFinite(ft)) return null;
  return `${Math.round(ft).toLocaleString()} ft`;
}

function fmtSpeedMs(ms?: number | null): string | null {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return `${Math.round(ms * 3.6)} km/h (${Math.round(ms * 1.94384)} kn)`;
}

function fmtVerticalFpm(fpm?: number | null): string | null {
  if (typeof fpm !== "number" || !Number.isFinite(fpm)) return null;
  const dir = fpm > 50 ? "climbing" : fpm < -50 ? "descending" : "level";
  return `${fpm > 0 ? "+" : ""}${Math.round(fpm)} fpm (${dir})`;
}

function fmtSeen(seconds?: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds.toFixed(1)}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function pushField(
  fields: DetailField[],
  label: string,
  value: string | null | undefined,
  opts?: { mono?: boolean; highlight?: boolean },
) {
  if (!value) return;
  fields.push({ label, value, mono: opts?.mono, highlight: opts?.highlight });
}

export function extractEntityFields(
  item: Item,
  enrichment?: FlightEnrichment | null,
): DetailField[] {
  const kind = detectEntityKind(item);
  const fields: DetailField[] = [];
  const extra: Record<string, unknown> = { ...item.extra, ...(enrichment?.provenance ?? {}) };

  const coords = fmtCoord(item.lat, item.lon);
  if (coords) fields.push({ label: "Position", value: coords, mono: true });

  switch (kind) {
    case "flight": {
      const icao = String(extra.icao24 ?? item.id.replace("flight:", "")).toUpperCase();
      const callsign = String(extra.callsign ?? item.title).trim();

      pushField(fields, "Callsign", callsign, { mono: true, highlight: true });
      pushField(fields, "ICAO hex", icao, { mono: true });
      pushField(fields, "Registration", extra.registration ? String(extra.registration) : null, { mono: true });
      pushField(fields, "Operator", extra.airlineCode ? String(extra.airlineCode) : extra.inferredAirlinePrefix ? String(extra.inferredAirlinePrefix) : null, { mono: true });
      pushField(fields, "Type", extra.aircraftType ? String(extra.aircraftType) : null, { mono: true });
      pushField(fields, "Squawk", extra.squawk ? String(extra.squawk) : null, { mono: true });

      const routeLabel = extra.routeKnown && extra.route
        ? String(extra.route)
        : extra.origin && extra.destination
          ? `${extra.origin} → ${extra.destination}`
          : null;
      pushField(fields, "Route", routeLabel ?? "Unknown (ADS-B state only)", { mono: true, highlight: Boolean(routeLabel) });

      if (enrichment?.route?.airports?.length) {
        const names = enrichment.route.airports.map((a) => a.iata ?? a.icao).join(" → ");
        pushField(fields, "Airports", names, { mono: true });
        if (enrichment.route.plausible === false) {
          pushField(fields, "Route fit", "Implausible for position");
        }
      }

      if (extra.originCountry) pushField(fields, "Origin country", String(extra.originCountry));

      const baro = fmtAltFt(extra.baroAltFt as number | null);
      const geom = fmtAltFt(extra.geomAltFt as number | null);
      const altM = fmtAltM(extra.altitudeM as number | null);
      if (baro && geom && baro !== geom) {
        pushField(fields, "Baro alt", baro, { mono: true });
        pushField(fields, "Geom alt", geom, { mono: true });
      } else if (altM) {
        pushField(fields, "Altitude", altM, { mono: true });
      }

      pushField(fields, "Ground speed", fmtSpeedMs(extra.velocityMs as number | null), { mono: true });
      pushField(fields, "Vertical rate", fmtVerticalFpm(extra.verticalRateFpm as number | null), { mono: true });

      const track = fmtHeading((extra.track ?? extra.heading) as number | null);
      if (track) pushField(fields, "Track", track, { mono: true });
      const trueHdg = fmtHeading(extra.trueHeading as number | null);
      if (trueHdg && trueHdg !== track) pushField(fields, "True heading", trueHdg, { mono: true });
      const magHdg = fmtHeading(extra.magHeading as number | null);
      if (magHdg) pushField(fields, "Mag heading", magHdg, { mono: true });

      if (typeof extra.onGround === "boolean") {
        pushField(fields, "On ground", extra.onGround ? "Yes" : "No");
      }

      pushField(fields, "Source", extra.adsbType ? String(extra.adsbType) : item.source, { mono: true });
      if (typeof extra.messageCount === "number") {
        pushField(fields, "Messages", extra.messageCount.toLocaleString(), { mono: true });
      }
      if (typeof extra.rssi === "number") {
        pushField(fields, "RSSI", `${extra.rssi.toFixed(1)} dBm`, { mono: true });
      }
      const seen = fmtSeen(extra.seenSeconds as number | null);
      if (seen) pushField(fields, "Last seen", seen, { mono: true });
      const seenPos = fmtSeen(extra.seenPosSeconds as number | null);
      if (seenPos && seenPos !== seen) pushField(fields, "Pos update", seenPos, { mono: true });

      if (typeof extra.windDirection === "number" && typeof extra.windSpeedKt === "number") {
        pushField(fields, "Wind", `${Math.round(extra.windSpeedKt)} kt @ ${Math.round(extra.windDirection)}°`, { mono: true });
      }
      if (typeof extra.oatC === "number") {
        pushField(fields, "OAT", `${extra.oatC}°C`, { mono: true });
      }
      if (typeof extra.tatC === "number") {
        pushField(fields, "TAT", `${extra.tatC}°C`, { mono: true });
      }
      if (extra.emergency) pushField(fields, "Emergency", String(extra.emergency));
      break;
    }
    case "vessel": {
      if (extra.mmsi) fields.push({ label: "MMSI", value: String(extra.mmsi), mono: true });
      if (extra.imo) fields.push({ label: "IMO", value: String(extra.imo), mono: true });
      if (extra.type) fields.push({ label: "Vessel type", value: String(extra.type) });
      if (typeof extra.speedKn === "number" || extra.speedKn != null) {
        fields.push({ label: "Speed", value: `${extra.speedKn} kn`, mono: true });
      }
      if (extra.destination) {
        const dest = String(extra.destination).trim();
        if (dest && dest.toLowerCase() !== "n/a") fields.push({ label: "Destination", value: dest });
      }
      if (extra.eta) {
        const eta = String(extra.eta).trim();
        if (eta) fields.push({ label: "ETA", value: eta, mono: true });
      }
      const cog = fmtHeading(extra.cog as number | null ?? extra.heading as number | null);
      if (cog) fields.push({ label: "Course (COG)", value: cog, mono: true });
      const hdg = fmtHeading(extra.heading as number | null);
      if (hdg && hdg !== cog) fields.push({ label: "Heading", value: hdg, mono: true });
      if (typeof extra.navStatus === "number") {
        fields.push({ label: "Nav status", value: String(extra.navStatus), mono: true });
      }
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

export function entityImageUrl(item: Item, enrichment?: FlightEnrichment | null): string | null {
  const kind = detectEntityKind(item);
  if (kind === "flight") {
    return enrichment?.imageUrl
      ?? (typeof item.extra?.imageUrl === "string" ? item.extra.imageUrl : null);
  }
  if (typeof item.extra?.imageUrl === "string") return item.extra.imageUrl;
  if (kind === "webcam" && item.url) return item.url;
  return null;
}
