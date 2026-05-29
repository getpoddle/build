interface ProfileData {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export function getDisplayName(profile: ProfileData | null | undefined): string {
  if (!profile) return 'Anonymous';

  if (profile.full_name && profile.full_name.trim()) {
    return profile.full_name.trim();
  }

  const firstName = profile.first_name?.trim() || '';
  const lastName = profile.last_name?.trim() || '';

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  if (firstName) return firstName;
  if (lastName) return lastName;

  return 'Anonymous';
}
