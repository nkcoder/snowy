import { describe, expect, it } from 'vitest';
import { computeDocPatch } from './docPatch';

describe('computeDocPatch', () => {
  it('returns null when the text is unchanged', () => {
    expect(computeDocPatch('SELECT 1;', 'SELECT 1;')).toBeNull();
  });

  it('produces a minimal range for a single-character change in the middle', () => {
    // 'SELECT 1;' -> 'SELECT 2;' differs only at index 7
    expect(computeDocPatch('SELECT 1;', 'SELECT 2;')).toEqual({
      from: 7,
      to: 8,
      insert: '2',
    });
  });

  it('describes an append at the end without touching the prefix', () => {
    expect(computeDocPatch('SELECT', 'SELECT *')).toEqual({
      from: 6,
      to: 6,
      insert: ' *',
    });
  });

  it('describes a deletion at the end', () => {
    expect(computeDocPatch('SELECT *', 'SELECT')).toEqual({
      from: 6,
      to: 8,
      insert: '',
    });
  });

  it('describes an insertion at the start', () => {
    expect(computeDocPatch('users', 'my_users')).toEqual({
      from: 0,
      to: 0,
      insert: 'my_',
    });
  });

  it('replaces only the differing middle span, keeping shared prefix and suffix', () => {
    // 'SELECT * FROM users' -> 'SELECT * FROM accounts'
    // shared prefix 'SELECT * FROM ' (14), shared suffix 's'
    expect(computeDocPatch('SELECT * FROM users', 'SELECT * FROM accounts')).toEqual({
      from: 14,
      to: 18,
      insert: 'account',
    });
  });

  it('handles empty -> text', () => {
    expect(computeDocPatch('', 'abc')).toEqual({ from: 0, to: 0, insert: 'abc' });
  });

  it('handles text -> empty', () => {
    expect(computeDocPatch('abc', '')).toEqual({ from: 0, to: 3, insert: '' });
  });

  it('does not overlap prefix and suffix for a repeated-character shrink', () => {
    // 'aaaa' -> 'aa': from/to must not cross, insert empty
    const patch = computeDocPatch('aaaa', 'aa');
    expect(patch).not.toBeNull();
    expect(patch!.from).toBeLessThanOrEqual(patch!.to);
    expect(patch!.insert).toBe('');
  });
});
