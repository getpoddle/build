/**
 * Shared quota decision logic.
 * Used by: supabase/functions/ai-agents/index.ts
 * Tested by: src/tests/quota.test.ts
 *
 * Kept in _shared/ so the same implementation is imported by both the
 * edge function (Deno) and the Vitest test suite (Node), guaranteeing
 * tests validate the code that actually runs in production.
 */

/**
 * Returns true (block) when the daily quota is exceeded or when the
 * increment RPC returned an error.
 *
 * Errors are treated as blocking (fail-closed): if we cannot confirm the
 * increment succeeded we do not grant the request, preventing quota bypass
 * through transient DB errors.
 */
export function shouldBlockQuota(
  count: number,
  limit: number,
  hadUpsertError: boolean,
): boolean {
  if (hadUpsertError) return true;
  return count > limit;
}
