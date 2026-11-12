export const ROLE_LABEL: Record<string, string> = {
  owner: 'Workspace Owner',
  admin: 'Workspace Admin',
  member: 'Workspace Member',
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

export function uniqueDisplayNames(entries: Array<{ userId: string; name: string }>): Map<string, string> {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
  return new Map(
    entries.map(entry => [
      entry.userId,
      (counts.get(entry.name) ?? 0) > 1 ? `${entry.name} #${entry.userId.slice(-4)}` : entry.name,
    ]),
  );
}
