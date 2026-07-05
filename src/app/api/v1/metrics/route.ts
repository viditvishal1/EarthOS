import { NextResponse } from "next/server";
import { renderPrometheusMetrics } from "@/lib/observability/metrics";

export const dynamic = "force-dynamic";

/** Prometheus text metrics — counters only, no secrets. */
export async function GET() {
  const body = renderPrometheusMetrics();
  return new NextResponse(body || "# no metrics yet\n", {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
