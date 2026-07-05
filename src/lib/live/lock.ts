import { randomUUID } from "crypto";
import { cacheDel, cacheGetString, cacheSetNx } from "@/lib/cache/redis";
import { LIVE_SEED_LOCK_KEY, LIVE_SEED_LOCK_TTL_SECONDS } from "@/lib/live/config";

export interface LiveSeedLock {
  token: string;
  acquired: boolean;
}

export async function acquireLiveSeedLock(): Promise<LiveSeedLock> {
  const token = randomUUID();
  const acquired = await cacheSetNx(LIVE_SEED_LOCK_KEY, token, LIVE_SEED_LOCK_TTL_SECONDS);
  return { token, acquired };
}

export async function releaseLiveSeedLock(token: string): Promise<void> {
  const current = await cacheGetString(LIVE_SEED_LOCK_KEY);
  if (current === token) {
    await cacheDel(LIVE_SEED_LOCK_KEY);
  }
}
