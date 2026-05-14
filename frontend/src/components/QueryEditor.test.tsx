import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryEditor, makeKeyTypeBadge, detectSqlContext, extractFromTables, buildCompletionOptions, applyPrefixBoost } from './QueryEditor';
import type { CompletionEntry } from './QueryEditor';

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
}));

vi.mock('@codemirror/autocomplete', () => ({ autocompletion: () => ({}) }));
vi.mock('@codemirror/lang-sql', () => ({ sql: () => ({}), PostgreSQL: {} }));
vi.mock('@codemirror/theme-one-dark', () => ({ oneDark: {} }));
vi.mock('@codemirror/commands', () => ({
  defaultKeymap: [],
  history: () => ({}),
  historyKeymap: [],
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
    const tables = extractFromTables('SELECT * FROM users LEFT JOIN accounts ON users.id = accounts.user_id');
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
});

describe('detectSqlContext', () => {
  it('returns keyword context at start of statement', () => {
    expect(detectSqlContext('', '')).toEqual({ kind: 'keyword' });
  });

  it('returns table context after FROM', () => {
    expect(detectSqlContext('SELECT * FROM ', 'SELECT * FROM ')).toEqual({ kind: 'table' });
  });

  it('returns table context after FROM with partial table list', () => {
    expect(detectSqlContext('SELECT * FROM users, ', 'SELECT * FROM users, ')).toEqual({ kind: 'table' });
  });

  it('returns table context after JOIN', () => {
    expect(detectSqlContext('SELECT * FROM users JOIN ', 'SELECT * FROM users JOIN ')).toEqual({ kind: 'table' });
  });

  it('returns table context after UPDATE', () => {
    expect(detectSqlContext('UPDATE ', 'UPDATE ')).toEqual({ kind: 'table' });
  });

  it('returns keyword context after FROM tablename (space, no comma)', () => {
    expect(detectSqlContext('SELECT * FROM users ', 'SELECT * FROM users ')).toEqual({ kind: 'keyword' });
  });

  it('returns column context after WHERE', () => {
    const ctx = detectSqlContext('SELECT * FROM users WHERE ', 'SELECT * FROM users WHERE ');
    expect(ctx.kind).toBe('column');
    if (ctx.kind === 'column') {
      expect(ctx.fromTables).toContain('users');
    }
  });

  it('returns column context after AND', () => {
    const ctx = detectSqlContext('SELECT * FROM users WHERE id = 1 AND ', 'SELECT * FROM users WHERE id = 1 AND ');
    expect(ctx.kind).toBe('column');
  });

  it('returns column context after OR', () => {
    const ctx = detectSqlContext('SELECT * FROM users WHERE id = 1 OR ', 'SELECT * FROM users WHERE id = 1 OR ');
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

  it('returns keyword context after fr (partial keyword)', () => {
    // "fr" is the partial word — beforeWord is empty
    expect(detectSqlContext('', 'fr')).toEqual({ kind: 'keyword' });
  });
});

// Shared fixture data used by ranking tests
const sampleEntries: CompletionEntry[] = [
  { kind: 'table', schema: 'public', table: '', name: 'accounts', dataType: '', keyType: '' },
  { kind: 'table', schema: 'public', table: '', name: 'users',    dataType: '', keyType: '' },
  { kind: 'view',  schema: 'public', table: '', name: 'active_users', dataType: '', keyType: '' },
  { kind: 'column', schema: 'public', table: 'users', name: 'id',    dataType: 'int4',    keyType: 'pk' },
  { kind: 'column', schema: 'public', table: 'users', name: 'email', dataType: 'text',    keyType: 'fk' },
  { kind: 'column', schema: 'public', table: 'users', name: 'name',  dataType: 'text',    keyType: '' },
];

describe('buildCompletionOptions — ranking', () => {
  it('table context returns only tables/views, no keywords', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'table' });
    const labels = opts.map(o => o.label);
    expect(labels).toContain('accounts');
    expect(labels).toContain('active_users');
    expect(labels).not.toContain('SELECT');
  });

  it('table context gives tables boost 20 and views boost 15', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'table' });
    const table = opts.find(o => o.label === 'accounts');
    const view  = opts.find(o => o.label === 'active_users');
    expect(table?.boost).toBe(20);
    expect(view?.boost).toBe(15);
  });

  it('keyword context returns keywords, no tables', () => {
    const opts = buildCompletionOptions(sampleEntries, { kind: 'keyword' });
    const labels = opts.map(o => o.label);
    expect(labels).toContain('SELECT');
    expect(labels).not.toContain('accounts');
  });

  it('PK column ranks above FK and plain column', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column', fromTables: ['users'], isSelectList: false,
    });
    const pk    = opts.find(o => o.label === 'id');
    const fk    = opts.find(o => o.label === 'email');
    const plain = opts.find(o => o.label === 'name');
    expect(pk?.boost).toBeGreaterThan(fk?.boost ?? 0);
    expect(fk?.boost).toBeGreaterThan(plain?.boost ?? 0);
  });

  it('star option is present in SELECT column list context', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column', fromTables: ['users'], isSelectList: true,
    });
    expect(opts[0].label).toBe('*');
  });

  it('star option is absent in non-SELECT column context', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column', fromTables: ['users'], isSelectList: false,
    });
    expect(opts.map(o => o.label)).not.toContain('*');
  });

  it('column context with no fromTables returns all columns', () => {
    const opts = buildCompletionOptions(sampleEntries, {
      kind: 'column', fromTables: [], isSelectList: false,
    });
    expect(opts.map(o => o.label)).toContain('id');
    expect(opts.map(o => o.label)).toContain('email');
  });
});

describe('applyPrefixBoost', () => {
  const base = [
    { label: 'accounts', boost: 20 },
    { label: 'active_users', boost: 15 },
    { label: 'users', boost: 20 },
  ];

  it('adds +50 to labels that start with the prefix', () => {
    const result = applyPrefixBoost(base, 'acc');
    expect(result.find(o => o.label === 'accounts')?.boost).toBe(70);
    expect(result.find(o => o.label === 'users')?.boost).toBe(20);
  });

  it('is case-insensitive', () => {
    const result = applyPrefixBoost(base, 'ACC');
    expect(result.find(o => o.label === 'accounts')?.boost).toBe(70);
  });

  it('does not boost a substring-only match', () => {
    const result = applyPrefixBoost(base, 'ctive');
    expect(result.find(o => o.label === 'active_users')?.boost).toBe(15);
  });

  it('returns options unchanged when prefix is empty', () => {
    const result = applyPrefixBoost(base, '');
    expect(result).toEqual(base);
  });

  it('prefix match outranks substring match of same base boost', () => {
    const opts = [
      { label: 'email_address', boost: 10 },
      { label: 'em_id', boost: 10 },
    ];
    const result = applyPrefixBoost(opts, 'em');
    const emId      = result.find(o => o.label === 'em_id')!;
    const emailAddr = result.find(o => o.label === 'email_address')!;
    expect(emId.boost).toBe(60);
    expect(emailAddr.boost).toBe(60);
  });
});
