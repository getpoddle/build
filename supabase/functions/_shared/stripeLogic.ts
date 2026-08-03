/**
 * Shared Stripe verification and product-mapping logic.
 * Used by: supabase/functions/stripe-webhook/index.ts
 * Tested by: src/tests/stripe.test.ts
 *
 * Kept in _shared/ so the same implementation is imported by both the
 * edge function (Deno) and the Vitest test suite (Node), guaranteeing
 * tests validate the code that actually runs in production.
 */

/**
 * Server-side authoritative product → plan mapping.
 * Plan/seats are NEVER trusted from user-controlled metadata.
 */
export const PRODUCT_TO_PLAN: Record<string, { plan: string; seats: number }> = {
  "prod_UXcbO4NuuJRE5A": { plan: "pro",       seats: 1 },   // Pro Individual — $39/mo
  "prod_UYgnADbpMs1fyz": { plan: "team",      seats: 10 },  // Team Workspace — $249/mo (1–10 seats)
  "prod_UYhkfi8tsa4NJu": { plan: "business",  seats: 100 }, // Business — $999/mo (up to 100 seats)
  "prod_UXcclPSycEN5dN": { plan: "enterprise", seats: 25 }, // Legacy enterprise
};

/** Returns the plan/seat config for a Stripe product ID, or null if unknown. */
export function planFromProductId(productId: string): { plan: string; seats: number } | null {
  return PRODUCT_TO_PLAN[productId] ?? null;
}

/**
 * Returns true when a user's profile should be downgraded to the free tier
 * after a subscription cancellation. Downgrade only happens when the user has
 * no other active workspace subscription remaining.
 */
export function shouldDowngradeToFree(otherActiveWorkspaceCount: number): boolean {
  return otherActiveWorkspaceCount === 0;
}

/**
 * Verifies a Stripe webhook signature.
 * signature is the raw Stripe-Signature header value (e.g. "t=123,v1=abc...").
 * Uses the Web Crypto API — available in both Deno and Node 18+.
 */
export async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !v1) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === v1;
}
