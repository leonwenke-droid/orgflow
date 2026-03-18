-- Stripe billing fields on organizations

alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists plan text default 'free';

create index if not exists idx_orgs_stripe_customer_id on public.organizations(stripe_customer_id);
create index if not exists idx_orgs_stripe_subscription_id on public.organizations(stripe_subscription_id);

