export interface OwnProfileSensitive {
  subscription_tier: string | null;
  trial_workspace_count: number | null;
  deletion_requested_at: string | null;
  is_admin: boolean;
}

export function parseOwnProfileSensitive(value: unknown): OwnProfileSensitive | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  return {
    subscription_tier: typeof record.subscription_tier === 'string' ? record.subscription_tier : null,
    trial_workspace_count: typeof record.trial_workspace_count === 'number' ? record.trial_workspace_count : null,
    deletion_requested_at: typeof record.deletion_requested_at === 'string' ? record.deletion_requested_at : null,
    is_admin: record.is_admin === true,
  };
}
