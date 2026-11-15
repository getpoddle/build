export interface ApproverProfile {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export function approverDisplayName(profile: ApproverProfile | null | undefined): string {
  if (!profile) return 'Name not provided';
  const full = profile.full_name?.trim();
  if (full) return full;
  const parts = [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  const username = profile.username?.trim();
  return username || 'Name not provided';
}
