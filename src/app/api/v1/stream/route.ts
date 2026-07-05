import { NextRequest } from "next/server";
import { readLiveCached } from "@/lib/live/store";
import { LIVE_SOFT_TTL } from "@/lib/live/config";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** SSE delta stream — flight count snapshots (server→client). */
export async function GET(req: NextRequest) {
  const topics = (req.nextUrl.searchParams.get("topics") ?? "flights").split(",");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", topics, ts: new Date().toISOString() });

      for (let i = 0; i < 20; i++) {
        if (topics.includes("flights")) {
          const cached = await readLiveCached<Item[]>("flights:global", {
            ttlSeconds: LIVE_SOFT_TTL.flights,
            source: "OpenSky/adsb.lol",
            fallback: [],
          });
          send({
            type: "flights",
            count: cached.data.length,
            stale: cached.stale,
            updatedAt: cached.updatedAt,
            ts: new Date().toISOString(),
          });
        }
        await new Promise((r) => setTimeout(r, 15_000));
      }

      send({ type: "complete", ts: new Date().toISOString() });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
