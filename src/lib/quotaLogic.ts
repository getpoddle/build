// Pure decision function extracted from checkAndIncrementQuota in ai-agents edge function.
// Takes the observable state and returns whether the request should be blocked.

/**
 * Returns true (block) when the quota is exceeded or when the increment RPC
 * returned an error. Errors are treated as blocking (fail-closed) — if we
 * cannot confirm the increment succeeded, we do not grant the request.
 *
 * The old edge-function code had a fail-open bug: when hadUpsertError was true
 * but count appeared to be under the limit, it allowed the request through.
 * This function fixes that: any upsert error is an unconditional block.
 */
export function shouldBlockQuota(
  count: number,
  limit: number,
  hadUpsertError: boolean,
): boolean {
  if (hadUpsertError) return true;
  return count > limit;
}
