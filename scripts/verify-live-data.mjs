#!/usr/bin/env node
/**
 * Manual live-data verification — never prints CRON_SECRET.
 * Usage:
 *   ARGUS_APP_URL=https://your-app.vercel.app CRON_SECRET='...' npm run verify:live-data
 */

const base = (process.env.ARGUS_APP_URL ?? process.env.VERCEL_URL ?? "").replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? process.env.ARGUS_ADMIN_SECRET ?? process.env.EARTHOS_ADMIN_SECRET;

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

  console.log(`Verifying ${base} …`);

  const redis = await fetchJson("/api/health/redis");
  if (redis.body.configured) pass(`Redis configured (scheme=${redis.body.scheme})`);
  else fail("Redis not configured");
  if (redis.body.reachable) pass(`Redis reachable (${redis.body.latencyMs}ms)`);
  else fail(`Redis unreachable: ${redis.body.errorCategory ?? redis.body.status}`);

  const live = await fetchJson("/api/health/live-data");
  if (live.body.cronSecretConfigured) pass("CRON_SECRET configured on server");
  else fail("CRON_SECRET not configured on server");
  if (live.body.keysPresent?.length) {
    pass(`Live keys present: ${live.body.keysPresent.join(", ")}`);
  } else {
    fail("No live cache keys populated yet");
  }

  const cron = await fetchJson("/api/cron/live", {
    Authorization: `Bearer ${secret}`,
  });
  if (cron.status === 200 && cron.body.ok) pass("Cron live seed succeeded");
  else if (cron.status === 409) pass("Cron returned 409 (already running) — acceptable");
  else fail(`Cron failed HTTP ${cron.status}: ${cron.body.error ?? cron.body.message ?? "unknown"}`);

  const bootstrap = await fetchJson("/api/bootstrap");
  const flightCount = bootstrap.body?.flights?.global?.length ?? bootstrap.body?.flights?.global ?? 0;
  if (Array.isArray(bootstrap.body?.flights?.global) && bootstrap.body.flights.global.length > 0) {
    pass(`Bootstrap flights global: ${bootstrap.body.flights.global.length}`);
  } else {
    fail(`Bootstrap flights empty (cold=${bootstrap.body?.flights?.cold})`);
  }

  const cctvCount = bootstrap.body?.cctv?.cameras?.length ?? 0;
  if (cctvCount > 0) {
    pass(`Bootstrap CCTV cameras: ${cctvCount}`);
  } else {
    console.log(`  · CCTV cache empty (cold=${bootstrap.body?.cctv?.cold}) — TfL may need cron warm`);
  }

  console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
