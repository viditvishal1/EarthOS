/** Major airport hubs as map layer items (G08 aviation depth). */

import type { Item } from "@/lib/types";
import { HUB_AIRPORT_COORDS } from "@/lib/maps/static-geo";
import { registerConnector } from "./framework";

registerConnector(
  {
    id: "major_airport_hubs",
    module: "aviation",
    source: "OurAirports / editorial hub list",
    sourceUrl: "https://ourairports.com",
    scheduleSeconds: 86400,
    contentPolicy: "metadata_only",
    entityTypes: ["location"],
  },
  async () => {
    const now = new Date().toISOString();
    return Object.entries(HUB_AIRPORT_COORDS).map(([icao, hub]): Item => ({
      id: `airport:${icao}`,
      module: "aviation",
      connectorId: "major_airport_hubs",
      title: `${hub.name} (${icao})`,
      summary: "Major international hub",
      source: "Argus hub index",
      timestamp: now,
      lat: hub.lat,
      lon: hub.lon,
      tags: ["airport", "hub", icao.toLowerCase()],
      region: icao.startsWith("K") ? "US" : icao.slice(0, 2),
      entities: [{ name: hub.name, type: "location" }],
      contentPolicy: "metadata_only",
    }));
  },
);

export const MAJOR_AIRPORTS_CONNECTOR_ID = "major_airport_hubs";
