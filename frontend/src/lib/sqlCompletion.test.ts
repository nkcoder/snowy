import { describe, expect, it } from 'vitest';
import {
  applyFuzzyMatch,
  buildCompletionOptions,
  type CompletionEntry,
  detectSqlContext,
  extractAliasMap,
  extractFromTables,
  findStatementBounds,
  innerSubqueryContext,
  isAfterStringClose,
  isInsideComment,
  isInsideString,
  makeKeyTypeBadge,
  type SqlContext,
} from './sqlCompletion';

describe('makeKeyTypeBadge', () => {
  it('renders PK badge with amber styling', () => {
    const badge = makeKeyTypeBadge('pk');
    expect(badge.textContent).toBe('PK');
    expect(badge.className).toContain('cm-key-badge-pk');
  });

  it('renders FK badge with accent blue styling', () => {
    const badge = makeKeyTypeBadge('fk');
    expect(badge.textContent).toBe('FK');
    expect(badge.className).toContain('cm-key-badge-fk');
  });

  it('renders COL badge for regular columns', () => {
    const badge = makeKeyTypeBadge('');
    expect(badge.textContent).toBe('COL');
    expect(badge.className).toContain('cm-key-badge-col');
  });
});

describe('extractFromTables', () => {
  it('extracts single FROM table', () => {
    expect(extractFromTables('SELECT * FROM users WHERE id = 1')).toEqual(['users']);
  });

  it('extracts multiple comma-separated FROM tables', () => {
    const tables = extractFromTables('SELECT * FROM users, accounts WHERE id = 1');
    expect(tables).toContain('users');
    expect(tables).toContain('accounts');
  });

  it('extracts JOIN tables', () => {
    const tables = extractFromTables(
      'SELECT * FROM users LEFT JOIN accounts ON users.id = accounts.user_id'
    );
    expect(tables).toContain('users');
    expect(tables).toContain('accounts');
  });

  it('extracts UPDATE target', () => {
    expect(extractFromTables('UPDATE users SET name = ')).toContain('users');
  });

  it('returns empty array when no FROM clause', () => {
    expect(extractFromTables('SELECT 1')).toEqual([]);
  });

  it('handles aliases — extracts table name not alias', () => {
    const tables = extractFromTables('SELECT * FROM users u WHERE u.id = 1');
    expect(tables).toContain('users');
    expect(tables).not.toContain('u');
  });

  it('strips schema prefix from single schema-qualified table', () => {
    expect(extractFromTables('SELECT * FROM public.users WHERE id = 1')).toEqual(['users']);
  });

  it('strips schema prefix from comma-separated schema-qualified tables', () => {
    const tables = extractFromTables('SELECT * FROM public.users, public.orders WHERE id = 1');
    expect(tables).toContain('users');
    expect(tables).toContain('orders');
    expect(tables).not.toContain('public');
  });

  it('strips schema prefix from schema-qualified JOIN', () => {
    const tables = extractFromTables(
      'SELECT * FROM public.orders LEFT JOIN public.users ON orders.user_id = users.id'
    );
    expect(tables).toContain('orders');
    expect(tables).toContain('users');
    expect(tables).not.toContain('public');
  });

  it('strips schema prefix from schema-qualified UPDATE target', () => {
    const tables = extractFromTables("UPDATE public.users SET name = ''");
    expect(tables).toContain('users');
    expect(tables).not.toContain('public');
  });

  it('strips schema prefix from schema-qualified table with alias', () => {
    const tables = extractFromTables('SELECT * FROM public.users u WHERE u.id = 1');
    expect(tables).toContain('users');
    expect(tables).not.toContain('public');
    expect(tables).not.toContain('u');
  });

  it('handles mixed qualified and unqualified tables in the same query', () => {
    const tables = extractFromTables(
      'SELECT * FROM users JOIN public.orders o ON users.id = o.user_id WHERE'
    );
    expect(tables).toContain('users');
    expect(tables).toContain('orders');
    expect(tables).not.toContain('public');
    expect(tables).not.toContain('o');
  });

  it('ignores a JOIN token that appears inside a string literal', () => {
    const tables = extractFromTables("SELECT * FROM users WHERE note = 'JOIN phantom' AND id = 1");
    expect(tables).toEqual(['users']);
    expect(tables).not.toContain('phantom');
  });

  it('ignores a FROM/JOIN token that appears inside a comment', () => {
    const tables = extractFromTables('SELECT * FROM users /* JOIN phantom */ WHERE id = 1');
    expect(tables).toEqual(['users']);
    expect(tables).not.toContain('phantom');
  });
});

