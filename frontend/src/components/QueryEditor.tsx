import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import Fuse from 'fuse.js';
import { Clock, Play, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { T } from '../lib/tokens';

export interface CompletionEntry {
  kind: 'schema' | 'table' | 'view' | 'column';
  schema: string;
  table: string;
  name: string;
  dataType: string;
  keyType: 'pk' | 'fk' | '';
}

interface QueryEditorProps {
  sql: string;
  onChange: (sql: string) => void;
  onRun: (sql: string) => void;
  onSave: () => void;
  loading: boolean;
  completions?: CompletionEntry[];
}

// DataGrip-inspired syntax colors — overrides oneDark via Prec.high.
const snowySqlHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#56B6C2' }, // teal — SELECT, FROM, WHERE …
  { tag: t.name, color: '#D19A66' }, // orange — table / column names
  { tag: t.variableName, color: '#D19A66' },
  { tag: t.propertyName, color: '#D19A66' },
  { tag: t.special(t.name), color: '#E5C07B' }, // gold — function calls
  { tag: t.string, color: '#98C379' }, // green — string literals
  { tag: t.number, color: '#B5CEA8' }, // light green — numbers
  { tag: t.operator, color: '#ABB2BF' },
  { tag: t.punctuation, color: '#ABB2BF' },
  { tag: t.comment, color: '#6A9955', fontStyle: 'italic' },
  { tag: t.typeName, color: '#56B6C2' }, // teal — INT, VARCHAR …
]);

// Static CodeMirror theme matched to SnowyDark tokens.
// Theme-switching via CSS vars inside CodeMirror is unsupported — editor stays dark.
const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', background: '#1f1d1b' },
    '.cm-content': {
      fontFamily: '"Monaco", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
      caretColor: '#ecebe8',
      padding: '8px 0',
    },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-gutters': {
      background: '#1f1d1b',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      color: '#6e6a62',
    },
    '.cm-activeLineGutter': { background: '#252320' },
    '.cm-activeLine': { background: '#252320' },
    '.cm-selectionBackground, ::selection': { background: 'oklch(0.28 0.07 240) !important' },
    '.cm-cursor': { borderLeftColor: '#ecebe8' },
    '.cm-focused .cm-selectionBackground': { background: 'oklch(0.28 0.07 240)' },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      width: '440px',
      background: '#232120',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '6px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      overflow: 'hidden',
      fontFamily: '"Monaco", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace',
      fontSize: '12px',
    },
    '.cm-tooltip-autocomplete > ul': { maxHeight: '240px', fontFamily: 'inherit' },
    '.cm-tooltip-autocomplete > ul > li': {
      padding: '5px 10px',
      color: '#ecebe8',
      borderLeft: '2px solid transparent',
      display: 'flex',
      alignItems: 'center',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      background: 'rgba(53, 116, 240, 0.15)',
      borderLeft: '2px solid oklch(0.62 0.17 240)',
    },
    '.cm-completionLabel': { color: '#ecebe8', flex: '1' },
    '.cm-completionDetail': {
      color: '#6e6a62',
      fontSize: '11px',
      marginLeft: '8px',
      fontStyle: 'normal',
    },
    '.cm-completionIcon': {
      width: '18px',
      marginRight: '4px',
      textAlign: 'center',
      fontSize: '10px',
      color: '#6e6a62',
      opacity: '1',
    },
    '.cm-completionIcon-type': { color: 'oklch(0.62 0.17 240)' },
    '.cm-completionIcon-property': { color: '#e5c07b' },
    '.cm-completionIcon-namespace': { color: '#98c379' },
    '.cm-completionIcon-keyword': { color: '#c678dd' },
    '.cm-key-badge': {
      display: 'inline-block',
      fontSize: '9px',
      fontWeight: '700',
      letterSpacing: '0.02em',
      padding: '1px 4px',
      borderRadius: '3px',
      marginRight: '6px',
      lineHeight: '1.4',
      verticalAlign: 'middle',
    },
    '.cm-key-badge-pk': {
      background: 'rgba(229,192,123,0.15)',
      color: '#e5c07b',
      border: '1px solid rgba(229,192,123,0.3)',
    },
    '.cm-key-badge-fk': {
      background: 'rgba(53,116,240,0.15)',
      color: 'oklch(0.72 0.17 240)',
      border: '1px solid rgba(53,116,240,0.3)',
    },
    '.cm-key-badge-col': {
      background: 'rgba(255,255,255,0.05)',
      color: '#6e6a62',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    '.cm-completionMatchedText': {
      color: '#e5c07b',
      fontWeight: '600',
      textDecoration: 'none',
    },
  },
  { dark: true }
);

