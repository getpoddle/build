/**
 * Tests for the quota decision logic extracted from the ai-agents edge function.
 *
 * The key bug being documented and fixed here:
 *
 *   OLD BEHAVIOR (fail-open bug):
 *     if (upsertErr && count >= LIMIT) → block
 *     if (!upsertErr && count > LIMIT) → block
 *     otherwise                        → ALLOW  ← bug: allows through on error
 *
 *   When the increment RPC fails (upsertErr=true) and count reads as < LIMIT
 *   (e.g. 0 because the row doesn't exist yet), the old code allowed the request.
 *   This means a transient DB error or a crafted failure could bypass the quota.
 *
 *   NEW BEHAVIOR (fail-closed):
 *     if (upsertErr)       → block unconditionally
 *     if (count > LIMIT)   → block
 *     otherwise            → allow
 *
 * The test "blocks when upsert error occurs even if count appears under limit"
 * documents the old bug — it would have failed against the original code.
 */

import { describe, it, expect } from "vitest";
import { shouldBlockQuota } from "../../supabase/functions/_shared/quotaLogic";

const LIMIT = 100;

describe("shouldBlockQuota", () => {
  // ── Normal path (no error) ──────────────────────────────────────────────────

  it("allows when count is well under the limit with no error", () => {
    expect(shouldBlockQuota(50, LIMIT, false)).toBe(false);
  });

  it("allows when count is exactly at the limit with no error (boundary)", () => {
    // Semantics: the limit is "more than LIMIT" — reaching it is still allowed.
    expect(shouldBlockQuota(100, LIMIT, false)).toBe(false);
  });

  it("blocks when count exceeds the limit by one with no error", () => {
    expect(shouldBlockQuota(101, LIMIT, false)).toBe(true);
  });

  it("blocks when count far exceeds the limit with no error", () => {
    expect(shouldBlockQuota(250, LIMIT, false)).toBe(true);
  });

  // ── Error path (fail-closed) ────────────────────────────────────────────────

  it("blocks when upsert error occurs even if count appears under limit (fail-closed)", () => {
    // This is the fail-open bug in the old edge-function code.
    // Old code: upsertErr && count < LIMIT → allowed through. That was wrong.
    expect(shouldBlockQuota(50, LIMIT, true)).toBe(true);
  });

  it("blocks when upsert error occurs and count reads as zero (brand-new user, RPC failed)", () => {
    expect(shouldBlockQuota(0, LIMIT, true)).toBe(true);
  });

  it("blocks when upsert error occurs and count is exactly at the limit", () => {
    expect(shouldBlockQuota(100, LIMIT, true)).toBe(true);
  });

  it("blocks when upsert error occurs and count is over the limit", () => {
    expect(shouldBlockQuota(150, LIMIT, true)).toBe(true);
  });
});