describe('detectSqlContext', () => {
  it('returns keyword context at start of statement', () => {
    expect(detectSqlContext('', '')).toEqual({ kind: 'keyword' });
  });

  it('returns table context after FROM', () => {
    expect(detectSqlContext('SELECT * FROM ', 'SELECT * FROM ')).toEqual({ kind: 'table' });
  });

  it('returns table context after FROM with partial table list', () => {
    expect(detectSqlContext('SELECT * FROM users, ', 'SELECT * FROM users, ')).toEqual({
      kind: 'table',
    });
  });

  it('returns table context after JOIN', () => {
    expect(detectSqlContext('SELECT * FROM users JOIN ', 'SELECT * FROM users JOIN ')).toEqual({
      kind: 'table',
    });
  });

  it('returns table context after UPDATE', () => {
    expect(detectSqlContext('UPDATE ', 'UPDATE ')).toEqual({ kind: 'table' });
  });

  it('returns keyword context after FROM tablename (space, no comma)', () => {
    expect(detectSqlContext('SELECT * FROM users ', 'SELECT * FROM users ')).toEqual({
      kind: 'keyword',
    });
  });

  it('returns table context after DROP TABLE', () => {
    expect(detectSqlContext('DROP TABLE ', 'DROP TABLE ')).toEqual({ kind: 'table' });
  });

  it('returns table context after ALTER TABLE', () => {
    expect(detectSqlContext('ALTER TABLE ', 'ALTER TABLE ')).toEqual({ kind: 'table' });
  });

  it('returns table context after TRUNCATE', () => {
    expect(detectSqlContext('TRUNCATE ', 'TRUNCATE ')).toEqual({ kind: 'table' });
  });

  it('returns table context after TRUNCATE TABLE', () => {
    expect(detectSqlContext('TRUNCATE TABLE ', 'TRUNCATE TABLE ')).toEqual({ kind: 'table' });
  });

  it('returns table context after INSERT INTO', () => {
    expect(detectSqlContext('INSERT INTO ', 'INSERT INTO ')).toEqual({ kind: 'table' });
  });

  it('returns table context after DROP TABLE schema-qualified prefix', () => {
    expect(detectSqlContext('DROP TABLE public.', 'DROP TABLE public.')).toEqual({
      kind: 'table',
    });
  });

  it('returns column context after WHERE', () => {
    const ctx = detectSqlContext('SELECT * FROM users WHERE ', 'SELECT * FROM users WHERE ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toContain('users');
    }
  });

  it('returns column context after AND', () => {
    const ctx = detectSqlContext(
      'SELECT * FROM users WHERE id = 1 AND ',
      'SELECT * FROM users WHERE id = 1 AND '
    );
    expect(ctx.kind).toBe('column');
  });

  it('returns column context after OR', () => {
    const ctx = detectSqlContext(
      'SELECT * FROM users WHERE id = 1 OR ',
      'SELECT * FROM users WHERE id = 1 OR '
    );
    expect(ctx.kind).toBe('column');
  });

  it('returns column context after ORDER BY', () => {
    const ctx = detectSqlContext('SELECT * FROM users ORDER BY ', 'SELECT * FROM users ORDER BY ');
    expect(ctx.kind).toBe('column');
  });

  it('returns column context after GROUP BY', () => {
    const ctx = detectSqlContext('SELECT * FROM users GROUP BY ', 'SELECT * FROM users GROUP BY ');
    expect(ctx.kind).toBe('column');
  });

  it('returns column context after HAVING', () => {
    const ctx = detectSqlContext('SELECT id FROM users HAVING ', 'SELECT id FROM users HAVING ');
    expect(ctx.kind).toBe('column');
  });

  it('returns column context with isSelectList after SELECT', () => {
    const ctx = detectSqlContext('SELECT ', 'SELECT ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.isSelectList).toBe(true);
  });

  it('marks SELECT column list correctly', () => {
    const ctx = detectSqlContext('SELECT id, ', 'SELECT id, ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.isSelectList).toBe(true);
  });

  it('resolves FROM tables when cursor is in SELECT list before FROM clause', () => {
    // Cursor is after "sku," — FROM clause appears later in the statement
    const beforeWord = 'SELECT product_id, sku,\n';
    const stmtFull = 'SELECT product_id, sku,\nFROM products\nORDER BY created_at\nLIMIT 10';
    const ctx = detectSqlContext(beforeWord, stmtFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toEqual(['products']);
      expect(ctx.isSelectList).toBe(true);
    }
  });

  it('returns keyword context after fr (partial keyword)', () => {
    // "fr" is the partial word — beforeWord is empty
    expect(detectSqlContext('', 'fr')).toEqual({ kind: 'keyword' });
  });

  it('returns column context for alias.col pattern', () => {
    const stmtFull = 'SELECT p. FROM products p ORDER BY created_at LIMIT 10';
    const ctx = detectSqlContext('SELECT p.', stmtFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toEqual(['products']);
      expect(ctx.isSelectList).toBe(false);
    }
  });

  it('resolves alias to table name in qualified column reference', () => {
    const stmtFull = 'SELECT o.amount FROM orders o WHERE o.';
    const ctx = detectSqlContext('SELECT o.amount FROM orders o WHERE o.', stmtFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toEqual(['orders']);
  });

  it('does not treat FROM schema. as a qualified column context', () => {
    const ctx = detectSqlContext('SELECT * FROM public.', 'SELECT * FROM public.');
    expect(ctx.kind).toBe('table');
  });

  it('returns column context after WHERE with opening parenthesis', () => {
    const stmt = 'SELECT * FROM users WHERE (';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after WHERE (col = ', () => {
    const stmt = 'SELECT * FROM users WHERE (id = ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after WHERE (col IS NULL OR col = ', () => {
    const stmt = 'SELECT * FROM users WHERE (id IS NULL OR id = ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after WHERE with deeply nested parens', () => {
    const stmt = 'SELECT * FROM users WHERE ((id = ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after AND with opening parenthesis', () => {
    const stmt = 'SELECT * FROM users WHERE id = 1 AND (status = ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after HAVING with opening parenthesis', () => {
    const stmt = 'SELECT id FROM users GROUP BY id HAVING (COUNT(*) > ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('returns column context after ORDER BY with opening parenthesis', () => {
    const stmt = 'SELECT * FROM users ORDER BY (id ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  // Once a clause's sub-expression is complete, the next clause keyword — not
  // another column — is expected, so the context switches back to 'keyword'.
  it('returns keyword context after a complete WHERE predicate', () => {
    const stmt = 'SELECT * FROM users WHERE user_id = 1 ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a bare column in WHERE (expects an operator/keyword)', () => {
    const stmt = 'SELECT * FROM users WHERE user_id ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a complete GROUP BY column', () => {
    const stmt = 'SELECT * FROM users GROUP BY user_id ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a complete ORDER BY column', () => {
    const stmt = 'SELECT * FROM users ORDER BY user_id ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after ORDER BY column with direction', () => {
    const stmt = 'SELECT * FROM users ORDER BY user_id DESC ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a complete HAVING predicate', () => {
    const stmt = 'SELECT id FROM users GROUP BY id HAVING count(*) > 5 ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('still returns column context right after an operator in WHERE', () => {
    const stmt = 'SELECT * FROM users WHERE user_id = ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
  });

  it('still returns column context after a comma in GROUP BY list', () => {
    const stmt = 'SELECT * FROM users GROUP BY user_id, ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
  });

  // A LIKE pattern (or any string literal) may contain an unbalanced paren; it
  // must not be counted as real expression structure — the predicate is
  // complete, so a keyword is expected next.
  it('returns keyword context after a LIKE pattern with a paren in the string', () => {
    const stmt = "SELECT * FROM users WHERE name LIKE '%(%' ";
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a string literal containing an unbalanced open paren', () => {
    const stmt = "SELECT * FROM users WHERE note = 'see (ref' ";
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('returns keyword context after a complete predicate followed by a block comment', () => {
    const stmt = 'SELECT * FROM users WHERE user_id = 1 /* note */ ';
    expect(detectSqlContext(stmt, stmt)).toEqual({ kind: 'keyword' });
  });

  it('still returns column context when a comment sits between an operator and the cursor', () => {
    const stmt = 'SELECT * FROM users WHERE user_id = /* pick one */ ';
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
  });
});

describe('extractAliasMap', () => {
  it('maps table name to itself when no alias', () => {
    const m = extractAliasMap('SELECT * FROM products ORDER BY id');
    expect(m.get('products')).toBe('products');
  });

  it('maps alias to table name', () => {
    const m = extractAliasMap('SELECT p.id FROM products p ORDER BY p.id');
    expect(m.get('p')).toBe('products');
    expect(m.get('products')).toBe('products');
  });

  it('handles AS keyword in alias', () => {
    const m = extractAliasMap('SELECT p.id FROM products AS p');
    expect(m.get('p')).toBe('products');
  });

  it('handles multiple tables with aliases', () => {
    const m = extractAliasMap('SELECT p.id, o.amount FROM products p, orders o');
    expect(m.get('p')).toBe('products');
    expect(m.get('o')).toBe('orders');
  });

  it('handles JOIN aliases', () => {
    const m = extractAliasMap('SELECT p.id FROM products p JOIN orders o ON p.id = o.product_id');
    expect(m.get('p')).toBe('products');
    expect(m.get('o')).toBe('orders');
  });

  it('does not map ON as an alias', () => {
    const m = extractAliasMap(
      'SELECT * FROM orders JOIN products ON orders.product_id = products.id'
    );
    expect(m.has('on')).toBe(false);
  });

  it('maps schema-qualified table to bare name with alias', () => {
    const m = extractAliasMap('SELECT u.id FROM public.users u WHERE u.id = 1');
    expect(m.get('u')).toBe('users');
    expect(m.get('users')).toBe('users');
    expect(m.has('public')).toBe(false);
  });

  it('maps schema-qualified table with AS alias', () => {
    const m = extractAliasMap('SELECT u.id FROM public.users AS u');
    expect(m.get('u')).toBe('users');
  });

  it('ignores a FROM token inside a string literal', () => {
    const m = extractAliasMap("SELECT * FROM users u WHERE note = 'FROM orders o'");
    expect(m.get('u')).toBe('users');
    expect(m.has('orders')).toBe(false);
    expect(m.has('o')).toBe(false);
  });
});

// Shared fixture data used by ranking tests
const sampleEntries: CompletionEntry[] = [
  { kind: 'table', schema: 'public', table: '', name: 'accounts', dataType: '', keyType: '' },
  { kind: 'table', schema: 'public', table: '', name: 'users', dataType: '', keyType: '' },
  { kind: 'view', schema: 'public', table: '', name: 'active_users', dataType: '', keyType: '' },
  { kind: 'column', schema: 'public', table: 'users', name: 'id', dataType: 'int4', keyType: 'pk' },
  {
    kind: 'column',
    schema: 'public',
    table: 'users',
    name: 'email',
    dataType: 'text',
    keyType: 'fk',
  },
  { kind: 'column', schema: 'public', table: 'users', name: 'name', dataType: 'text', keyType: '' },
];

describe('buildCompletionOptions — ranking', () => {
  it('table context returns only tables/views, no keywords', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'table' });
    const labels = opts.map((o) => o.label);
    expect(labels).toContain('accounts');
    expect(labels).toContain('active_users');
    expect(labels).not.toContain('SELECT');
  });

  it('table context gives tables boost 20 and views boost 15', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'table' });
    const table = opts.find((o) => o.label === 'accounts');
    const view = opts.find((o) => o.label === 'active_users');
    expect(table?.boost).toBe(20);
    expect(view?.boost).toBe(15);
  });

  it('keyword context returns keywords, no tables', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'keyword' });
    const labels = opts.map((o) => o.label);
    expect(labels).toContain('SELECT');
    expect(labels).not.toContain('accounts');
  });

  it('PK column ranks above FK and plain column', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column',
      fromTables: ['users'],
      isSelectList: false,
    });
    const pk = opts.find((o) => o.label === 'id');
    const fk = opts.find((o) => o.label === 'email');
    const plain = opts.find((o) => o.label === 'name');
    expect(pk?.boost).toBeGreaterThan(fk?.boost ?? 0);
    expect(fk?.boost).toBeGreaterThan(plain?.boost ?? 0);
  });

  it('star option is present in SELECT column list context', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column',
      fromTables: ['users'],
      isSelectList: true,
    });
    expect(opts[0].label).toBe('*');
  });

  it('star option is absent in non-SELECT column context', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column',
      fromTables: ['users'],
      isSelectList: false,
    });
    expect(opts.map((o) => o.label)).not.toContain('*');
  });

  it('column context with no fromTables returns all columns', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column',
      fromTables: [],
      isSelectList: false,
    });
    expect(opts.map((o) => o.label)).toContain('id');
    expect(opts.map((o) => o.label)).toContain('email');
  });

  it('schema-qualified FROM only shows columns from that table — no bleed', () => {
    const entries: CompletionEntry[] = [
      ...sampleEntries,
      {
        kind: 'column',
        schema: 'public',
        table: 'orders',
        name: 'total',
        dataType: 'numeric',
        keyType: '',
      },
      {
        kind: 'column',
        schema: 'public',
        table: 'orders',
        name: 'placed_at',
        dataType: 'timestamptz',
        keyType: '',
      },
    ];
    const stmt = 'SELECT * FROM public.users WHERE ';
    const fromTables = extractFromTables(stmt);
    const ctx = detectSqlContext(stmt, stmt);
    expect(ctx.kind).toBe('column');
    if (ctx.kind !== 'column') return;
    const opts = buildCompletionOptions(entries, { ...ctx, fromTables });
    const labels = opts.map((o) => o.label);
    expect(labels).toContain('id');
    expect(labels).toContain('email');
    expect(labels).not.toContain('total');
    expect(labels).not.toContain('placed_at');
  });
});

