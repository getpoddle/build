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
  it('pluralizes the count', () => {
    expect(approverCountLabel(0)).toBe('0 approvers selected');
    expect(approverCountLabel(1)).toBe('1 approver selected');
    expect(approverCountLabel(2)).toBe('2 approvers selected');
  });
});
