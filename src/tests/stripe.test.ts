import { describe, it, expect } from "vitest";
import { verifyStripeSignature, planFromProductId } from "../../supabase/functions/_shared/stripeLogic";

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
  it("maps the enterprise product to enterprise plan with 25 seats", () => {
    expect(planFromProductId("prod_UXcclPSycEN5dN")).toEqual({ plan: "enterprise", seats: 25 });
  });

  it("maps the team product to team plan with 10 seats", () => {
    expect(planFromProductId("prod_UYhkfi8tsa4NJu")).toEqual({ plan: "team", seats: 10 });
  });

  it("maps the pro product to pro plan with 3 seats", () => {
    expect(planFromProductId("prod_UXcbO4NuuJRE5A")).toEqual({ plan: "pro", seats: 3 });
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