describe('applyFuzzyMatch', () => {
  const base = [
    { label: 'accounts', boost: 20 },
    { label: 'active_users', boost: 15 },
    { label: 'users', boost: 20 },
  ];

  it('returns options unchanged when prefix is empty', () => {
    const result = applyFuzzyMatch(base, '');
    expect(result).toEqual(base);
  });

  it('includes prefix matches and boosts them', () => {
    const result = applyFuzzyMatch(base, 'acc');
    const match = result.find((o) => o.label === 'accounts');
    expect(match).toBeDefined();
    expect(match!.boost).toBeGreaterThan(20);
  });

  it('is case-insensitive', () => {
    const result = applyFuzzyMatch(base, 'ACC');
    expect(result.find((o) => o.label === 'accounts')).toBeDefined();
  });

  it('finds mid-string fuzzy matches (contains)', () => {
    const opts = [{ label: 'account_id', boost: 10 }];
    const result = applyFuzzyMatch(opts, 'coun');
    expect(result.find((o) => o.label === 'account_id')).toBeDefined();
  });

  it('excludes options with no fuzzy match', () => {
    const result = applyFuzzyMatch(base, 'xyz');
    expect(result).toHaveLength(0);
  });

  it('prefix match scores higher than mid-string match', () => {
    const opts = [
      { label: 'account_id', boost: 10 },
      { label: 'count', boost: 10 },
    ];
    const result = applyFuzzyMatch(opts, 'coun');
    const countMatch = result.find((o) => o.label === 'count');
    const accountMatch = result.find((o) => o.label === 'account_id');
    expect(countMatch).toBeDefined();
    expect(accountMatch).toBeDefined();
    expect(countMatch!.boost).toBeGreaterThan(accountMatch!.boost!);
  });

  it('attaches matchRanges for matched results', () => {
    const opts = [{ label: 'account_id', boost: 10 }];
    const result = applyFuzzyMatch(opts, 'coun');
    expect(result[0].matchRanges).toBeDefined();
    expect(result[0].matchRanges!.length).toBeGreaterThan(0);
  });

  // Subsequence + word-boundary matching, the way DataGrip/VS Code behave.
  const cols = [
    { label: 'property', boost: 10 },
    { label: 'property_type', boost: 10 },
    { label: 'property_id', boost: 10 },
    { label: 'posted_at', boost: 10 },
    { label: 'price', boost: 10 },
    { label: 'booking_id', boost: 10 },
  ];
  const labels = (r: { label: string }[]) => r.map((o) => o.label);

  it('matches a non-contiguous subsequence (po -> property)', () => {
    expect(labels(applyFuzzyMatch(cols, 'po'))).toContain('property');
  });

  it('matches on a word boundary (pt -> property_type)', () => {
    expect(labels(applyFuzzyMatch(cols, 'pt'))).toContain('property_type');
  });

  it('matches an initialism across underscores (bid -> booking_id)', () => {
    expect(labels(applyFuzzyMatch(cols, 'bid'))).toContain('booking_id');
  });

  it('ranks a prefix match above a looser subsequence (po: posted_at > property)', () => {
    const result = applyFuzzyMatch(cols, 'po');
    const posted = result.find((o) => o.label === 'posted_at');
    const property = result.find((o) => o.label === 'property');
    expect(posted).toBeDefined();
    expect(property).toBeDefined();
    expect(posted!.boost!).toBeGreaterThan(property!.boost!);
  });

  it('excludes candidates that are not a subsequence (price has no "o" for po)', () => {
    expect(labels(applyFuzzyMatch(cols, 'po'))).not.toContain('price');
  });

  it('highlights each matched character of a split subsequence (po -> pr[o]perty)', () => {
    const property = applyFuzzyMatch(cols, 'po').find((o) => o.label === 'property');
    // p@0 and o@2 -> [from,toExclusive] pairs: [0,1, 2,3]
    expect(property!.matchRanges).toEqual([0, 1, 2, 3]);
  });

  it('fuzzy-matches keywords too (gb -> GROUP BY)', () => {
    const kw = [
      { label: 'GROUP BY', boost: 5 },
      { label: 'ORDER BY', boost: 5 },
    ];
    const result = labels(applyFuzzyMatch(kw, 'gb'));
    expect(result).toContain('GROUP BY');
    expect(result).not.toContain('ORDER BY');
  });

  it('caps the number of matches so a wide table cannot flood the dropdown', () => {
    // 200 columns that all contain the letter "a" as a subsequence.
    const many = Array.from({ length: 200 }, (_, i) => ({ label: `col_a_${i}`, boost: 10 }));
    expect(applyFuzzyMatch(many, 'a').length).toBeLessThanOrEqual(50);
  });
});

