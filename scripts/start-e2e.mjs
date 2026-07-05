#!/usr/bin/env node
/**
 * Start production server for Playwright (standalone output).
 * Copies static assets into the standalone bundle, then runs server.js.
 */
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(root, ".next", "standalone");

function resolveStandaloneDir() {
  const direct = path.join(standaloneRoot, "server.js");
  if (existsSync(direct)) return standaloneRoot;
  const nested = path.join(standaloneRoot, "Argus", "server.js");
  if (existsSync(nested)) return path.join(standaloneRoot, "Argus");
  return null;
}

const standalone = resolveStandaloneDir();
if (!standalone) {
  console.error("Missing .next/standalone/**/server.js — run npm run build first.");
  process.exit(1);
}

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

const child = spawn("node", ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.PORT ?? "3000", HOSTNAME: "0.0.0.0" },
});

child.on("exit", (code) => process.exit(code ?? 0));
