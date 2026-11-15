import { describe, expect, it } from 'vitest';
import { approverCountLabel, toggleApproverSelection } from '../lib/approverSelection';

describe('toggleApproverSelection', () => {
  it('adds an unselected approver', () => {
    expect(toggleApproverSelection(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes an already selected approver', () => {
    expect(toggleApproverSelection(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('does not mutate the input', () => {
    const input = ['a'];
    toggleApproverSelection(input, 'b');
    expect(input).toEqual(['a']);
  });
});

describe('approverCountLabel', () => {
  it('shows selected count out of total eligible approvers', () => {
    expect(approverCountLabel(0, 3)).toBe('0 of 3 approvers selected');
    expect(approverCountLabel(2, 3)).toBe('2 of 3 approvers selected');
    expect(approverCountLabel(1, 1)).toBe('1 of 1 approver selected');
  });
});
