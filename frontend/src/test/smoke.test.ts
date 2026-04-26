import { describe, it, expect } from 'vitest';
import { T, ENV_COLORS } from '../lib/tokens';

describe('tokens', () => {
  it('exports T with bg as CSS variable reference', () => {
    expect(T.bg).toBe('var(--t-bg)');
  });
  it('prod env color is err (red)', () => {
    expect(ENV_COLORS.prod).toBe(T.err);
  });
});
