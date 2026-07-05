import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export interface ApiPrincipal {
  id: string;
  role: "anonymous" | "user" | "admin" | "service";
}

function readBearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

function secretsMatch(got: string, expected: string): boolean {
  try {
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function resolveSecrets(): string[] {
  return [
    process.env.ARGUS_API_SECRET,
    process.env.ARGUS_ADMIN_SECRET,
    process.env.EARTHOS_ADMIN_SECRET,
  ].filter((s): s is string => Boolean(s?.trim()));
}

/**
 * Private API auth — bearer secret when configured; dev passthrough when unset.
 * Full Supabase Auth user sessions are Phase 2; this closes the public-write gap.
 */
export function resolveApiPrincipal(req: NextRequest): ApiPrincipal {
  const token = readBearer(req);
  const secrets = resolveSecrets();
  if (token && secrets.some((s) => secretsMatch(token, s))) {
    return { id: "admin", role: "admin" };
  }
  if (secrets.length === 0 && process.env.NODE_ENV !== "production") {
    return { id: "dev-anonymous", role: "anonymous" };
  }
  return { id: "anonymous", role: "anonymous" };
}

export function requirePrivateApi(req: NextRequest): ApiPrincipal | NextResponse {
  const principal = resolveApiPrincipal(req);
  const secrets = resolveSecrets();
  if (secrets.length > 0 && principal.role === "anonymous") {
    return NextResponse.json(
      { error: "unauthorized", message: "Bearer token required for this endpoint" },
      { status: 401 },
    );
  }
  return principal;
}

export function isPrincipalError(v: ApiPrincipal | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
