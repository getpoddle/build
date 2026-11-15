export function toggleApproverSelection(selected: string[], userId: string): string[] {
  return selected.includes(userId)
    ? selected.filter(id => id !== userId)
    : [...selected, userId];
}

export function approverCountLabel(selectedCount: number, totalCount: number): string {
  return `${selectedCount} of ${totalCount} ${totalCount === 1 ? 'approver' : 'approvers'} selected`;
}