describe('isAfterStringClose', () => {
  it('returns true immediately after a closing single quote', () => {
    expect(isAfterStringClose("WHERE id = 'xxx'")).toBe(true);
  });

  it('returns true immediately after a closing double quote', () => {
    expect(isAfterStringClose('SELECT "my_col"')).toBe(true);
  });

  it('returns false when still inside an open single-quoted string', () => {
    expect(isAfterStringClose("WHERE id = 'xxx")).toBe(false);
  });

  it('returns false when last char is not a quote', () => {
    expect(isAfterStringClose('WHERE id = ')).toBe(false);
    expect(isAfterStringClose('SELECT * FROM users WHERE ')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAfterStringClose('')).toBe(false);
  });

  it('returns false inside a double-quoted identifier', () => {
    expect(isAfterStringClose('SELECT "my_col')).toBe(false);
  });
});

describe('isInsideString', () => {
  it('returns false for text with no quotes', () => {
    expect(isInsideString('SELECT * FROM users WHERE ')).toBe(false);
  });

  it('returns true inside an unclosed single-quoted string', () => {
    expect(isInsideString("SELECT * FROM users WHERE email = '")).toBe(true);
    expect(isInsideString("WHERE name = 'd")).toBe(true);
  });

  it('returns false after a closed single-quoted string', () => {
    expect(isInsideString("WHERE name = 'alice' AND ")).toBe(false);
  });

  it('returns true inside an unclosed double-quoted identifier', () => {
    expect(isInsideString('SELECT "my_col')).toBe(true);
  });

  it('returns false after a closed double-quoted identifier', () => {
    expect(isInsideString('SELECT "my_col" FROM ')).toBe(false);
  });

  it('handles SQL escaped single quote (two consecutive quotes stay outside)', () => {
    // WHERE name = 'o''brien' AND  — cursor after AND, outside string
    expect(isInsideString("WHERE name = 'o''brien' AND ")).toBe(false);
  });

  it('handles empty string', () => {
    expect(isInsideString('')).toBe(false);
  });

  it('returns true mid-value in the screenshot scenario', () => {
    // Replicates the bug from the screenshot: "where from_account_id = 'd"
    // beforeWord is everything up to (but not including) 'd'
    expect(isInsideString("SELECT *\nfrom transactions\nwhere from_account_id = '")).toBe(true);
  });
});

