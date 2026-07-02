export type InviteUsableResult =
  | { ok: true }
  | { ok: false; reason: "already_accepted" | "expired" };

export function isInviteUsable(invite: {
  acceptedAt: string | null;
  expiresAt: string;
}): InviteUsableResult {
  if (invite.acceptedAt !== null) {
    return { ok: false, reason: "already_accepted" };
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true };
}

/** Case-insensitive, whitespace-trimmed email comparison. */
export function emailMatchesInvite(
  userEmail: string,
  invitedEmail: string,
): boolean {
  const a = userEmail.toLowerCase().trim();
  const b = invitedEmail.toLowerCase().trim();
  return a.length > 0 && b.length > 0 && a === b;
}

/** Returns true when the workspace still has capacity for one more member. */
export function hasSeatAvailable(
  currentMemberCount: number,
  seatLimit: number,
): boolean {
  return currentMemberCount < seatLimit;
}
