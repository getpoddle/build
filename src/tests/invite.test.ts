import { describe, it, expect } from "vitest";
import { isInviteUsable, emailMatchesInvite, hasSeatAvailable } from "../../supabase/functions/_shared/inviteLogic";

// ─── isInviteUsable ───────────────────────────────────────────────────────────

describe("isInviteUsable", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString(); // +1 day
  const past = new Date(Date.now() - 86_400_000).toISOString();   // -1 day

  it("returns ok:true for a valid unaccepted non-expired invite", () => {
    expect(isInviteUsable({ acceptedAt: null, expiresAt: future })).toEqual({ ok: true });
  });

  it("returns already_accepted when acceptedAt is set (regardless of expiry)", () => {
    const result = isInviteUsable({ acceptedAt: new Date().toISOString(), expiresAt: future });
    expect(result).toEqual({ ok: false, reason: "already_accepted" });
  });

  it("returns already_accepted even if the invite is also expired", () => {
    const result = isInviteUsable({ acceptedAt: new Date().toISOString(), expiresAt: past });
    expect(result).toEqual({ ok: false, reason: "already_accepted" });
  });

  it("returns expired when expiresAt is in the past and not yet accepted", () => {
    const result = isInviteUsable({ acceptedAt: null, expiresAt: past });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("treats an invite expiring exactly now as expired (boundary: just past)", () => {
    const justPast = new Date(Date.now() - 1).toISOString();
    const result = isInviteUsable({ acceptedAt: null, expiresAt: justPast });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});

// ─── emailMatchesInvite ───────────────────────────────────────────────────────

describe("emailMatchesInvite", () => {
  it("returns true for identical emails", () => {
    expect(emailMatchesInvite("user@example.com", "user@example.com")).toBe(true);
  });

  it("is case-insensitive (user uppercase vs invited lowercase)", () => {
    expect(emailMatchesInvite("User@Example.COM", "user@example.com")).toBe(true);
  });

  it("is case-insensitive (user lowercase vs invited uppercase)", () => {
    expect(emailMatchesInvite("user@example.com", "USER@EXAMPLE.COM")).toBe(true);
  });

  it("trims leading/trailing whitespace from both sides", () => {
    expect(emailMatchesInvite("  user@example.com  ", "user@example.com")).toBe(true);
  });

  it("trims whitespace on both sides simultaneously", () => {
    expect(emailMatchesInvite("  User@Example.COM  ", "  user@example.com  ")).toBe(true);
  });

  it("returns false for a different email", () => {
    expect(emailMatchesInvite("other@example.com", "user@example.com")).toBe(false);
  });

  it("returns false when user email is empty", () => {
    expect(emailMatchesInvite("", "user@example.com")).toBe(false);
  });

  it("returns false when invited email is empty", () => {
    expect(emailMatchesInvite("user@example.com", "")).toBe(false);
  });

  it("returns false when both are empty", () => {
    expect(emailMatchesInvite("", "")).toBe(false);
  });
});

// ─── hasSeatAvailable ────────────────────────────────────────────────────────

describe("hasSeatAvailable", () => {
  it("returns true when workspace is empty (0 of 3)", () => {
    expect(hasSeatAvailable(0, 3)).toBe(true);
  });

  it("returns true when one seat remains (2 of 3)", () => {
    expect(hasSeatAvailable(2, 3)).toBe(true);
  });

  it("returns false when exactly at the seat limit (3 of 3)", () => {
    expect(hasSeatAvailable(3, 3)).toBe(false);
  });

  it("returns false when over the seat limit (4 of 3)", () => {
    expect(hasSeatAvailable(4, 3)).toBe(false);
  });

  it("returns false for a single-seat workspace that is already full (1 of 1)", () => {
    expect(hasSeatAvailable(1, 1)).toBe(false);
  });

  it("returns true for a single-seat workspace with no members yet (0 of 1)", () => {
    expect(hasSeatAvailable(0, 1)).toBe(true);
  });
});
