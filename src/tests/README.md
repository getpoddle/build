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

## What to test next

1. **RLS / workspace membership** — `useWorkspaceAccess` hook logic: owner vs. member vs. non-member access levels. Requires mocking the Supabase client.
2. **Profile visibility** — the `profiles` table is readable by `authenticated` but fields like `subscription_tier` should not be writable by the client. Test the RLS boundary with a service-role client vs. anon client.
3. **Workspace invite acceptance** — `accept-workspace-invite` edge function: valid token joins user to workspace; expired/invalid token returns 400; already-a-member is idempotent.
4. **Stripe webhook event routing** — `customer.subscription.deleted` sets `subscription_status = "cancelled"` and downgrades the profile tier when no other active workspace remains.
5. **Auth flow** — signup creates a `profiles` row; referral code tracking in `AuthContext` inserts a `referral_signups` row when a valid `ref` param is present.

This suite is a starting foundation, not full coverage.
