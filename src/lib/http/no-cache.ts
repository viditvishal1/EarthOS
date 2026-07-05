import { NextResponse } from "next/server";

/** Prevent CDN/browser caching of cron and health diagnostics. */
export function noCacheJson<T extends Record<string, unknown>>(
  body: T,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}
