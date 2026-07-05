import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hasApiSecrets, isPrincipalError, requirePrivateApi, resolveBearerPrincipal } from "@/lib/auth/api-guard";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
  })),
}));

vi.mock("@/lib/supabase/env", () => ({
  supabaseAuthConfigured: () => false,
}));

function req(auth?: string) {
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/test", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api-guard permission matrix", () => {
  it("resolveBearerPrincipal accepts matching ARGUS_API_SECRET", () => {
    vi.stubEnv("ARGUS_API_SECRET", "gate-test-secret-32chars!!!!!");
    const p = resolveBearerPrincipal(req("Bearer gate-test-secret-32chars!!!!!"));
    expect(p?.role).toBe("admin");
  });

  it("resolveBearerPrincipal rejects wrong bearer", () => {
    vi.stubEnv("ARGUS_API_SECRET", "gate-test-secret-32chars!!!!!");
    expect(resolveBearerPrincipal(req("Bearer wrong"))).toBeNull();
  });

  it("requirePrivateApi allows dev passthrough when no secrets", async () => {
    vi.stubEnv("ARGUS_API_SECRET", "");
    vi.stubEnv("ARGUS_ADMIN_SECRET", "");
    vi.stubEnv("EARTHOS_ADMIN_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const result = await requirePrivateApi(req());
    expect(isPrincipalError(result)).toBe(false);
    if (!isPrincipalError(result)) expect(result.role).toBe("anonymous");
  });

  it("requirePrivateApi returns 401 when secrets configured and no auth", async () => {
    vi.stubEnv("ARGUS_API_SECRET", "gate-test-secret-32chars!!!!!");
    vi.stubEnv("NODE_ENV", "production");
    const result = await requirePrivateApi(req());
    expect(isPrincipalError(result)).toBe(true);
    if (isPrincipalError(result)) expect(result.status).toBe(401);
  });

  it("requirePrivateApi accepts admin bearer when secrets configured", async () => {
    vi.stubEnv("ARGUS_API_SECRET", "gate-test-secret-32chars!!!!!");
    vi.stubEnv("NODE_ENV", "production");
    const result = await requirePrivateApi(req("Bearer gate-test-secret-32chars!!!!!"));
    expect(isPrincipalError(result)).toBe(false);
    if (!isPrincipalError(result)) expect(result.role).toBe("admin");
  });

  it("hasApiSecrets reflects env", () => {
    vi.stubEnv("ARGUS_API_SECRET", "");
    vi.stubEnv("ARGUS_ADMIN_SECRET", "");
    expect(hasApiSecrets()).toBe(false);
    vi.stubEnv("ARGUS_API_SECRET", "x");
    expect(hasApiSecrets()).toBe(true);
  });
});
