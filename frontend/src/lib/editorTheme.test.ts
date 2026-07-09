import type { Tag } from '@lezer/highlight';
import { tags as t } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { snowySqlHighlight } from './editorTheme';
import { SYNTAX } from './tokens';

function colorFor(tag: Tag): string | undefined {
  const spec = snowySqlHighlight.specs.find((s) => s.tag === tag);
  return spec?.color;
}

describe('snowySqlHighlight', () => {
  it('sources every highlight colour from a SYNTAX token (no hardcoded hex)', () => {
    const tokenValues = new Set<string>(Object.values(SYNTAX));
    for (const spec of snowySqlHighlight.specs) {
      expect(tokenValues.has(spec.color as string)).toBe(true);
    }
  });

  it('maps keywords to the keyword token', () => {
    expect(colorFor(t.keyword)).toBe(SYNTAX.keyword);
  });

  it('maps identifiers (names) to the identifier token', () => {
    expect(colorFor(t.name)).toBe(SYNTAX.identifier);
  });

  it('maps string literals to the string token', () => {
    expect(colorFor(t.string)).toBe(SYNTAX.string);
  });

  it('maps numbers to the constant token', () => {
    expect(colorFor(t.number)).toBe(SYNTAX.constant);
  });

  it('maps operators and punctuation to the operator token', () => {
    expect(colorFor(t.operator)).toBe(SYNTAX.operator);
    expect(colorFor(t.punctuation)).toBe(SYNTAX.operator);
  });

  it('renders function calls in italics', () => {
    const spec = snowySqlHighlight.specs.find((s) => s.tag === t.special(t.name));
    expect(spec?.fontStyle).toBe('italic');
  });
});
