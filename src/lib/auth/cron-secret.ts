import { timingSafeEqual } from "crypto";

export function cronSecretConfigured(): boolean {
  return Boolean(resolveCronSecret());
}

export function resolveCronSecret(): string | undefined {
  return (
    process.env.CRON_SECRET
    ?? process.env.ARGUS_ADMIN_SECRET
    ?? process.env.EARTHOS_ADMIN_SECRET
  );
}

/** Verify Authorization: Bearer <CRON_SECRET>. Dev-only bypass when secret unset. */
export function verifyCronBearer(authHeader: string | null): boolean {
  const secret = resolveCronSecret();
  if (!secret) {
    return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  }
  if (!authHeader?.startsWith("Bearer ")) return false;
  const provided = authHeader.slice("Bearer ".length).trim();
  if (provided.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return false;
  }
}
