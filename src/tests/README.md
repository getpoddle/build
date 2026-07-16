# Tests

Run with:

```
npm test          # one-shot (CI-friendly)
npm run test:watch  # re-runs on file change
```

## What's covered

| File | What's tested |
|---|---|
| `stripe.test.ts` | `verifyStripeSignature` — accepts valid HMAC, rejects tampered body / wrong secret / malformed header |
| `stripe.test.ts` | `planFromProductId` — every known product ID maps to the correct plan + seat count; unknown IDs return `null` without throwing |
| `quota.test.ts` | `shouldBlockQuota` — allow/block decisions under normal conditions and the **fail-closed fix**: a DB error now blocks the request regardless of the recorded count (the old code was fail-open) |
| `workspaceAccess.test.ts` | `deriveAccessState` — owner / admin / member / null-role access flags; `isReadOnly` true only when `subscription_status` is exactly `'inactive'`; behavior when workspace row is null/undefined |
| `workspaceAccess.test.ts` | `resolveSubscriptionTier` — known tiers (`free`, `pro`, `enterprise`) pass through; null / undefined / unknown values default to `'free'` |
| `workspaceAccess.test.ts` | `isMonthlyTrialLimitReached` — same-month match returns true; different month returns false; null `freeWorkspaceMonth` returns false; January / December boundary cases; single-digit month padding |

## What to test next

1. **Profile visibility / RLS boundary** — the `profiles` table is readable by `authenticated` but fields like `subscription_tier` should not be writable by the client. This needs a database-level test (service-role vs. anon client), not a unit test, so it remains open.
2. **Workspace invite acceptance** — `accept-workspace-invite` edge function: valid token joins user to workspace; expired/invalid token returns 400; already-a-member is idempotent.
3. **Stripe webhook event routing** — `customer.subscription.deleted` sets `subscription_status = "cancelled"` and downgrades the profile tier when no other active workspace remains.
4. **Auth flow** — signup creates a `profiles` row; referral code tracking in `AuthContext` inserts a `referral_signups` row when a valid `ref` param is present.

This suite is a starting foundation, not full coverage.
