import { noCacheJson } from "@/lib/http/no-cache";
import { listVariants, DEFAULT_VARIANT_ID } from "@/lib/variants/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  return noCacheJson({
    default: DEFAULT_VARIANT_ID,
    variants: listVariants(),
    fetchedAt: new Date().toISOString(),
  });
}