describe('isInsideComment', () => {
  it('returns false for text with no comment', () => {
    expect(isInsideComment('SELECT * FROM users WHERE ')).toBe(false);
  });

  it('returns true inside a -- line comment', () => {
    expect(isInsideComment('SELECT * -- pick the ')).toBe(true);
  });

  it('returns false once a newline ends the -- line comment', () => {
    expect(isInsideComment('SELECT * -- a comment\nFROM ')).toBe(false);
  });

  it('returns true inside an unclosed /* */ block comment', () => {
    expect(isInsideComment('SELECT /* choose ')).toBe(true);
    expect(isInsideComment('SELECT /* line one\nline two ')).toBe(true);
  });

  it('returns false after a closed /* */ block comment', () => {
    expect(isInsideComment('SELECT /* note */ id FROM ')).toBe(false);
  });

  it('does not treat comment markers inside a string literal as a comment', () => {
    expect(isInsideComment("WHERE note = '-- not a comment' AND ")).toBe(false);
    expect(isInsideComment("WHERE note = '/* not a comment */' AND ")).toBe(false);
  });

  it('does not treat a quote inside a comment as opening a string', () => {
    expect(isInsideString("-- it's a comment ")).toBe(false);
    expect(isInsideComment("-- it's a comment ")).toBe(true);
  });
});

