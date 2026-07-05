/**
 * AISStream.io WebSocket snapshot collector — regional bbox windows, bounded runtime.
 * https://aisstream.io/documentation
 */

import { SHIP_SEED_BBOXES } from "@/lib/live/config";
import type { Item } from "@/lib/types";

const WS_URL = "wss://stream.aisstream.io/v0/stream";

export interface AisStreamCollectOptions {
  timeoutMs?: number;
  maxVessels?: number;
}

/** Parse a single AISStream PositionReport envelope into an Item. */
export function parseAisStreamMessage(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as Record<string, unknown>;
  if (envelope.MessageType !== "PositionReport") return null;

  const message = envelope.Message as Record<string, unknown> | undefined;
  const report = message?.PositionReport as Record<string, unknown> | undefined;
  if (!report) return null;

  const meta = envelope.MetaData as Record<string, unknown> | undefined;
  const lat = Number(report.Latitude ?? meta?.latitude);
  const lon = Number(report.Longitude ?? meta?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const mmsi = String(report.UserId ?? meta?.MMSI ?? meta?.MMSI_String ?? "").trim();
  if (!mmsi) return null;

  const name = String(meta?.ShipName ?? report.ShipName ?? mmsi).trim() || mmsi;
  const sog = report.Sog ?? report.SOG;
  const cog = report.Cog ?? report.COG;

  return {
    id: `vessel:aisstream:${mmsi}`,
    module: "maritime",
    connectorId: "aisstream_vessels",
    title: name,
    summary: `AISStream · MMSI ${mmsi}${sog != null ? ` · SOG ${sog} kn` : ""}`,
    source: "AISStream",
    timestamp: new Date().toISOString(),
    lat,
    lon,
    tags: ["vessel", "aisstream"],
    entities: [{ name, type: "vessel" }],
    contentPolicy: "metadata_only",
    extra: {
      mmsi,
      speedKn: sog != null ? Number(sog) : undefined,
      cog: cog != null ? Number(cog) : undefined,
      source: "aisstream",
    },
  };
}

function boundingBoxesFromSeed(): number[][][] {
  return SHIP_SEED_BBOXES.map((b) => [
    [b.latmin, b.lonmin],
    [b.latmax, b.lonmax],
  ]);
}

/** Collect vessel positions for a short window (serverless-safe). */
export async function collectAisStreamVessels(
  options: AisStreamCollectOptions = {},
): Promise<Item[]> {
  const key = process.env.AISSTREAM_API_KEY?.trim();
  if (!key) return [];

  const timeoutMs = options.timeoutMs ?? 18_000;
  const maxVessels = options.maxVessels ?? 800;

  const WebSocketCtor = globalThis.WebSocket as typeof WebSocket | undefined;
  if (!WebSocketCtor) return [];

  return new Promise((resolve) => {
    const byMmsi = new Map<string, Item>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve([...byMmsi.values()].slice(0, maxVessels));
    };

    const timer = setTimeout(finish, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocketCtor(WS_URL);
    } catch {
      finish();
      return;
    }

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: boundingBoxesFromSeed(),
          FilterMessageTypes: ["PositionReport"],
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        const item = parseAisStreamMessage(parsed);
        if (!item) return;
        const mmsi = String(item.extra?.mmsi ?? item.id);
        byMmsi.set(mmsi, item);
        if (byMmsi.size >= maxVessels) finish();
      } catch {
        /* skip malformed */
      }
    });

    ws.addEventListener("error", () => finish());
    ws.addEventListener("close", () => finish());
  });
}
