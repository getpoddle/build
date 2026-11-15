export interface ApproverProfile {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}

export function approverNameOrNull(profile: ApproverProfile | null | undefined): string | null {
  if (!profile) return null;
  const full = profile.full_name?.trim();
  if (full) return full;
  const parts = [profile.first_name?.trim(), profile.last_name?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return profile.username?.trim() || null;
}

export function approverDisplayName(profile: ApproverProfile | null | undefined): string {
  return approverNameOrNull(profile) ?? 'Name not provided';
}
