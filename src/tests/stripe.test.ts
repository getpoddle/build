import { describe, it, expect } from "vitest";
import { verifyStripeSignature, planFromProductId, shouldDowngradeToFree } from "../../supabase/functions/_shared/stripeLogic";

// Helper: compute a valid Stripe-style HMAC-SHA256 signature header.
async function buildSignatureHeader(body: string, secret: string, timestamp: string): Promise<string> {
  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

// ─── verifyStripeSignature ────────────────────────────────────────────────────

describe("verifyStripeSignature", () => {
  const SECRET = "whsec_test_abc123";
  const BODY = '{"type":"checkout.session.completed","id":"evt_test"}';
  const TIMESTAMP = "1700000000";

  it("accepts a correctly signed payload", async () => {
    const header = await buildSignatureHeader(BODY, SECRET, TIMESTAMP);
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(true);
  });

  it("rejects a payload where the body was tampered after signing", async () => {
    const header = await buildSignatureHeader(BODY, SECRET, TIMESTAMP);
    const tampered = BODY.replace("checkout.session.completed", "customer.subscription.deleted");
    expect(await verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const header = await buildSignatureHeader(BODY, "wrong_secret", TIMESTAMP);
    expect(await verifyStripeSignature(BODY, header, SECRET)).toBe(false);
  });

  it("rejects an empty signature header", async () => {
    expect(await verifyStripeSignature(BODY, "", SECRET)).toBe(false);
  });

  it("rejects a signature header with no v1 component", async () => {
    expect(await verifyStripeSignature(BODY, `t=${TIMESTAMP}`, SECRET)).toBe(false);
  });

  it("rejects a signature header with no timestamp component", async () => {
    const header = await buildSignatureHeader(BODY, SECRET, TIMESTAMP);
    const withoutTimestamp = header.replace(`t=${TIMESTAMP},`, "");
    expect(await verifyStripeSignature(BODY, withoutTimestamp, SECRET)).toBe(false);
  });
});

// ─── planFromProductId ────────────────────────────────────────────────────────

describe("planFromProductId", () => {
  // Legacy product IDs (kept for existing subscribers on old pricing)
  it("maps the legacy enterprise product to enterprise plan with 25 seats", () => {
    expect(planFromProductId("prod_UXcclPSycEN5dN")).toEqual({ plan: "enterprise", seats: 25 });
  });

  it("maps the legacy team product to team plan with 10 seats", () => {
    expect(planFromProductId("prod_UYhkfi8tsa4NJu")).toEqual({ plan: "team", seats: 10 });
  });

  it("maps the legacy pro product to pro plan with 3 seats", () => {
    expect(planFromProductId("prod_UXcbO4NuuJRE5A")).toEqual({ plan: "pro", seats: 3 });
  });

  // New 5-tier product IDs
  it("maps the new pro product to pro plan with 1 seat", () => {
    expect(planFromProductId("prod_NEW_PRO")).toEqual({ plan: "pro", seats: 1 });
  });

  it("maps the new team product to team plan with 10 seats", () => {
    expect(planFromProductId("prod_NEW_TEAM")).toEqual({ plan: "team", seats: 10 });
  });

  it("maps the new business product to business plan with 25 seats", () => {
    expect(planFromProductId("prod_NEW_BUSINESS")).toEqual({ plan: "business", seats: 25 });
  });

  it("maps the new enterprise product to enterprise plan with 200 seats", () => {
    expect(planFromProductId("prod_NEW_ENTERPRISE")).toEqual({ plan: "enterprise", seats: 200 });
  });

  it("returns null for an unknown product ID (does not throw)", () => {
    expect(planFromProductId("prod_UNKNOWN_XYZ")).toBeNull();
  });

  it("returns null for an empty string (does not throw)", () => {
    expect(planFromProductId("")).toBeNull();
  });

  it("is case-sensitive — a lowercase variant does not match", () => {
    expect(planFromProductId("prod_uxcbO4NuuJRE5A")).toBeNull();
  });
});

// ─── shouldDowngradeToFree ────────────────────────────────────────────────────

describe("shouldDowngradeToFree", () => {
  it("returns true when the user has zero other active workspaces", () => {
    expect(shouldDowngradeToFree(0)).toBe(true);
  });

  it("returns false when the user has one other active workspace", () => {
    expect(shouldDowngradeToFree(1)).toBe(false);
  });

  it("returns false when the user has multiple other active workspaces", () => {
    expect(shouldDowngradeToFree(3)).toBe(false);
  });
});