const SQL_KEYWORDS = [
  'SELECT',
  'DISTINCT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'NOT',
  'INSERT INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'DELETE FROM',
  'CREATE TABLE',
  'CREATE INDEX',
  'CREATE VIEW',
  'DROP TABLE',
  'DROP INDEX',
  'DROP VIEW',
  'ALTER TABLE',
  'ADD COLUMN',
  'DROP COLUMN',
  'JOIN',
  'INNER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL OUTER JOIN',
  'CROSS JOIN',
  'ON',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'AS',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'RETURNING',
  'WITH',
  'RECURSIVE',
  'TRUE',
  'FALSE',
  'NULL',
  'ASC',
  'DESC',
  'BETWEEN',
  'LIKE',
  'ILIKE',
  'IN',
  'NOT IN',
  'IS NULL',
  'IS NOT NULL',
  'EXISTS',
  'NOT EXISTS',
  'CASE',
  'WHEN',
  'THEN',
  'ELSE',
  'END',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'EXPLAIN',
  'EXPLAIN ANALYZE',
  'TRUNCATE',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'UNIQUE',
  'NOT NULL',
  'DEFAULT',
  'REFERENCES',
  'COALESCE',
  'NULLIF',
  'COUNT',
  'SUM',
  'AVG',
  'MIN',
  'MAX',
];

const keywordOptions: Completion[] = SQL_KEYWORDS.map((kw) => ({
  label: kw,
  type: 'keyword',
  boost: 5,
}));

const starOption: Completion = { label: '*', detail: 'all columns', type: 'keyword', boost: 30 };
const distinctOption: Completion = { label: 'DISTINCT', type: 'keyword', boost: 28 };

export function makeKeyTypeBadge(keyType: 'pk' | 'fk' | ''): HTMLElement {
  const badge = document.createElement('span');
  const variant = keyType === 'pk' ? 'pk' : keyType === 'fk' ? 'fk' : 'col';
  badge.className = `cm-key-badge cm-key-badge-${variant}`;
  badge.textContent = keyType === 'pk' ? 'PK' : keyType === 'fk' ? 'FK' : 'COL';
  return badge;
}

function stripSchema(name: string): string {
  // split('.') on a name containing '.' always has ≥2 parts; fall back to name to satisfy TS
  return name.includes('.') ? (name.split('.').at(-1) ?? name) : name;
}

