import type { Completion } from '@codemirror/autocomplete';
import Fuse from 'fuse.js';

export interface CompletionEntry {
  kind: 'schema' | 'table' | 'view' | 'column';
  schema: string;
  table: string;
  name: string;
  dataType: string;
  keyType: 'pk' | 'fk' | '';
}

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

export type SqlContext =
  | { kind: 'keyword' }
  | { kind: 'table' }
  | { kind: 'column'; fromTables: string[]; isSelectList: boolean };

// Clauses after which a table/view name is expected. Covers SELECT/JOIN, UPDATE,
// and the DDL/DML statements that target a table directly.
const TABLE_CONTEXT_RE =
  /(?:\b(?:FROM|JOIN)\s+(?:\w+\s*,\s*)*|\bUPDATE\s*|\b(?:DROP|ALTER)\s+TABLE\s+(?:\w+\s*,\s*)*|\bTRUNCATE\s+(?:TABLE\s+)?(?:\w+\s*,\s*)*|\bINSERT\s+INTO\s+(?:\w+\s*,\s*)*)$/;

export function detectSqlContext(beforeWord: string, stmtFull: string): SqlContext {
  // Qualified reference: alias.col or schema.table — dispatch on position
  const qualifiedMatch = beforeWord.match(/(\w+)\.\s*$/i);
  if (qualifiedMatch) {
    const upperBefore = beforeWord
      .slice(0, beforeWord.length - qualifiedMatch[0].length)
      .toUpperCase();
    if (TABLE_CONTEXT_RE.test(upperBefore)) {
      return { kind: 'table' };
    }
    const qualifier = qualifiedMatch[1].toLowerCase();
    const resolved = extractAliasMap(stmtFull).get(qualifier) ?? qualifier;
    return { kind: 'column', fromTables: [resolved], isSelectList: false };
  }

  const upper = beforeWord.toUpperCase();
  if (TABLE_CONTEXT_RE.test(upper)) {
    return { kind: 'table' };
  }
  // Strip trailing expression noise (parens, operators, partial operands) after the
  // last clause keyword so "WHERE (col = " is treated the same as "WHERE " by the
  // patterns below. Only fires when a non-space char follows the keyword+space.
  const normalised = upper.replace(/(\b(?:WHERE|HAVING|ON|AND|OR|SET|BY)\s+)\S[\s\S]*$/, '$1');
  const isSelectList = /\bSELECT(?:\s+DISTINCT)?\s+(?:\w+\s*,\s*)*$/.test(upper);
  const isColumnCtx =
    isSelectList ||
    /\b(?:WHERE|HAVING|ON)\s*$/.test(normalised) ||
    /\b(?:AND|OR)\s*$/.test(normalised) ||
    /\b(?:ORDER|GROUP)\s+BY\s+(?:\w+\s*(?:ASC|DESC)?\s*,\s*)*$/.test(normalised) ||
    /\bBY\s+(?:\w+\s*(?:ASC|DESC)?\s*,\s*)*$/.test(normalised) ||
    /\bSET\s*$/.test(normalised) ||
    // Multi-column SET pattern uses upper: "SET a=1, b=" doesn't involve parens
    /\bSET\s+(?:\w+\s*=\s*[^,]+,\s*)+$/.test(upper);
  if (isColumnCtx) {
    return { kind: 'column', fromTables: extractFromTables(stmtFull), isSelectList };
  }
  return { kind: 'keyword' };
}

// Walks `text` and invokes `cb` for each character that is NOT inside a
// string literal ('…' or "…"), a -- line comment, or a /* … */ block comment.
// Returning false from `cb` stops the scan early.
function scanSql(text: string, cb?: (i: number, ch: string) => boolean | undefined): boolean {
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'") {
        if (next === "'") i++;
        else inSingle = false;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') {
        if (next === '"') i++;
        else inDouble = false;
      }
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (cb && cb(i, ch) === false) return inSingle || inDouble;
  }
  return inSingle || inDouble;
}

export function isInsideString(text: string): boolean {
  return scanSql(text);
}

export function isAfterStringClose(text: string): boolean {
  if (!text) return false;
  const last = text[text.length - 1];
  return (last === "'" || last === '"') && !isInsideString(text);
}

export function findStatementBounds(
  text: string,
  pos: number
): { stmtStart: number; stmtEnd: number } {
  let stmtStart = 0;
  let stmtEnd = text.length;
  scanSql(text, (i, ch) => {
    if (ch !== ';') return;
    if (i < pos) {
      stmtStart = i + 1;
    } else {
      stmtEnd = i + 1;
      return false;
    }
  });
  return { stmtStart, stmtEnd };
}

export function innerSubqueryContext(
  beforeWord: string,
  stmtFull: string
): { innerBefore: string; innerFull: string } | null {
  const stack: number[] = [];
  scanSql(beforeWord, (i, ch) => {
    if (ch === '(') stack.push(i);
    else if (ch === ')') stack.pop();
  });
  if (stack.length === 0) return null;
  const lastOpenPos = stack[stack.length - 1];

  // Find the matching `)` in stmtFull starting from the cursor; clip innerFull
  // there so outer-query content past the subquery (e.g. trailing JOINs) does
  // not leak into completion context.
  let depth = stack.length;
  let closePos = stmtFull.length;
  scanSql(stmtFull.slice(beforeWord.length), (i, ch) => {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === stack.length - 1) {
        closePos = beforeWord.length + i;
        return false;
      }
    }
  });

  return {
    innerBefore: beforeWord.slice(lastOpenPos + 1),
    innerFull: stmtFull.slice(lastOpenPos + 1, closePos),
  };
}

export type FuzzyCompletion = Completion & { matchRanges?: readonly number[] };

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
