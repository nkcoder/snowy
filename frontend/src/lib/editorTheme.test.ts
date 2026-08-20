import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import type { Tag } from '@lezer/highlight';
import { tags as t } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';
import { buildFunctionDecorations, editorPaneRect, snowySqlHighlight } from './editorTheme';
import { SYNTAX } from './tokens';

function functionNames(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: [sql({ dialect: PostgreSQL })] });
  const decos = buildFunctionDecorations(state, [{ from: 0, to: doc.length }]);
  const names: string[] = [];
  const cursor = decos.iter();
  while (cursor.value) {
    names.push(doc.slice(cursor.from, cursor.to));
    cursor.next();
  }
  return names;
}

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

describe('buildFunctionDecorations', () => {
  it('marks builtin functions (keyword-tokenized) as function calls', () => {
    expect(functionNames('select count(*) from t')).toEqual(['count']);
  });

  it('marks user-defined functions (identifier-tokenized) as function calls', () => {
    expect(functionNames('select add_days(d) from t')).toEqual(['add_days']);
  });

  it('marks multiple calls across a statement', () => {
    expect(functionNames('select count(*), avg(price), my_udf(id) from t')).toEqual([
      'count',
      'avg',
      'my_udf',
    ]);
  });

  it('does not mark clause keywords that take parentheses with a space', () => {
    expect(functionNames('select * from t where id in (1, 2)')).toEqual([]);
  });

  it('does not mark plain identifiers not followed by a paren', () => {
    expect(functionNames('select user_id, account_id from t')).toEqual([]);
  });
});

describe('editorPaneRect', () => {
  it('reports the scroller rect, so tooltips are laid out inside the editor pane', () => {
    const rect = new DOMRect(20, 10, 280, 190);
    expect(editorPaneRect({ scrollDOM: { getBoundingClientRect: () => rect } })).toEqual({
      top: 10,
      left: 20,
      right: 300,
      bottom: 200,
    });
  });
});
