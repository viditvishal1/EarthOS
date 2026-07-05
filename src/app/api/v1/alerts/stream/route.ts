import { subscribeAlertStream } from "@/lib/alerts/stream";
import type { AlertEvent } from "@/lib/alerts/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: AlertEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "alert", alert: event })}\n\n`));
      };

      unsubscribe = subscribeAlertStream(send);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", at: new Date().toISOString() })}\n\n`));

      keepalive = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: keepalive\n\n`));
      }, 25000);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
