#!/usr/bin/env node
/**
 * Postgres backup helper for self-hosting (Phase 8).
 * Usage: DATABASE_URL=postgres://... node scripts/backup-db.mjs [output.sql]
 */
import { writeFileSync } from "fs";
import { execSync } from "child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const out = process.argv[2] ?? `argus-backup-${new Date().toISOString().slice(0, 10)}.sql`;

try {
  const dump = execSync(`pg_dump "${url}" --no-owner --no-acl`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(out, dump);
  console.log(`Wrote ${out} (${dump.length} bytes)`);
} catch (err) {
  console.error("pg_dump failed — install PostgreSQL client tools", err instanceof Error ? err.message : err);
  process.exit(1);
}
