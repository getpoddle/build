export function toggleApproverSelection(selected: string[], userId: string): string[] {
  return selected.includes(userId)
    ? selected.filter(id => id !== userId)
    : [...selected, userId];
}

export function approverCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'approver' : 'approvers'} selected`;
}
