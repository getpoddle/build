/**
 * Shared workspace access-control logic.
 * Used by: src/hooks/useWorkspaceAccess.ts (useWorkspaceAccess, useSubscriptionTier, useTrialInfo)
 * Tested by: src/tests/workspaceAccess.test.ts
 *
 * Kept in _shared/ so the same implementation is imported by both the
 * edge-function layer (Deno) and the Vitest test suite (Node), matching
 * the pattern established by quotaLogic / stripeLogic / inviteLogic.
 */

export type WorkspaceRole = 'owner' | 'admin' | 'member' | null;

export interface WorkspaceAccessInput {
  plan?: string | null;
  subscription_status?: string | null;
  seats?: number | null;
  trial_workspace_expires_at?: string | null;
}

export interface AccessState {
  canAccess: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
}

/**
 * Derive access state from a user's role and the workspace row.
 *
 *   canAccess  = the user has any role on the workspace
 *   isOwner    = role is exactly 'owner'
 *   isAdmin    = role is 'owner' or 'admin'
 *   isReadOnly = subscription_status is exactly 'inactive'
 *
 * When the workspace row is null/undefined (not found, fetch failed),
 * canAccess / isOwner / isAdmin are false and isReadOnly is false.
 */
export function deriveAccessState(
  role: WorkspaceRole,
  workspace: WorkspaceAccessInput | null | undefined,
): AccessState {
  return {
    canAccess: !!role,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isReadOnly: workspace?.subscription_status === 'inactive',
  };
}

/**
 * Normalize a raw profile subscription_tier value to the canonical set.
 * Null / undefined / unknown values default to 'free'.
 */
export function resolveSubscriptionTier(
  profileTier: string | null | undefined,
): 'free' | 'pro' | 'enterprise' {
  if (profileTier === 'pro' || profileTier === 'enterprise') return profileTier;
  return 'free';
}

/**
 * Given the stored month string (YYYY-MM from profiles.free_workspace_month)
 * and a reference date, return whether the user has already used their
 * free workspace for the current month.
 *
 * `now` is accepted as a parameter so tests don't need to mock the clock.
 */
export function isMonthlyTrialLimitReached(
  freeWorkspaceMonth: string | null,
  now: Date,
): boolean {
  if (!freeWorkspaceMonth) return false;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return freeWorkspaceMonth === currentMonth;
}
