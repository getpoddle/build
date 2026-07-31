-- Idempotency guard for Stripe webhook processing.
-- Stripe redelivers events; without this table, duplicate deliveries
-- re-run all side effects (duplicate workspace creation, duplicate emails, etc.).
--
-- The primary key on event_id is the race-safe mechanism: two near-simultaneous
-- deliveries cannot both insert — the second fails with a unique violation,
-- which the webhook handler catches and treats as "already processed".

CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- No client-side access — only the service role (webhook handler) reads/writes this.
-- Deny-by-default: no policies means no client access.