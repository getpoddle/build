// Pure functions extracted from the stripe-webhook edge function.
// These have no runtime dependencies so they can be unit tested directly.

export const PRODUCT_TO_PLAN: Record<string, { plan: string; seats: number }> = {
  "prod_UXcclPSycEN5dN": { plan: "enterprise", seats: 25 },
  "prod_UYhkfi8tsa4NJu": { plan: "team", seats: 10 },
  "prod_UXcbO4NuuJRE5A": { plan: "pro", seats: 3 },
};

/** Returns the plan/seat config for a Stripe product ID, or null if unknown. */
export function planFromProductId(productId: string): { plan: string; seats: number } | null {
  return PRODUCT_TO_PLAN[productId] ?? null;
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