describe('findStatementBounds', () => {
  it('returns full doc when no semicolons', () => {
    const text = 'SELECT * FROM users';
    expect(findStatementBounds(text, 10)).toEqual({ stmtStart: 0, stmtEnd: text.length });
  });

  it('second statement starts after first semicolon', () => {
    const text = 'SELECT 1; SELECT * FROM users WHERE ';
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 9, stmtEnd: text.length });
  });

  it('first statement ends at semicolon (inclusive)', () => {
    const text = 'SELECT 1; SELECT 2';
    expect(findStatementBounds(text, 7)).toEqual({ stmtStart: 0, stmtEnd: 9 });
  });

  it('does not use semicolon inside a single-quoted string as boundary', () => {
    const text = "SELECT * FROM users WHERE comment = 'end; of story' AND ";
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 0, stmtEnd: text.length });
  });

  it('uses real semicolon before string, ignores semicolon inside string', () => {
    const text = "SELECT 1; SELECT * FROM users WHERE comment = 'end; of story' AND ";
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 9, stmtEnd: text.length });
  });

  it('cursor at semicolon position uses it as end boundary', () => {
    const text = 'SELECT 1;SELECT 2';
    // cursor at 8 (the ';'): ';' is NOT < 8, so it's the stmtEnd
    expect(findStatementBounds(text, 8)).toEqual({ stmtStart: 0, stmtEnd: 9 });
  });
});

