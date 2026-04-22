import { describe, it, expect } from 'vitest';
import { T, ENV_COLORS } from '../lib/tokens';

describe('tokens', () => {
  it('exports T with bg color', () => {
    expect(T.bg).toBe('#1a1917');
  });
  it('prod env color is err (red)', () => {
    expect(ENV_COLORS.prod).toBe(T.err);
  });
});
