import { describe, expect, it } from 'vitest';
import { ENV_COLORS, T } from '../lib/tokens';
import { fmtDuration } from '../lib/utils';

describe('tokens', () => {
  it('exports T with bg as CSS variable reference', () => {
    expect(T.bg).toBe('var(--t-bg)');
  });
  it('prod env color is err (red)', () => {
    expect(ENV_COLORS.prod).toBe(T.err);
  });
});

describe('utils', () => {
  describe('fmtDuration', () => {
    it('returns ms for values under 1000', () => {
      expect(fmtDuration(0)).toBe('0ms');
      expect(fmtDuration(42)).toBe('42ms');
      expect(fmtDuration(999)).toBe('999ms');
    });
    it('returns seconds for values >= 1000', () => {
      expect(fmtDuration(1000)).toBe('1.0s');
      expect(fmtDuration(2500)).toBe('2.5s');
    });
  });
});
