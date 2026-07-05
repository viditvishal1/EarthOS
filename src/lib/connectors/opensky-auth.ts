/**
 * OpenSky OAuth2 client-credentials token manager (server-only).
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 */

import { cacheGet, cacheSet } from "@/lib/cache/redis";

const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const TOKEN_CACHE_KEY = "opensky:oauth:token";

type TokenCache = { accessToken: string; expiresAt: number };

const mem: { token?: TokenCache } = {};

export function openskyCredentialsConfigured(): boolean {
  return Boolean(process.env.OPENSKY_CLIENT_ID?.trim() && process.env.OPENSKY_CLIENT_SECRET?.trim());
}

async function fetchToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`opensky_oauth_${res.status}`);

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("opensky_oauth_no_token");

  const expiresIn = data.expires_in ?? 1800;
  const entry: TokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000 - 60_000,
  };
  mem.token = entry;
  await cacheSet(TOKEN_CACHE_KEY, entry, expiresIn).catch(() => {});
  return entry.accessToken;
}

export async function getOpenSkyAccessToken(): Promise<string | null> {
  if (mem.token && mem.token.expiresAt > Date.now()) return mem.token.accessToken;

  const cached = await cacheGet<TokenCache>(TOKEN_CACHE_KEY).catch(() => null);
  if (cached && cached.expiresAt > Date.now()) {
    mem.token = cached;
    return cached.accessToken;
  }

  return fetchToken();
}

export async function openskyAuthHeaders(): Promise<Record<string, string>> {
  const token = await getOpenSkyAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
