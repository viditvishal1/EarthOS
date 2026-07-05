import { NextRequest } from "next/server";
import { noCacheJson } from "@/lib/http/no-cache";
import { upsertBillingFromStripe } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/** Stripe webhook skeleton (G47) — wire STRIPE_WEBHOOK_SECRET + verify with stripe SDK in production. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return noCacheJson({ error: "invalid json" }, { status: 400 });
  }

  const obj = event.data?.object ?? {};
  const userId = (obj.metadata as { user_id?: string } | undefined)?.user_id;
  if (
    userId
    && (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created")
  ) {
    await upsertBillingFromStripe(userId, {
      stripe_subscription_id: String(obj.id ?? ""),
      plan: "pro",
      status: String(obj.status ?? "active"),
    });
  }

  return noCacheJson({ received: true, configured: Boolean(process.env.STRIPE_WEBHOOK_SECRET) });
}
