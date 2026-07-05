import { cookies } from "next/headers";
import type { VariantId } from "@/lib/variants/types";
import { DEFAULT_VARIANT_ID, getVariant } from "@/lib/variants/registry";

const VALID: Set<string> = new Set(["world", "finance", "tech", "commodity", "energy", "happy"]);

export function parseVariantId(raw: string | null | undefined): VariantId {
  const v = (raw ?? "").toLowerCase().trim();
  if (VALID.has(v)) return v as VariantId;
  return DEFAULT_VARIANT_ID;
}

/** Resolve active variant from query param, cookie, or default (World MVP). */
export async function resolveVariant(searchParams?: { variant?: string }): Promise<VariantId> {
  const fromQuery = searchParams?.variant;
  if (fromQuery && VALID.has(fromQuery.toLowerCase())) {
    return fromQuery.toLowerCase() as VariantId;
  }
  try {
    const jar = await cookies();
    const fromCookie = jar.get("argus_variant")?.value;
    if (fromCookie && VALID.has(fromCookie)) return fromCookie as VariantId;
  } catch {
    /* cookies() unavailable outside request context */
  }
  return DEFAULT_VARIANT_ID;
}

export function variantForHostname(host: string | null): VariantId {
  if (!host) return DEFAULT_VARIANT_ID;
  const h = host.toLowerCase().split(":")[0];
  if (h.startsWith("finance.")) return "finance";
  if (h.startsWith("tech.")) return "tech";
  return DEFAULT_VARIANT_ID;
}

export function activeVariantConfig(id: VariantId) {
  const v = getVariant(id);
  return v.enabled ? v : getVariant(DEFAULT_VARIANT_ID);
}