describe('innerSubqueryContext', () => {
  it('returns null when cursor is not inside parens', () => {
    const before = 'SELECT * FROM users WHERE ';
    const full = 'SELECT * FROM users WHERE id = 1';
    expect(innerSubqueryContext(before, full)).toBeNull();
  });

  it('returns inner context when cursor is inside a subquery', () => {
    const before = 'SELECT * FROM users WHERE id IN (SELECT ';
    const full = 'SELECT * FROM users WHERE id IN (SELECT id FROM orders)';
    const result = innerSubqueryContext(before, full);
    expect(result).not.toBeNull();
    expect(result!.innerBefore).toBe('SELECT ');
    expect(result!.innerFull).toBe('SELECT id FROM orders');
  });

  it('isolates innermost subquery for nested parens', () => {
    const before = 'SELECT * FROM users WHERE a IN (SELECT * FROM t WHERE b IN (SELECT ';
    const full = 'SELECT * FROM users WHERE a IN (SELECT * FROM t WHERE b IN (SELECT id FROM s))';
    const result = innerSubqueryContext(before, full);
    expect(result).not.toBeNull();
    expect(result!.innerBefore).toBe('SELECT ');
    expect(result!.innerFull).toBe('SELECT id FROM s');
  });

  it('clips innerFull at matching ) so outer JOIN does not leak in', () => {
    const before = 'SELECT * FROM a WHERE id IN (SELECT ';
    const full = 'SELECT * FROM a WHERE id IN (SELECT x FROM b) JOIN d ON b.id = d.id';
    const result = innerSubqueryContext(before, full);
    expect(result).not.toBeNull();
    expect(result!.innerFull).toBe('SELECT x FROM b');
    const ctx = detectSqlContext(result!.innerBefore, result!.innerFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toEqual(['b']);
      expect(ctx.fromTables).not.toContain('d');
    }
  });

  it('clips innerFull at matching ) for nested subqueries', () => {
    const before = 'SELECT * FROM users WHERE a IN (SELECT * FROM t WHERE b IN (SELECT ';
    const full =
      'SELECT * FROM users WHERE a IN (SELECT * FROM t WHERE b IN (SELECT id FROM s)) AND foo = 1';
    const result = innerSubqueryContext(before, full);
    expect(result).not.toBeNull();
    expect(result!.innerFull).toBe('SELECT id FROM s');
  });

  it('ignores parens inside string literals', () => {
    const before = "SELECT * FROM users WHERE name = '(not a subquery' AND ";
    const full = "SELECT * FROM users WHERE name = '(not a subquery' AND id = 1";
    expect(innerSubqueryContext(before, full)).toBeNull();
  });

  it('correctly resolves to outer paren when inner paren is closed', () => {
    const before = 'WHERE a IN (SELECT * FROM t WHERE b = (1 + 2) AND c = ';
    const full = 'WHERE a IN (SELECT * FROM t WHERE b = (1 + 2) AND c = 3)';
    const result = innerSubqueryContext(before, full);
    expect(result).not.toBeNull();
    expect(result!.innerBefore).toBe('SELECT * FROM t WHERE b = (1 + 2) AND c = ');
  });

  it('combined with detectSqlContext: uses inner FROM tables not outer', () => {
    const before = 'SELECT * FROM users WHERE id IN (SELECT ';
    const full = 'SELECT * FROM users WHERE id IN (SELECT id FROM orders)';
    const sub = innerSubqueryContext(before, full);
    expect(sub).not.toBeNull();
    const ctx = detectSqlContext(sub!.innerBefore, sub!.innerFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toEqual(['orders']);
      expect(ctx.fromTables).not.toContain('users');
      expect(ctx.isSelectList).toBe(true);
    }
  });

  it('combined with detectSqlContext: WHERE in subquery uses inner FROM', () => {
    const before = 'SELECT * FROM users WHERE id IN (SELECT id FROM orders WHERE ';
    const full = 'SELECT * FROM users WHERE id IN (SELECT id FROM orders WHERE id = 1)';
    const sub = innerSubqueryContext(before, full);
    expect(sub).not.toBeNull();
    const ctx = detectSqlContext(sub!.innerBefore, sub!.innerFull);
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toContain('orders');
      expect(ctx.fromTables).not.toContain('users');
    }
  });

  // A grouping/boolean paren is NOT a subquery, so innerSubqueryContext must not
  // descend into it — otherwise the enclosing clause (WHERE) is lost and the
  // position is misread as a keyword position instead of a column one.
  it('does not descend into a grouping paren in WHERE', () => {
    const before = 'SELECT * FROM users WHERE (id = ';
    expect(innerSubqueryContext(before, before)).toBeNull();
  });

  it('does not descend into a function-call paren', () => {
    const before = 'SELECT id FROM users GROUP BY id HAVING count(';
    expect(innerSubqueryContext(before, before)).toBeNull();
  });
});

