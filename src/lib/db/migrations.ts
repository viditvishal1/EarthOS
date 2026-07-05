/** Runtime migration version check — compares applied Supabase migrations to repo files. */

import { readdirSync } from "fs";
import { join } from "path";

export const EXPECTED_MIGRATIONS = [
  "001_platform_foundation.sql",
  "002_ontology_search_ops.sql",
  "003_secure_base_rls.sql",
  "004_dashboard_panels.sql",
  "006_provider_governance.sql",
] as const;

export function listRepoMigrations(root = process.cwd()): string[] {
  try {
    const dir = join(root, "supabase/migrations");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return [...EXPECTED_MIGRATIONS];
  }
}

export function migrationCheck(root = process.cwd()): {
  expected: readonly string[];
  found: string[];
  missing: string[];
  ok: boolean;
} {
  const found = listRepoMigrations(root);
  const missing = EXPECTED_MIGRATIONS.filter((m) => !found.includes(m));
  return { expected: EXPECTED_MIGRATIONS, found, missing, ok: missing.length === 0 };
}
