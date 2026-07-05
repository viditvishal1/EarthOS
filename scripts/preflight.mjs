#!/usr/bin/env node
/**
 * Preflight checks before deploy — no secrets printed.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

let failed = 0;

function pass(msg) { console.log(`✓ ${msg}`); }
function fail(msg) { console.log(`✗ ${msg}`); failed++; }

const root = process.cwd();

if (!existsSync(join(root, "package.json"))) fail("package.json missing");
else pass("package.json present");

const envExample = readFileSync(join(root, ".env.example"), "utf8");
const publicSecretLeaks = envExample.match(/^NEXT_PUBLIC_.*(SECRET|PASSWORD|PRIVATE)/gim);
if (publicSecretLeaks?.length) fail(`NEXT_PUBLIC secret-like vars in .env.example: ${publicSecretLeaks.join(", ")}`);
else pass("No sensitive NEXT_PUBLIC_* in .env.example");

const migrationsDir = join(root, "supabase/migrations");
for (const m of ["004_dashboard_panels.sql", "005_observations_tracks.sql", "006_provider_governance.sql"]) {
  if (existsSync(join(migrationsDir, m))) pass(`Migration ${m}`);
  else fail(`Missing migration ${m}`);
}

if (existsSync(join(root, "src/lib/connectors/registry.ts"))) pass("Provider registry");
else fail("Provider registry missing");

if (existsSync(join(root, "docker-compose.yml"))) pass("Docker Compose");
else fail("docker-compose.yml missing");

console.log(failed === 0 ? "\nPreflight passed." : `\n${failed} preflight check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
