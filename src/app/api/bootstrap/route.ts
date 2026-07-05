import { NextResponse } from "next/server";
import { readLiveCached } from "@/lib/live/store";
import { readModuleLiveCached } from "@/lib/live/module-cache";
import { readAllSeedMeta } from "@/lib/live/seed-meta";
import {
  BOOTSTRAP_FLIGHT_REGIONS,
  BOOTSTRAP_MODULES,
  LIVE_SOFT_TTL,
  SEED_META_DOMAINS,
} from "@/lib/live/config";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

type IssPosition = {
  lat: number;
  lon: number;
  altitudeKm?: number;
  velocityKmh?: number;
  timestamp?: string;
};

const FLIGHT_SOURCE = "OpenSky/adsb.lol/Wingbits";

/** Single hydration endpoint — Redis-read-only, never triggers upstream fetches. */
export async function GET() {
  const started = Date.now();

  const flightResults = await Promise.all(
    BOOTSTRAP_FLIGHT_REGIONS.map((region) =>
      readLiveCached<Item[]>(`flights:${region}`, {
        ttlSeconds: LIVE_SOFT_TTL.flights,
        source: FLIGHT_SOURCE,
        fallback: [],
      }).then((r) => ({ region, ...r })),
    ),
  );

  const [ships, webcams, iss, ...moduleResults] = await Promise.all([
    readLiveCached<Item[]>("ships:global", {
      ttlSeconds: LIVE_SOFT_TTL.ships,
      source: "AISHub",
      fallback: [],
    }),
    readLiveCached<unknown[]>("webcams:all", {
      ttlSeconds: LIVE_SOFT_TTL.webcams,
      source: "Curated + Windy",
      fallback: [],
    }),
    readLiveCached<IssPosition | null>("iss:position", {
      ttlSeconds: LIVE_SOFT_TTL.iss,
      source: "wheretheiss.at",
      fallback: null,
    }),
    ...BOOTSTRAP_MODULES.map((m) => readModuleLiveCached(m)),
  ]);

  const globalFlights = flightResults.find((f) => f.region === "global") ?? flightResults[0];
  const seedMeta = await readAllSeedMeta([...SEED_META_DOMAINS]);

  const modules: Record<string, {
    items: Item[];
    stale: boolean;
    cold: boolean;
    ageSeconds: number | null;
    updatedAt: string | null;
    source: string;
  }> = {};

  moduleResults.forEach((res, i) => {
    if (!res) return;
    modules[BOOTSTRAP_MODULES[i]] = {
      items: res.data,
      stale: res.stale,
      cold: res.cold,
      ageSeconds: res.ageSeconds == null ? null : Math.round(res.ageSeconds),
      updatedAt: res.updatedAt,
      source: res.source,
    };
  });

  return NextResponse.json({
    flights: {
      global: globalFlights.data,
      europe: flightResults.find((f) => f.region === "europe")?.data ?? [],
      stale: globalFlights.stale,
      cold: globalFlights.cold,
      ageSeconds: globalFlights.ageSeconds == null ? null : Math.round(globalFlights.ageSeconds),
      updatedAt: globalFlights.updatedAt,
      source: globalFlights.source,
    },
    ships: {
      items: ships.data,
      stale: ships.stale,
      cold: ships.cold,
      ageSeconds: ships.ageSeconds == null ? null : Math.round(ships.ageSeconds),
      updatedAt: ships.updatedAt,
      source: ships.source,
    },
    webcams: {
      items: webcams.data,
      stale: webcams.stale,
      cold: webcams.cold,
      ageSeconds: webcams.ageSeconds == null ? null : Math.round(webcams.ageSeconds),
      updatedAt: webcams.updatedAt,
      source: webcams.source,
    },
    iss: iss.data,
    modules,
    seedMeta,
    hydratedMs: Date.now() - started,
    fetchedAt: new Date().toISOString(),
  });
}