export function extractFromTables(stmtText: string): string[] {
  const tables: string[] = [];
  const fromMatch = stmtText.match(
    /\bFROM\s+([\w.\s,]+?)(?:\s+(?:WHERE|(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\b|;|$)/i
  );
  if (fromMatch) {
    fromMatch[1].split(',').forEach((part) => {
      const raw = part.trim().split(/\s+/)[0];
      const name = stripSchema(raw);
      if (name && /^\w+$/.test(name)) tables.push(name.toLowerCase());
    });
  }
  const joinRe = /\b(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN\s+([\w.]+)/gi;
  for (const m of stmtText.matchAll(joinRe)) {
    tables.push(stripSchema(m[1]).toLowerCase());
  }
  const updateMatch = stmtText.match(/\bUPDATE\s+([\w.]+)/i);
  if (updateMatch) tables.push(stripSchema(updateMatch[1]).toLowerCase());
  return [...new Set(tables)];
}

const ALIAS_RESERVED = new Set([
  'on',
  'where',
  'set',
  'order',
  'group',
  'having',
  'limit',
  'offset',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'join',
  'and',
  'or',
  'returning',
  'union',
  'intersect',
  'except',
]);

export function extractAliasMap(stmtText: string): Map<string, string> {
  const map = new Map<string, string>();
  const addEntry = (tableName: string, alias?: string) => {
    const t = stripSchema(tableName.toLowerCase());
    map.set(t, t);
    if (alias) {
      const a = alias.toLowerCase();
      if (!ALIAS_RESERVED.has(a)) map.set(a, t);
    }
  };
  const fromMatch = stmtText.match(
    /\bFROM\s+([\w.\s,]+?)(?:\s+(?:WHERE|(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\b|;|$)/i
  );
  if (fromMatch) {
    fromMatch[1].split(',').forEach((part) => {
      const tokens = part.trim().split(/\s+/).filter(Boolean);
      if (!tokens.length) return;
      const aliasToken = tokens[1]?.toLowerCase() === 'as' ? tokens[2] : tokens[1];
      addEntry(tokens[0], aliasToken);
    });
  }
  const joinRe =
    /\b(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN\s+([\w.]+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  for (const m of stmtText.matchAll(joinRe)) {
    addEntry(m[1], m[2]);
  }
  const updateMatch = stmtText.match(/\bUPDATE\s+([\w.]+)(?:\s+(?:AS\s+)?(\w+))?/i);
  if (updateMatch) addEntry(updateMatch[1], updateMatch[2]);
  return map;
}

type SqlContext =
  | { kind: 'keyword' }
  | { kind: 'table' }
  | { kind: 'column'; fromTables: string[]; isSelectList: boolean };

export function detectSqlContext(beforeWord: string, stmtFull: string): SqlContext {
  // Qualified reference: alias.col or schema.table — dispatch on position
  const qualifiedMatch = beforeWord.match(/(\w+)\.\s*$/i);
  if (qualifiedMatch) {
    const upperBefore = beforeWord
      .slice(0, beforeWord.length - qualifiedMatch[0].length)
      .toUpperCase();
    if (
      /\b(?:FROM|JOIN)\s+(?:\w+\s*,\s*)*$/.test(upperBefore) ||
      /\bUPDATE\s*$/.test(upperBefore)
    ) {
      return { kind: 'table' };
    }
    const qualifier = qualifiedMatch[1].toLowerCase();
    const resolved = extractAliasMap(stmtFull).get(qualifier) ?? qualifier;
    return { kind: 'column', fromTables: [resolved], isSelectList: false };
  }

  const upper = beforeWord.toUpperCase();
  if (/\b(?:FROM|JOIN)\s+(?:\w+\s*,\s*)*$/.test(upper) || /\bUPDATE\s*$/.test(upper)) {
    return { kind: 'table' };
  }
  const isSelectList = /\bSELECT(?:\s+DISTINCT)?\s+(?:\w+\s*,\s*)*$/.test(upper);
  const isColumnCtx =
    isSelectList ||
    /\b(?:WHERE|HAVING|ON)\s*$/.test(upper) ||
    /\b(?:AND|OR)\s*$/.test(upper) ||
    /\b(?:ORDER|GROUP)\s+BY\s+(?:\w+\s*(?:ASC|DESC)?\s*,\s*)*$/.test(upper) ||
    /\bBY\s+(?:\w+\s*(?:ASC|DESC)?\s*,\s*)*$/.test(upper) ||
    /\bSET\s*$/.test(upper) ||
    /\bSET\s+(?:\w+\s*=\s*[^,]+,\s*)+$/.test(upper);
  if (isColumnCtx) {
    return { kind: 'column', fromTables: extractFromTables(stmtFull), isSelectList };
  }
  return { kind: 'keyword' };
}

export function isInsideString(text: string): boolean {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) {
      if (text[i + 1] === "'") {
        i++;
      } else {
        inSingle = !inSingle;
      }
    } else if (ch === '"' && !inSingle) {
      if (text[i + 1] === '"') {
        i++;
      } else {
        inDouble = !inDouble;
      }
    }
  }
  return inSingle || inDouble;
}

type FuzzyCompletion = Completion & { matchRanges?: readonly number[] };

export function applyFuzzyMatch(options: Completion[], prefix: string): FuzzyCompletion[] {
  if (!prefix) return options;
  const fuse = new Fuse(options, {
    keys: ['label'],
    threshold: 0.4,
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 1,
  });
  return fuse.search(prefix).map(({ item, score, matches }) => {
    const matchRanges: number[] = [];
    for (const match of matches ?? []) {
      for (const [s, e] of match.indices) {
        matchRanges.push(s, e + 1);
      }
    }
    return {
      ...item,
      boost: (item.boost ?? 0) + Math.round((1 - (score ?? 0)) * 100),
      matchRanges: matchRanges.length > 0 ? matchRanges : undefined,
    };
  });
}

export function buildCompletionOptions(entries: CompletionEntry[], ctx: SqlContext): Completion[] {
  if (ctx.kind === 'table') {
    return entries
      .filter((e) => e.kind === 'table' || e.kind === 'view')
      .map((e) => ({
        label: e.name,
        detail: e.schema,
        type: e.kind === 'table' ? 'type' : 'variable',
        boost: e.kind === 'table' ? 20 : 15,
      }));
  }
  if (ctx.kind === 'column') {
    const lowerTables = ctx.fromTables.length > 0 ? new Set(ctx.fromTables) : null;
    const cols: Completion[] = entries
      .filter(
        (e) =>
          e.kind === 'column' && (lowerTables === null || lowerTables.has(e.table.toLowerCase()))
      )
      .map(
        (e) =>
          ({
            label: e.name,
            detail: e.dataType,
            type: 'property',
            boost: e.keyType === 'pk' ? 15 : e.keyType === 'fk' ? 12 : 10,
            keyType: e.keyType,
          }) as Completion & { keyType: string }
      );
    return ctx.isSelectList ? [starOption, distinctOption, ...cols] : cols;
  }
  return keywordOptions;
}

export function QueryEditor({
  sql: sqlValue,
  onChange,
  onRun,
  onSave,
  loading,
  completions,
}: QueryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isProgrammatic = useRef(false);
  const onRunRef = useRef(onRun);
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const entriesRef = useRef<CompletionEntry[]>(completions ?? []);
  onRunRef.current = onRun;
  onSaveRef.current = onSave;
  onChangeRef.current = onChange;

  useEffect(() => {
    entriesRef.current = completions ?? [];
  }, [completions]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: editor initializes once; callbacks kept fresh via refs
  useEffect(() => {
    if (!containerRef.current) return;

    const runCmd = (view: EditorView) => {
      const sel = view.state.selection.main;
      const content = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
      onRunRef.current(content);
      return true;
    };

    const saveCmd = (_view: EditorView) => {
      onSaveRef.current();
      return true;
    };

    const completionSource = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      const fullText = context.state.doc.toString();
      const stmtStart = fullText.lastIndexOf(';', context.pos - 1) + 1;
      const stmtEndIdx = fullText.indexOf(';', context.pos);
      const stmtFull = fullText.slice(
        stmtStart,
        stmtEndIdx === -1 ? fullText.length : stmtEndIdx + 1
      );
      const beforeWord = fullText.slice(stmtStart, word.from);
      if (isInsideString(beforeWord)) return null;
      const ctx = detectSqlContext(beforeWord, stmtFull);
      if (word.from === word.to && ctx.kind === 'keyword' && !context.explicit) return null;
      const options = applyFuzzyMatch(buildCompletionOptions(entriesRef.current, ctx), word.text);
      if (options.length === 0) return null;
      return {
        from: word.from,
        options,
        filter: false,
        getMatch: (c) => (c as FuzzyCompletion).matchRanges ?? [],
      };
    };

    const state = EditorState.create({
      doc: sqlValue,
      extensions: [
        history(),
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        autocompletion({
          activateOnTyping: true,
          override: [completionSource],
          addToOptions: [
            {
              render(completion: Completion) {
                const kt = (completion as Completion & { keyType?: string }).keyType;
                if (kt === undefined) return null;
                return makeKeyTypeBadge(kt as 'pk' | 'fk' | '');
              },
              position: 25,
            },
          ],
        }),
        sql({ dialect: PostgreSQL }),
        oneDark,
        Prec.high(syntaxHighlighting(snowySqlHighlight)),
        editorTheme,
        Prec.high(keymap.of([{ key: 'Enter', run: insertNewline }])),
        keymap.of([
          { key: 'Mod-Enter', run: runCmd },
          { key: 'Ctrl-Enter', run: runCmd },
          { key: 'Mod-s', run: saveCmd, preventDefault: true },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isProgrammatic.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === sqlValue) return;
    isProgrammatic.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: sqlValue } });
    isProgrammatic.current = false;
  }, [sqlValue]);

  const handleRun = useCallback(() => {
    const view = viewRef.current;
    if (!view) {
      onRun(sqlValue);
      return;
    }
    const sel = view.state.selection?.main;
    const content =
      sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : view.state.doc.toString();
    onRun(content);
  }, [onRun, sqlValue]);

  const handleClear = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
  }, []);

  return (
    <div
      data-testid="query-editor"
      style={{ background: T.panel, borderBottom: `1px solid ${T.border}` }}
      className="flex flex-col h-full"
    >
      {/* Toolbar */}
      <div
        style={{ background: T.chrome, borderBottom: `1px solid ${T.border}` }}
        className="flex items-center h-9 px-2 gap-1 shrink-0"
      >
        <button
          type="button"
          data-testid="run-button"
          onClick={handleRun}
          disabled={loading}
          title="Run (⌘↵)"
          style={{
            background: T.accent,
            color: '#fff',
            fontFamily: T.ui,
            opacity: loading ? 0.4 : 1,
            cursor: loading ? 'default' : 'pointer',
          }}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded border-none"
        >
          <Play size={14} fill="currentColor" />
          Execute
        </button>
        <div style={{ background: T.border }} className="w-px h-4 mx-1" />
        <button
          type="button"
          data-testid="save-button"
          onClick={onSave}
          title="Save (⌘S)"
          style={{ color: T.textSec }}
          className="p-1.5 bg-transparent border-none cursor-pointer flex items-center rounded"
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          data-testid="clear-button"
          onClick={handleClear}
          title="Clear"
          style={{ color: T.textSec }}
          className="p-1.5 bg-transparent border-none cursor-pointer flex items-center rounded"
        >
          <Trash2 size={16} />
        </button>
        <div style={{ background: T.border }} className="w-px h-4 mx-1" />
        <button
          type="button"
          title="History"
          style={{ color: T.textSec }}
          className="p-1.5 bg-transparent border-none cursor-pointer flex items-center rounded"
        >
          <Clock size={16} />
        </button>
        <div
          style={{ color: T.textDim, fontFamily: T.mono }}
          className="ml-auto pr-2 text-[11px] select-none"
        >
          ⌘↵ run · ⌘S save
        </div>
      </div>

      {/* CodeMirror */}
      <div ref={containerRef} className="flex-1 overflow-hidden" data-testid="cm-editor" />
    </div>
  );
}
