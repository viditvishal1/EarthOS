import { noCacheJson } from "@/lib/http/no-cache";
import { getBillingStatus } from "@/lib/billing/stripe";
import { sessionUser } from "@/lib/auth/api-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await sessionUser();
  if (!user) {
    return noCacheJson({ plan: "free", status: "inactive", configured: false, note: "Sign in for billing status" });
  }
  const status = await getBillingStatus(user.id);
  return noCacheJson({ ...status });
}
