/**
 * Tests for the workspace access-control logic extracted from useWorkspaceAccess.ts.
 *
 * Covers three pure functions:
 *   - deriveAccessState: role → access flags
 *   - resolveSubscriptionTier: raw profile tier → canonical tier
 *   - isTrialLimitReached: trial workspace count vs cap (3)
 */

import { describe, it, expect } from "vitest";
import {
  deriveAccessState,
  resolveSubscriptionTier,
  isTrialLimitReached,
  TRIAL_WORKSPACE_LIMIT,
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

  it("passes 'team' through unchanged (real Stripe plan, not collapsed to free)", () => {
    expect(resolveSubscriptionTier("team")).toBe("team");
  });

  it("passes 'business' through unchanged (real Stripe plan, not collapsed to free)", () => {
    expect(resolveSubscriptionTier("business")).toBe("business");
  });

  it("defaults to 'free' for null", () => {
    expect(resolveSubscriptionTier(null)).toBe("free");
  });

  it("defaults to 'free' for undefined", () => {
    expect(resolveSubscriptionTier(undefined)).toBe("free");
  });

  it("defaults to 'free' for unknown/garbage tier values", () => {
    expect(resolveSubscriptionTier("premium")).toBe("free");
    expect(resolveSubscriptionTier("")).toBe("free");
    expect(resolveSubscriptionTier("invalid-tier")).toBe("free");
  });
});

// ─── isTrialLimitReached ─────────────────────────────────────────────────────

describe("isTrialLimitReached", () => {
  const anyDate = new Date(2026, 6, 15);

  it("returns false when count is below the limit", () => {
    expect(isTrialLimitReached(0, anyDate)).toBe(false);
    expect(isTrialLimitReached(1, anyDate)).toBe(false);
    expect(isTrialLimitReached(2, anyDate)).toBe(false);
  });

  it("returns true when count equals the limit", () => {
    expect(isTrialLimitReached(3, anyDate)).toBe(true);
  });

  it("returns true when count exceeds the limit", () => {
    expect(isTrialLimitReached(4, anyDate)).toBe(true);
    expect(isTrialLimitReached(10, anyDate)).toBe(true);
  });

  it("returns false when count is null", () => {
    expect(isTrialLimitReached(null, anyDate)).toBe(false);
  });

  it("TRIAL_WORKSPACE_LIMIT is 3", () => {
    expect(TRIAL_WORKSPACE_LIMIT).toBe(3);
  });
});
