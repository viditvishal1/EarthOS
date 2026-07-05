-- Billing subscriptions (G47) — Stripe-ready skeleton
-- Requires: 008_user_auth_rls.sql

create table if not exists billing_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table billing_subscriptions enable row level security;

create policy billing_subscriptions_self on billing_subscriptions
  for select to authenticated
  using (user_id = auth.uid());
