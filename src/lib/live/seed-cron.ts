import { runConnector, fetchFlights } from "@/lib/connectors";
import { seedLive } from "@/lib/live/store";
import { fetchAllWebcams } from "@/lib/live/webcams";
import type { Item } from "@/lib/types";

const FLIGHT_REGIONS = ["global", "europe", "usa", "india"];

export async function seedLiveDomains(): Promise<{
  flights: Record<string, number>;
  ships: number;
  webcams: number;
}> {
  const flights: Record<string, number> = {};
  await Promise.all(
    FLIGHT_REGIONS.map(async (region) => {
      try {
        const items: Item[] = await fetchFlights(region);
        await seedLive(`flights:${region}`, items, "OpenSky/adsb.lol");
        flights[region] = items.length;
      } catch {
        flights[region] = -1;
      }
    }),
  );

  let ships = 0;
  try {
    const items = (await runConnector("aishub_vessels")).filter((i) => typeof i.lat === "number");
    await seedLive("ships:global", items, "AISHub");
    ships = items.length;
  } catch {
    ships = -1;
  }

  let webcams = 0;
  try {
    const items = await fetchAllWebcams();
    await seedLive("webcams:all", items, "Curated + Windy");
    webcams = items.length;
  } catch {
    webcams = -1;
  }

  return { flights, ships, webcams };
}
