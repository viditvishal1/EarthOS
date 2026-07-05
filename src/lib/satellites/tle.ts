import * as sat from "satellite.js";

export interface ParsedTle {
  noradId: string;
  name: string;
  line1: string;
  line2: string;
  satrec: sat.SatRec;
  epochAgeHours: number;
  stale: boolean;
}

export interface SatellitePosition {
  noradId: string;
  name: string;
  lat: number;
  lng: number;
  altKm: number;
  epochAgeHours: number;
  stale: boolean;
  observedAt: string;
}

export interface SatellitePass {
  aos: string;
  los: string;
  maxElevationDeg: number;
  durationSec: number;
}

const STALE_EPOCH_HOURS = 7 * 24;

function epochAgeHours(satrec: sat.SatRec): number {
  const now = new Date();
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
  return (now.getTime() - epochMs) / 3600000;
}

export function parseTleText(text: string, cap = 150): ParsedTle[] {
  const lines = text.split("\n").map((l) => l.trimEnd()).filter(Boolean);
  const out: ParsedTle[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [name, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!l1?.startsWith("1 ") || !l2?.startsWith("2 ")) continue;
    try {
      const satrec = sat.twoline2satrec(l1, l2);
      const noradId = String(satrec.satnum).trim().padStart(5, "0");
      const age = epochAgeHours(satrec);
      out.push({
        noradId,
        name: name.trim(),
        line1: l1,
        line2: l2,
        satrec,
        epochAgeHours: age,
        stale: age > STALE_EPOCH_HOURS,
      });
    } catch {
      /* skip malformed */
    }
    if (out.length >= cap) break;
  }
  return out;
}

export function propagatePosition(t: ParsedTle, when = new Date()): SatellitePosition | null {
  try {
    const pv = sat.propagate(t.satrec, when);
    if (!pv?.position || typeof pv.position === "boolean") return null;
    const gmst = sat.gstime(when);
    const geo = sat.eciToGeodetic(pv.position, gmst);
    const age = epochAgeHours(t.satrec);
    return {
      noradId: t.noradId,
      name: t.name,
      lat: sat.degreesLat(geo.latitude),
      lng: sat.degreesLong(geo.longitude),
      altKm: geo.height,
      epochAgeHours: age,
      stale: age > STALE_EPOCH_HOURS,
      observedAt: when.toISOString(),
    };
  } catch {
    return null;
  }
}

export function propagateBatch(parsed: ParsedTle[], when = new Date()): SatellitePosition[] {
  return parsed.flatMap((t) => {
    const p = propagatePosition(t, when);
    return p ? [p] : [];
  });
}

/** Ground track polyline for ±minutes around `when` (handles antimeridian split). */
export function groundTrack(
  t: ParsedTle,
  when = new Date(),
  minutes = 50,
  stepMin = 2,
): [number, number][] {
  const coords: [number, number][] = [];
  let prevLon: number | null = null;
  for (let m = -minutes; m <= minutes; m += stepMin) {
    const p = propagatePosition(t, new Date(when.getTime() + m * 60000));
    if (!p) continue;
    if (prevLon !== null && Math.abs(p.lng - prevLon) > 180) break;
    prevLon = p.lng;
    coords.push([p.lng, p.lat]);
  }
  return coords;
}

export function predictPasses(
  t: ParsedTle,
  observerLat: number,
  observerLon: number,
  hours = 24,
  minElevationDeg = 10,
): SatellitePass[] {
  const observerGd = {
    latitude: sat.degreesToRadians(observerLat),
    longitude: sat.degreesToRadians(observerLon),
    height: 0,
  };
  const passes: SatellitePass[] = [];
  const start = Date.now();
  const stepMs = 30_000;
  const totalMs = hours * 3600_000;

  let inPass = false;
  let passStart: Date | null = null;
  let passMaxEl = 0;
  let passLos: Date | null = null;

  for (let tMs = 0; tMs <= totalMs; tMs += stepMs) {
    const when = new Date(start + tMs);
    const pv = sat.propagate(t.satrec, when);
    if (!pv?.position || typeof pv.position === "boolean") continue;
    const gmst = sat.gstime(when);
    const ecf = sat.eciToEcf(pv.position, gmst);
    const look = sat.ecfToLookAngles(observerGd, ecf);
    const elDeg = (look.elevation * 180) / Math.PI;

    if (elDeg >= minElevationDeg) {
      if (!inPass) {
        inPass = true;
        passStart = when;
        passMaxEl = elDeg;
        passLos = when;
      } else {
        passMaxEl = Math.max(passMaxEl, elDeg);
        passLos = when;
      }
    } else if (inPass && passStart && passLos) {
      passes.push({
        aos: passStart.toISOString(),
        los: passLos.toISOString(),
        maxElevationDeg: Math.round(passMaxEl * 10) / 10,
        durationSec: Math.round((passLos.getTime() - passStart.getTime()) / 1000),
      });
      inPass = false;
      passStart = null;
      passLos = null;
      passMaxEl = 0;
    }
  }

  return passes.slice(0, 20);
}

export function findTleByNorad(parsed: ParsedTle[], norad: string): ParsedTle | undefined {
  const norm = norad.replace(/\D/g, "").padStart(5, "0");
  return parsed.find((t) => t.noradId === norm);
}
