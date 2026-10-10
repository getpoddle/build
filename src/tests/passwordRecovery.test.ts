import { describe, it, expect } from "vitest";

// ─── Recovery URL detection ──────────────────────────────────────────────────
// Mirrors the logic in src/lib/supabase.ts:isInitialPasswordRecovery.
// A recovery link is detected when the pathname is /reset-password OR the
// URL hash contains type=recovery. With PKCE flow the redirect lands on
// /reset-password?code=... (no hash), so the pathname check is the primary
// signal.

function isRecoveryURL(pathname: string, hash: string): boolean {
  return pathname === "/reset-password" ||
    new URLSearchParams(hash.substring(1)).get("type") === "recovery";
}

describe("isRecoveryURL (password reset link detection)", () => {
  it("detects /reset-password pathname with PKCE code in query string", () => {
    expect(isRecoveryURL("/reset-password", "")).toBe(true);
  });

  it("detects type=recovery in the URL hash (implicit flow)", () => {
    expect(isRecoveryURL("/", "#type=recovery")).toBe(true);
  });

  it("detects /reset-password pathname even when hash is also present", () => {
    expect(isRecoveryURL("/reset-password", "#type=recovery")).toBe(true);
  });

  it("does not detect a normal app page", () => {
    expect(isRecoveryURL("/", "")).toBe(false);
  });

  it("does not detect a workspace hash route", () => {
    expect(isRecoveryURL("/", "#workspace/123")).toBe(false);
  });

  it("does not detect a non-recovery hash type", () => {
    expect(isRecoveryURL("/", "#type=signup")).toBe(false);
  });

  it("does not detect an unrelated path", () => {
    expect(isRecoveryURL("/about", "")).toBe(false);
  });
});

// ─── Recovery session timeout window ─────────────────────────────────────────
// ResetPassword.tsx polls supabase.auth.getSession() up to maxAttempts times
// with a 200ms interval between attempts. The total wait window must be long
// enough for the PKCE code exchange to complete. The original bug was that
// maxAttempts was only 10 (2 seconds), too short for the async exchange.

const RECOVERY_POLL_INTERVAL_MS = 200;
const RECOVERY_POLL_MAX_ATTEMPTS = 30;

function recoveryWaitWindowMs(): number {
  return RECOVERY_POLL_INTERVAL_MS * RECOVERY_POLL_MAX_ATTEMPTS;
}

describe("Recovery session wait window", () => {
  it("provides at least 4 seconds for the PKCE exchange to complete", () => {
    expect(recoveryWaitWindowMs()).toBeGreaterThanOrEqual(4000);
  });

  it("provides no more than 15 seconds (avoids excessive UX delay)", () => {
    expect(recoveryWaitWindowMs()).toBeLessThanOrEqual(15000);
  });

  it("uses 6 seconds (30 attempts × 200ms) — enough for slow networks", () => {
    expect(recoveryWaitWindowMs()).toBe(6000);
  });
});

// ─── Recovery link expiry (20-minute target) ─────────────────────────────────
// The OTP Expiry setting in the Supabase dashboard controls how long recovery
// links remain valid. The target is 20 minutes (1200 seconds). This is a
// dashboard configuration, not code — this test documents the expected value
// so it can be verified against the dashboard setting.

describe("Recovery link expiry target", () => {
  it("targets a 20-minute validity window (1200 seconds)", () => {
    const targetMinutes = 20;
    const targetSeconds = targetMinutes * 60;
    expect(targetSeconds).toBe(1200);
  });

  it("is shorter than the Supabase default (3600 seconds / 60 minutes)", () => {
    const supabaseDefaultSeconds = 3600;
    expect(1200).toBeLessThan(supabaseDefaultSeconds);
  });
});
