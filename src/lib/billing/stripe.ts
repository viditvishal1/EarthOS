export interface BillingStatus {
  plan: string;
  status: string;
  configured: boolean;
  currentPeriodEnd?: string | null;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

async function serviceClient() {
  if (!process.env.SUPABASE_SERVICE_KEY) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return createClient(url, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const db = await serviceClient();
  if (!db) {
    return { plan: "free", status: "inactive", configured: stripeConfigured() };
  }
  const { data } = await db
    .from("billing_subscriptions")
    .select("plan,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    return { plan: "free", status: "inactive", configured: stripeConfigured() };
  }
  return {
    plan: String(data.plan),
    status: String(data.status),
    configured: stripeConfigured(),
    currentPeriodEnd: data.current_period_end ? String(data.current_period_end) : null,
  };
}

export async function upsertBillingFromStripe(
  userId: string,
  patch: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan?: string;
    status?: string;
    current_period_end?: string | null;
  },
): Promise<void> {
  const db = await serviceClient();
  if (!db) return;
  await db.from("billing_subscriptions").upsert({
    user_id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  });
}
