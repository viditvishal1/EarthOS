import { describe, expect, it } from "vitest";
import type { Item } from "@/lib/types";
import { buildEntityTrackLine, destinationPoint } from "@/lib/geo/track";
import {
  detectEntityKind,
  entityTrackKey,
  extractEntityFields,
} from "@/lib/entity/detail";

const flightItem: Item = {
  id: "flight:abc123",
  module: "aviation",
  connectorId: "opensky_states",
  title: "UAL123",
  summary: "UAL123 · alt 10000 m",
  source: "OpenSky",
  timestamp: "2026-07-05T12:00:00Z",
  lat: 40.7,
  lon: -74.0,
  tags: ["flight"],
  entities: [{ name: "UAL123", type: "aircraft" }],
  contentPolicy: "metadata_only",
  extra: {
    icao24: "abc123",
    heading: 90,
    altitudeM: 10000,
    velocityMs: 250,
    inferredAirlinePrefix: "UAL",
    onGround: false,
    routeKnown: false,
  },
};

describe("detectEntityKind", () => {
  it("classifies flights and vessels by tags", () => {
    expect(detectEntityKind(flightItem)).toBe("flight");
    expect(detectEntityKind({ ...flightItem, id: "vessel:123", tags: ["vessel"], extra: {} })).toBe("vessel");
    expect(detectEntityKind({ ...flightItem, tags: ["earthquake"], id: "q1" })).toBe("quake");
  });
});

describe("extractEntityFields", () => {
  it("includes flight telemetry fields", () => {
    const fields = extractEntityFields(flightItem);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain("ICAO hex");
    expect(labels).toContain("Callsign");
    expect(labels).toContain("Track");
    expect(labels).toContain("Altitude");
    expect(fields.find((f) => f.label === "ICAO hex")?.value).toBe("ABC123");
  });

  it("shows enriched route when provided", () => {
    const fields = extractEntityFields(flightItem, {
      icao24: "abc123",
      callsign: "UAL123",
      provenance: {
        routeKnown: true,
        route: "EWR-CLT",
        origin: "KEWR",
        destination: "KCLT",
        squawk: "1200",
        verticalRateFpm: 1500,
        rssi: -12.5,
        seenSeconds: 2,
      },
      route: {
        callsign: "UAL123",
        airportCodes: "KEWR-KCLT",
        airportCodesIata: "EWR-CLT",
        airports: [
          { icao: "KEWR", iata: "EWR", name: "Newark", lat: 40, lon: -74 },
          { icao: "KCLT", iata: "CLT", name: "Charlotte", lat: 35, lon: -81 },
        ],
      },
      imageUrl: null,
      provider: "adsb.lol",
      fetchedAt: new Date().toISOString(),
    });
    expect(fields.find((f) => f.label === "Route")?.value).toBe("EWR-CLT");
    expect(fields.find((f) => f.label === "Squawk")?.value).toBe("1200");
  });
});

describe("entityTrackKey", () => {
  it("returns icao key for flights", () => {
    expect(entityTrackKey(flightItem)).toBe("flight:abc123");
    expect(entityTrackKey(null)).toBeNull();
  });
});

describe("buildEntityTrackLine", () => {
  it("projects a bearing line when no history", () => {
    const coords = buildEntityTrackLine({ lat: 0, lon: 0, heading: 90, projectKm: 100 });
    expect(coords.length).toBe(2);
    expect(coords[0]).toEqual([0, 0]);
    const [lon2] = coords[1];
    expect(lon2).toBeGreaterThan(0);
  });

  it("uses history when available", () => {
    const coords = buildEntityTrackLine({
      lat: 1,
      lon: 1,
      history: [
        { lat: 0, lon: 0 },
        { lat: 0.5, lon: 0.5 },
        { lat: 1, lon: 1 },
      ],
    });
    expect(coords).toHaveLength(3);
    expect(coords[2]).toEqual([1, 1]);
  });
});

describe("destinationPoint", () => {
  it("moves east from equator when bearing is 90°", () => {
    const [lon] = destinationPoint(0, 0, 90, 111);
    expect(lon).toBeGreaterThan(0.9);
  });
});