// Mirrors QueryEditor's completion path (innerSubqueryContext then
// detectSqlContext): grouping parens keep column context, while a real subquery
// still resets context to its own inner FROM.
describe('completion path — grouping parens vs subqueries', () => {
  const contextAt = (stmt: string): SqlContext => {
    const sub = innerSubqueryContext(stmt, stmt);
    return detectSqlContext(sub?.innerBefore ?? stmt, sub?.innerFull ?? stmt);
  };

  it('column context right after an opening grouping paren in WHERE', () => {
    const ctx = contextAt('SELECT * FROM users WHERE (');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('column context after an operator inside a grouping paren in WHERE', () => {
    const ctx = contextAt('SELECT * FROM users WHERE (id = ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') expect(ctx.fromTables).toContain('users');
  });

  it('column context inside nested grouping parens in WHERE', () => {
    const ctx = contextAt('SELECT * FROM users WHERE (a = 1 AND (b = ');
    expect(ctx.kind).toBe('column');
  });

  it('column context after a grouping paren in HAVING', () => {
    const ctx = contextAt('SELECT id FROM users GROUP BY id HAVING (');
    expect(ctx.kind).toBe('column');
  });

  it('still resets to the subquery FROM inside IN (SELECT …)', () => {
    const ctx = contextAt('SELECT * FROM users WHERE id IN (SELECT x FROM orders WHERE ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toContain('orders');
      expect(ctx.fromTables).not.toContain('users');
    }
  });

  it('resolves a grouping paren nested inside a subquery to the subquery FROM', () => {
    const ctx = contextAt('SELECT * FROM users WHERE id IN (SELECT x FROM orders WHERE (y = ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toContain('orders');
      expect(ctx.fromTables).not.toContain('users');
    }
  });
});

describe('findStatementBounds — SQL comments', () => {
  it('ignores ; inside a -- line comment', () => {
    const text = 'SELECT 1; -- discard;\nSELECT * FROM users WHERE ';
    // semicolon at index 8 ends first statement; the ; inside the comment must NOT be a boundary
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 9, stmtEnd: text.length });
  });

  it('ignores ( and ; inside a -- line comment for paren tracking', () => {
    const text = 'SELECT * FROM users WHERE -- (subq;\n id = 1';
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 0, stmtEnd: text.length });
  });

  it('ignores ; inside a /* */ block comment', () => {
    const text = 'SELECT 1; /* a;b;c */ SELECT * FROM users WHERE ';
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 9, stmtEnd: text.length });
  });

  it('handles -- comment without trailing newline', () => {
    const text = 'SELECT 1; SELECT * FROM users -- trailing;';
    expect(findStatementBounds(text, text.length)).toEqual({ stmtStart: 9, stmtEnd: text.length });
  });
});

describe('selection + findStatementBounds composition', () => {
  // Mirrors the clamp logic in completionSource: when selection is non-empty,
  // both `;` boundaries and the selection bound the statement.
  function clampToSelection(
    fullText: string,
    pos: number,
    sel: { from: number; to: number; empty: boolean }
  ): { stmtStart: number; stmtEnd: number } {
    const b = findStatementBounds(fullText, pos);
    if (sel.empty) return b;
    return { stmtStart: Math.max(b.stmtStart, sel.from), stmtEnd: Math.min(b.stmtEnd, sel.to) };
  }

  it('selection spanning two statements isolates the statement containing the cursor', () => {
    // Full doc: two statements separated by ;
    const text = 'SELECT * FROM orders; SELECT * FROM users WHERE ';
    // Selection covers both statements; cursor at end (in second statement)
    const sel = { from: 0, to: text.length, empty: false };
    const { stmtStart, stmtEnd } = clampToSelection(text, text.length, sel);
    // stmtStart should land at the second statement, not selection start
    const stmtFull = text.slice(stmtStart, stmtEnd);
    expect(extractFromTables(stmtFull)).toEqual(['users']);
    expect(extractFromTables(stmtFull)).not.toContain('orders');
  });

  it('selection narrower than statement clips end at selection', () => {
    const text = 'SELECT * FROM users WHERE id = 1';
    const sel = { from: 0, to: 19, empty: false }; // up to "SELECT * FROM users"
    const { stmtStart, stmtEnd } = clampToSelection(text, 19, sel);
    expect(stmtStart).toBe(0);
    expect(stmtEnd).toBe(19);
  });

  it('empty selection falls through to findStatementBounds', () => {
    const text = 'SELECT 1; SELECT * FROM users WHERE ';
    const sel = { from: 0, to: 0, empty: true };
    const { stmtStart, stmtEnd } = clampToSelection(text, text.length, sel);
    expect(stmtStart).toBe(9);
    expect(stmtEnd).toBe(text.length);
  });
});

describe('innerSubqueryContext — SQL comments', () => {
  it('ignores ( inside a -- line comment', () => {
    const before = 'SELECT * FROM users WHERE -- (\n id = ';
    const full = 'SELECT * FROM users WHERE -- (\n id = 1';
    expect(innerSubqueryContext(before, full)).toBeNull();
  });

  it('ignores ( inside a /* */ block comment', () => {
    const before = 'SELECT * FROM users WHERE /* ( */ id = ';
    const full = 'SELECT * FROM users WHERE /* ( */ id = 1';
    expect(innerSubqueryContext(before, full)).toBeNull();
  });
});
