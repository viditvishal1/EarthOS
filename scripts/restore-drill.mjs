#!/usr/bin/env node
/**
 * Restore drill helper (Phase 8) — validates a pg_dump file without applying it.
 * Usage: node scripts/restore-drill.mjs backup.sql
 */
import { readFileSync, existsSync, statSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/restore-drill.mjs <backup.sql>");
  process.exit(1);
}

if (!existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const stat = statSync(file);
const text = readFileSync(file, "utf8");

let failed = 0;
const pass = (m) => console.log(`✓ ${m}`);
const fail = (m) => { console.log(`✗ ${m}`); failed += 1; };

if (stat.size > 1024) pass(`Backup size ${stat.size} bytes`);
else fail(`Backup suspiciously small (${stat.size} bytes)`);

if (/PostgreSQL database dump/i.test(text) || /CREATE TABLE/i.test(text)) pass("Looks like a Postgres dump");
else fail("Missing Postgres dump markers");

if (/COPY public\./i.test(text) || /INSERT INTO/i.test(text)) pass("Contains data statements");
else console.log("  · No COPY/INSERT blocks (schema-only dump is OK)");

console.log(failed === 0 ? "\nRestore drill validation passed." : `\n${failed} check(s) failed.`);
console.log("To apply: psql \"$DATABASE_URL\" <", file);
process.exit(failed === 0 ? 0 : 1);
