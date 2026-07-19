/**
 * War Room usage quota — shared plan limits + Stripe overage helper.
 *
 * Used by: workspace-ai-chat (enforcement), workspace-usage (read),
 * workspace-synthesize (must NOT increment — see note), stripe-webhook (reset).
 *
 * The numbers below are LAUNCH ESTIMATES. They should be revisited once real
 * `ai_openai_call` / `ai_openai_call_failed` cost data exists in PostHog — the
 * target is ~75-80% gross margin on Pro. Treat every constant here as a
 * tuning knob, not a permanent spec.
 */

export type WarRoomPlan = "free" | "pro" | "team" | "enterprise";

export interface WarRoomLimit {
  /** Hard cap on sessions per billing period. `null` = uncapped. */
  cap: number | null;
  /** Sessions included in the plan price. Beyond this, overage applies. */
  included: number;
  /** USD charged per overage session (Pro metered billing). 0 = no overage. */
  overageUnitPrice: number;
  /** Whether sessions past the cap hard-block (true) or are just an abuse guard (false). */
  hardBlock: boolean;
}

export const WAR_ROOM_LIMITS: Record<WarRoomPlan, WarRoomLimit> = {
  // Free: one trial War Room session per billing period. Hard block after that.
  free: {
    cap: 1,
    included: 0,
    overageUnitPrice: 0,
    hardBlock: true,
  },
  // Pro: 15 sessions included, then metered overage at $0.50-$1.00/session.
  // LAUNCH ESTIMATE — revisit once real cost data exists; target ~75-80% margin.
  pro: {
    cap: null, // uncapped — overage is metered, not blocked
    included: 15,
    overageUnitPrice: 0.75,
    hardBlock: false,
  },
  // Team: soft abuse guard at 200. Does NOT monetize — allows past the cap.
  team: {
    cap: 200,
    included: 200,
    overageUnitPrice: 0,
    hardBlock: false,
  },
  // Enterprise: effectively uncapped.
  enterprise: {
    cap: null,
    included: 1000000,
    overageUnitPrice: 0,
    hardBlock: false,
  },
};

export function resolveWarRoomLimit(plan: string | null | undefined): WarRoomLimit {
  if (!plan) return WAR_ROOM_LIMITS.free;
  return WAR_ROOM_LIMITS[plan as WarRoomPlan] ?? WAR_ROOM_LIMITS.free;
}

export interface ConsumeResult {
  allowed: boolean;
  session_count: number;
  session_limit: number | null;
  included: number;
  in_overage: boolean;
  overage_count: number;
  period_end: string | null;
}

/**
 * Record a Stripe metered-billing usage event for a Pro overage session.
 *
 * Requires a metered price / usage meter configured on the Pro subscription
 * in the Stripe dashboard — a one-time Stripe-side setup step. Until that
 * meter exists, callers should fall back to the invoice-item path in the
 * `invoice.upcoming` webhook branch (see stripe-webhook).
 *
 * The Stripe Meter Events API requires a subscription *item* ID (`si_...`),
 * not the subscription ID (`sub_...`). This helper resolves the correct item
 * by fetching the subscription and finding the line whose price is metered
 * (price.recurring.usage_type === "metered"). If no metered item is attached,
 * the event is skipped (the invoice-item fallback covers billing).
 *
 * Fail-safe: any error is swallowed and logged; it never blocks the chat turn.
 */
export async function recordProOverageUsage(args: {
  stripeSecretKey: string;
  stripeSubscriptionId: string;
  quantity?: number;
}): Promise<void> {
  const { stripeSecretKey, stripeSubscriptionId, quantity = 1 } = args;
  try {
    // Resolve the metered subscription item ID (si_...) for this subscription.
    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${stripeSubscriptionId}?expand[]=items.data.price.recurring`,
      { headers: { Authorization: `Bearer ${stripeSecretKey}` } },
    );
    if (!subRes.ok) {
      console.error(`Stripe subscription fetch failed (${subRes.status}) for ${stripeSubscriptionId}`);
      return;
    }
    const sub = await subRes.json();
    const meteredItem = (sub.items?.data ?? []).find(
      (it: { price?: { recurring?: { usage_type?: string } } }) =>
        it.price?.recurring?.usage_type === "metered",
    );
    if (!meteredItem?.id) {
      // No metered price attached to this subscription — skip silently.
      // The invoice-item fallback in stripe-webhook handles billing.
      return;
    }

    const res = await fetch("https://api.stripe.com/v1/billing/meter_events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "event_name": "war_room_session",
        "payload[subscription_item]": meteredItem.id,
        "payload[quantity]": String(quantity),
      }).toString(),
    });
    if (!res.ok) {
      console.error(`Stripe meter event failed (${res.status}) for sub item ${meteredItem.id}`);
    }
  } catch (e) {
    console.error("recordProOverageUsage error:", e);
  }
}
