import { describe, it, expect } from 'vitest';
import { approverDisplayName } from '../lib/approverIdentity';

describe('approverDisplayName', () => {
  it('uses a full name when present', () => expect(approverDisplayName({ full_name: ' Ada Lovelace ' })).toBe('Ada Lovelace'));
  it('falls back to first and last names', () => expect(approverDisplayName({ full_name: '', first_name: 'Ada', last_name: 'Lovelace' })).toBe('Ada Lovelace'));
  it('falls back to username', () => expect(approverDisplayName({ username: 'ada' })).toBe('ada'));
  it('does not invent a name', () => expect(approverDisplayName(null)).toBe('Name not provided'));
});
