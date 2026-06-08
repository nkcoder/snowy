import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompletionEntry } from './QueryEditor';
import {
  applyFuzzyMatch,
  buildCompletionOptions,
  detectSqlContext,
  extractAliasMap,
  extractFromTables,
  FindBar,
  isAfterStringClose,
  isInsideString,
  makeKeyTypeBadge,
  QueryEditor,
} from './QueryEditor';

// CodeMirror uses complex DOM APIs (contenteditable, ResizeObserver, etc.)
// that jsdom doesn't implement. Mock the entire @codemirror/* stack so we can
// test toolbar behaviour without a real editor instance.
vi.mock('@codemirror/view', () => ({
  EditorView: class {
    static theme = () => ({});
    static updateListener = { of: () => ({}) };
    dom = document.createElement('div');
    state = { doc: { toString: () => 'SELECT 1;', length: 9 } };
    dispatch = vi.fn();
    destroy = vi.fn();
    constructor({ parent }: { parent?: Element }) {
      if (parent) parent.appendChild(this.dom);
    }
  },
  keymap: { of: () => ({}) },
  lineNumbers: () => ({}),
  highlightActiveLine: () => ({}),
  highlightActiveLineGutter: () => ({}),
}));

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: () => ({}),
  },
  Compartment: class {
    of = () => ({});
    reconfigure = () => ({});
  },
  Prec: {
    high: (ext: unknown) => ext,
  },
}));

vi.mock('@codemirror/autocomplete', () => ({ autocompletion: () => ({}) }));
vi.mock('@codemirror/lang-sql', () => ({ sql: () => ({}), PostgreSQL: {} }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({}),
  historyKeymap: [],
  insertNewline: () => false,
}));

vi.mock('@codemirror/language', () => ({
  HighlightStyle: { define: () => ({}) },
  syntaxHighlighting: () => ({}),
}));

vi.mock('@codemirror/search', () => ({
  search: () => ({}),
  searchKeymap: [],
  SearchQuery: class {},
  setSearchQuery: { of: vi.fn() },
  findNext: vi.fn(),
  findPrevious: vi.fn(),
}));

describe('QueryEditor', () => {
  const defaultProps = {
    sql: 'SELECT 1;',
    onChange: vi.fn(),
    onRun: vi.fn(),
    onSave: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toolbar', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('clear-button')).toBeInTheDocument();
  });

  it('calls onRun when Execute button clicked', () => {
    render(<QueryEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('run-button'));
    expect(defaultProps.onRun).toHaveBeenCalledOnce();
  });

  it('disables Execute button when loading', () => {
    render(<QueryEditor {...defaultProps} loading={true} />);
    expect(screen.getByTestId('run-button')).toBeDisabled();
  });

  it('calls onSave when Save button clicked', () => {
    render(<QueryEditor {...defaultProps} />);
    fireEvent.click(screen.getByTestId('save-button'));
    expect(defaultProps.onSave).toHaveBeenCalledOnce();
  });

  it('renders CodeMirror container', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByTestId('cm-editor')).toBeInTheDocument();
  });

  it('shows keyboard shortcut hint', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.getByText(/⌘↵ run/i)).toBeInTheDocument();
  });

  it('does not show find bar initially', () => {
    render(<QueryEditor {...defaultProps} />);
    expect(screen.queryByTestId('find-bar')).not.toBeInTheDocument();
  });
});

describe('FindBar', () => {
  function renderFindBar(query = '', overrides: Partial<Parameters<typeof FindBar>[0]> = {}) {
    const onQueryChange = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();
    const onClose = vi.fn();
    render(
      <FindBar
        query={query}
        onQueryChange={onQueryChange}
        onNext={onNext}
        onPrev={onPrev}
        onClose={onClose}
        {...overrides}
      />
    );
    return { onQueryChange, onNext, onPrev, onClose };
  }

  it('renders input and navigation buttons', () => {
    renderFindBar();
    expect(screen.getByTestId('find-input')).toBeInTheDocument();
    expect(screen.getByTestId('find-prev')).toBeInTheDocument();
    expect(screen.getByTestId('find-next')).toBeInTheDocument();
  });

  it('prev/next buttons are disabled when query is empty', () => {
    renderFindBar('');
    expect(screen.getByTestId('find-prev')).toBeDisabled();
    expect(screen.getByTestId('find-next')).toBeDisabled();
  });

  it('prev/next buttons are enabled when query is non-empty', () => {
    renderFindBar('select');
    expect(screen.getByTestId('find-prev')).not.toBeDisabled();
    expect(screen.getByTestId('find-next')).not.toBeDisabled();
  });

  it('calls onQueryChange when input changes', async () => {
    const { onQueryChange } = renderFindBar('');
    await userEvent.type(screen.getByTestId('find-input'), 'a');
    expect(onQueryChange).toHaveBeenCalledWith('a');
  });

  it('calls onNext when next button clicked', async () => {
    const { onNext } = renderFindBar('select');
    await userEvent.click(screen.getByTestId('find-next'));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onPrev when prev button clicked', async () => {
    const { onPrev } = renderFindBar('select');
    await userEvent.click(screen.getByTestId('find-prev'));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onNext on Enter key in input', async () => {
    const { onNext } = renderFindBar('sel');
    await userEvent.type(screen.getByTestId('find-input'), '{Enter}');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('calls onPrev on Shift+Enter key in input', async () => {
    const { onPrev } = renderFindBar('sel');
    const input = screen.getByTestId('find-input');
    await userEvent.click(input);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('calls onClose on Escape key in input', async () => {
    const { onClose } = renderFindBar('sel');
    await userEvent.type(screen.getByTestId('find-input'), '{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

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
