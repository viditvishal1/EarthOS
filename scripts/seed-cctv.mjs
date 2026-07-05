#!/usr/bin/env node
/**
 * CCTV cache warm — triggers the live seed cron (includes all CCTV adapters)
 * then reports per-source counts from Redis via /api/cctv.
 *
 * Adapter implementation: src/lib/live/cctv/seed.ts (seeded by GET /api/cron/live).
 *
 * Usage:
 *   ARGUS_APP_URL=https://your-app.vercel.app CRON_SECRET='...' npm run seed:cctv
 */

const base = (process.env.ARGUS_APP_URL ?? process.env.VERCEL_URL ?? "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET;
const sources = ["tfl", "wsdot", "caltrans", "nycdot", "vicroads"];

let failed = 0;

function pass(msg) {
  console.log(`✓ ${msg}`);
}

function fail(msg) {
  console.log(`✗ ${msg}`);
  failed += 1;
}

async function fetchJson(path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

async function main() {
  if (!base) {
    console.error("ARGUS_APP_URL is required");
    process.exit(1);
  }
  if (!secret) {
    console.error("CRON_SECRET is required");
    process.exit(1);
  }

  console.log(`Seeding CCTV via ${base}/api/cron/live …`);

  const cron = await fetchJson("/api/cron/live", {
    Authorization: `Bearer ${secret}`,
  });
  if (cron.status === 200 && cron.body.ok) pass("Live seed completed");
  else if (cron.status === 409) pass("Live seed already running (409) — continuing to read cache");
  else {
    fail(`Live seed HTTP ${cron.status}: ${cron.body.error ?? cron.body.message ?? "unknown"}`);
  }

  const agg = await fetchJson("/api/cctv");
  if (agg.body.count > 0) {
    pass(`Aggregate CCTV cameras: ${agg.body.count} (stale=${agg.body.stale})`);
  } else {
    fail(`No CCTV cameras in cache (cold=${agg.body.cold})`);
  }

  for (const source of sources) {
    const r = await fetchJson(`/api/cctv?source=${source}`);
    const n = r.body.count ?? 0;
    if (n > 0) pass(`${source}: ${n} cameras`);
    else console.log(`  · ${source}: 0 (disabled, missing optional key, or upstream unavailable)`);
  }

  console.log(failed === 0 ? "\nCCTV seed check passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
