/**
 * Tests for the workspace access-control logic extracted from useWorkspaceAccess.ts.
 *
 * Covers three pure functions:
 *   - deriveAccessState: role → access flags
 *   - resolveSubscriptionTier: raw profile tier → canonical tier
 *   - isMonthlyTrialLimitReached: free-workspace-per-month dedup
 */

import { describe, it, expect } from "vitest";
import {
  deriveAccessState,
  resolveSubscriptionTier,
  isMonthlyTrialLimitReached,
} from "../../supabase/functions/_shared/workspaceAccessLogic";

// ─── deriveAccessState ────────────────────────────────────────────────────────

describe("deriveAccessState", () => {
  it("grants full access for owner role", () => {
    const result = deriveAccessState("owner", { subscription_status: "active" });
    expect(result).toEqual({
      canAccess: true,
      isOwner: true,
      isAdmin: true,
      isReadOnly: false,
    });
  });

  it("grants admin but not owner for admin role", () => {
    const result = deriveAccessState("admin", { subscription_status: "active" });
    expect(result).toEqual({
      canAccess: true,
      isOwner: false,
      isAdmin: true,
      isReadOnly: false,
    });
  });

  it("grants access but not admin for member role", () => {
    const result = deriveAccessState("member", { subscription_status: "active" });
    expect(result).toEqual({
      canAccess: true,
      isOwner: false,
      isAdmin: false,
      isReadOnly: false,
    });
  });

  it("denies all access for null role", () => {
    const result = deriveAccessState(null, { subscription_status: "active" });
    expect(result).toEqual({
      canAccess: false,
      isOwner: false,
      isAdmin: false,
      isReadOnly: false,
    });
  });

  it("sets isReadOnly true only when subscription_status is exactly 'inactive'", () => {
    expect(deriveAccessState("member", { subscription_status: "inactive" }).isReadOnly).toBe(true);
  });

  it("sets isReadOnly false for 'active' status", () => {
    expect(deriveAccessState("member", { subscription_status: "active" }).isReadOnly).toBe(false);
  });

  it("sets isReadOnly false for 'trialing' status", () => {
    expect(deriveAccessState("member", { subscription_status: "trialing" }).isReadOnly).toBe(false);
  });

  it("sets isReadOnly false when subscription_status is null", () => {
    expect(deriveAccessState("member", { subscription_status: null }).isReadOnly).toBe(false);
  });

  it("sets isReadOnly false when subscription_status is undefined", () => {
    expect(deriveAccessState("member", {}).isReadOnly).toBe(false);
  });

  it("returns all-false when workspace is null", () => {
    const result = deriveAccessState("member", null);
    expect(result).toEqual({
      canAccess: true,
      isOwner: false,
      isAdmin: false,
      isReadOnly: false,
    });
  });

  it("returns all-false when workspace is undefined", () => {
    const result = deriveAccessState("member", undefined);
    expect(result).toEqual({
      canAccess: true,
      isOwner: false,
      isAdmin: false,
      isReadOnly: false,
    });
  });

  it("denies access for null role even with inactive subscription", () => {
    const result = deriveAccessState(null, { subscription_status: "inactive" });
    expect(result).toEqual({
      canAccess: false,
      isOwner: false,
      isAdmin: false,
      isReadOnly: true,
    });
  });
});

// ─── resolveSubscriptionTier ──────────────────────────────────────────────────

describe("resolveSubscriptionTier", () => {
  it("passes 'free' through", () => {
    expect(resolveSubscriptionTier("free")).toBe("free");
  });

  it("passes 'pro' through", () => {
    expect(resolveSubscriptionTier("pro")).toBe("pro");
  });

  it("passes 'enterprise' through", () => {
    expect(resolveSubscriptionTier("enterprise")).toBe("enterprise");
  });

  it("defaults to 'free' for null", () => {
    expect(resolveSubscriptionTier(null)).toBe("free");
  });

  it("defaults to 'free' for undefined", () => {
    expect(resolveSubscriptionTier(undefined)).toBe("free");
  });

  it("defaults to 'free' for unknown tier values", () => {
    expect(resolveSubscriptionTier("team")).toBe("free");
    expect(resolveSubscriptionTier("premium")).toBe("free");
    expect(resolveSubscriptionTier("")).toBe("free");
  });
});

// ─── isMonthlyTrialLimitReached ───────────────────────────────────────────────

describe("isMonthlyTrialLimitReached", () => {
  const july2026 = new Date(2026, 6, 15); // month is 0-indexed: 6 = July

  it("returns true when freeWorkspaceMonth matches the current month", () => {
    expect(isMonthlyTrialLimitReached("2026-07", july2026)).toBe(true);
  });

  it("returns false when freeWorkspaceMonth is a different month", () => {
    expect(isMonthlyTrialLimitReached("2026-06", july2026)).toBe(false);
  });

  it("returns false when freeWorkspaceMonth is null", () => {
    expect(isMonthlyTrialLimitReached(null, july2026)).toBe(false);
  });

  it("returns false when freeWorkspaceMonth is an empty string", () => {
    expect(isMonthlyTrialLimitReached("", july2026)).toBe(false);
  });

  it("handles January boundary correctly", () => {
    const jan2027 = new Date(2027, 0, 1);
    expect(isMonthlyTrialLimitReached("2027-01", jan2027)).toBe(true);
    expect(isMonthlyTrialLimitReached("2026-12", jan2027)).toBe(false);
  });

  it("handles December boundary correctly", () => {
    const dec2026 = new Date(2026, 11, 31);
    expect(isMonthlyTrialLimitReached("2026-12", dec2026)).toBe(true);
    expect(isMonthlyTrialLimitReached("2027-01", dec2026)).toBe(false);
  });

  it("pads single-digit months with leading zero", () => {
    const march2026 = new Date(2026, 2, 10);
    expect(isMonthlyTrialLimitReached("2026-03", march2026)).toBe(true);
    expect(isMonthlyTrialLimitReached("2026-3", march2026)).toBe(false);
  });
});
