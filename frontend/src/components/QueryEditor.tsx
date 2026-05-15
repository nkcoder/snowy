import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Play, Save, Trash2, Clock } from 'lucide-react';
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

// CodeMirror theme matched to SnowyDark token values.
// These are static strings; theme-switching via CSS vars inside CodeMirror
// is not supported, so the editor stays dark-mode only for now.
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13px',
        background: '#1f1d1b',
    },
    '.cm-content': {
        fontFamily: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
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
    // ── Autocomplete popover ────────────────────────────────────────────────────
    '.cm-tooltip.cm-tooltip-autocomplete': {
        width: '440px',
        background: '#232120',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        fontFamily: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
        fontSize: '12px',
    },
    '.cm-tooltip-autocomplete > ul': {
        maxHeight: '240px',
        fontFamily: 'inherit',
    },
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
    '.cm-completionLabel': {
        color: '#ecebe8',
        flex: '1',
    },
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
    // Key-type badges
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
    '.cm-key-badge-pk': { background: 'rgba(229,192,123,0.15)', color: '#e5c07b', border: '1px solid rgba(229,192,123,0.3)' },
    '.cm-key-badge-fk': { background: 'rgba(53,116,240,0.15)', color: 'oklch(0.72 0.17 240)', border: '1px solid rgba(53,116,240,0.3)' },
    '.cm-key-badge-col': { background: 'rgba(255,255,255,0.05)', color: '#6e6a62', border: '1px solid rgba(255,255,255,0.08)' },
}, { dark: true });

// Curated SQL keyword list — focuses on query-writing keywords only.
// Functions, types, and obscure dialect words are intentionally excluded.
const SQL_KEYWORDS = [
    'SELECT', 'DISTINCT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
    'INSERT INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE', 'DELETE FROM',
    'CREATE TABLE', 'CREATE INDEX', 'CREATE VIEW',
    'DROP TABLE', 'DROP INDEX', 'DROP VIEW',
    'ALTER TABLE', 'ADD COLUMN', 'DROP COLUMN',
    'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN', 'CROSS JOIN', 'ON',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
    'AS', 'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
    'RETURNING', 'WITH', 'RECURSIVE',
    'TRUE', 'FALSE', 'NULL',
    'ASC', 'DESC',
    'BETWEEN', 'LIKE', 'ILIKE',
    'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'EXISTS', 'NOT EXISTS',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'BEGIN', 'COMMIT', 'ROLLBACK',
    'EXPLAIN', 'EXPLAIN ANALYZE',
    'TRUNCATE',
    'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'NOT NULL', 'DEFAULT', 'REFERENCES',
    'COALESCE', 'NULLIF',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
];

const keywordOptions: Completion[] = SQL_KEYWORDS.map(kw => ({
    label: kw,
    type: 'keyword',
    boost: 5,
}));

const starOption: Completion = {
    label: '*',
    detail: 'all columns',
    type: 'keyword',
    boost: 30,
};

export function makeKeyTypeBadge(keyType: 'pk' | 'fk' | ''): HTMLElement {
    const badge = document.createElement('span');
    const variant = keyType === 'pk' ? 'pk' : keyType === 'fk' ? 'fk' : 'col';
    badge.className = `cm-key-badge cm-key-badge-${variant}`;
    badge.textContent = keyType === 'pk' ? 'PK' : keyType === 'fk' ? 'FK' : 'COL';
    return badge;
}

// Extracts referenced table names from the FROM and JOIN clauses of a statement.
export function extractFromTables(stmtText: string): string[] {
    const tables: string[] = [];

    // FROM clause — stop at any major keyword or end
    const fromMatch = stmtText.match(
        /\bFROM\s+([\w\s,]+?)(?:\s+(?:WHERE|(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN|ORDER\s+BY|GROUP\s+BY|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT)\b|;|$)/i
    );
    if (fromMatch) {
        fromMatch[1].split(',').forEach(part => {
            const name = part.trim().split(/\s+/)[0];
            if (name && /^\w+$/.test(name)) tables.push(name.toLowerCase());
        });
    }

    // JOIN clauses
    const joinRe = /\b(?:(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?)?JOIN\s+(\w+)/gi;
    let m: RegExpExecArray | null;
    while ((m = joinRe.exec(stmtText)) !== null) {
        tables.push(m[1].toLowerCase());
    }

    // UPDATE target table
    const updateMatch = stmtText.match(/\bUPDATE\s+(\w+)/i);
    if (updateMatch) tables.push(updateMatch[1].toLowerCase());

    return [...new Set(tables)];
}

type SqlContext =
    | { kind: 'keyword' }
    | { kind: 'table' }
    | { kind: 'column'; fromTables: string[]; isSelectList: boolean };

// Determines what kind of completions to show based on the SQL text before the
// current word. All comparisons are done case-insensitively. beforeWord retains
// its trailing whitespace — the patterns rely on it to detect "right after keyword".
export function detectSqlContext(beforeWord: string, stmtFull: string): SqlContext {
    const upper = beforeWord.toUpperCase();

    // Table context: immediately after FROM / JOIN / UPDATE (with optional table,comma list already typed)
    if (
        /\b(?:FROM|JOIN)\s+(?:\w+\s*,\s*)*$/.test(upper) ||
        /\bUPDATE\s*$/.test(upper)
    ) {
        return { kind: 'table' };
    }

    // Column context: after WHERE / HAVING / ON / AND / OR / SET / SELECT / ORDER BY / GROUP BY
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

// Returns true when the SQL text ends inside an open string literal (single or
// double-quoted). SQL escapes a literal quote by doubling it (''), so two
// consecutive same-type quotes do NOT toggle the in-string state.
export function isInsideString(text: string): boolean {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "'" && !inDouble) {
            if (text[i + 1] === "'") { i++; } else { inSingle = !inSingle; }
        } else if (ch === '"' && !inSingle) {
            if (text[i + 1] === '"') { i++; } else { inDouble = !inDouble; }
        }
    }
    return inSingle || inDouble;
}

// Pure helper: apply a +50 boost to any option whose label starts with `prefix`.
// Called after the base options are built so prefix matches always rank above
// substring matches that share the same base boost value.
export function applyPrefixBoost(options: Completion[], prefix: string): Completion[] {
    if (!prefix) return options;
    const lower = prefix.toLowerCase();
    return options.map(o =>
        o.label.toLowerCase().startsWith(lower)
            ? { ...o, boost: (o.boost ?? 0) + 50 }
            : o
    );
}

// Pure helper: build the raw completion option list for a given context.
// Does NOT apply prefix boosting — call applyPrefixBoost separately.
export function buildCompletionOptions(entries: CompletionEntry[], ctx: SqlContext): Completion[] {
    if (ctx.kind === 'table') {
        return entries
            .filter(e => e.kind === 'table' || e.kind === 'view')
            .map(e => ({
                label: e.name,
                detail: e.schema,
                type: e.kind === 'table' ? 'type' : 'variable',
                boost: e.kind === 'table' ? 20 : 15,
            }));
    }

    if (ctx.kind === 'column') {
        const lowerTables = ctx.fromTables.length > 0 ? new Set(ctx.fromTables) : null;
        const cols: Completion[] = entries
            .filter(e => e.kind === 'column' && (lowerTables === null || lowerTables.has(e.table.toLowerCase())))
            .map(e => ({
                label: e.name,
                detail: e.dataType,
                type: 'property',
                boost: e.keyType === 'pk' ? 15 : e.keyType === 'fk' ? 12 : 10,
                keyType: e.keyType,
            } as Completion & { keyType: string }));
        return ctx.isSelectList ? [starOption, ...cols] : cols;
    }

    return keywordOptions;
}

export function QueryEditor({ sql: sqlValue, onChange, onRun, onSave, loading, completions }: QueryEditorProps) {
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

    // Keep entries in sync without rebuilding the editor
    useEffect(() => {
        entriesRef.current = completions ?? [];
    }, [completions]);

    useEffect(() => {
        if (!containerRef.current) return;

        const runCmd = (view: EditorView) => {
            const content = view.state.doc.toString();
            onRunRef.current(content);
            return true;
        };

        const saveCmd = (_view: EditorView) => {
            onSaveRef.current();
            return true;
        };

        // Context-aware SQL completion source. Reads from entriesRef so it always
        // has fresh data without needing to reconfigure the extension.
        const completionSource = (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word) return null;

            const fullText = context.state.doc.toString();
            // Find the start of the current SQL statement (after last semicolon)
            const stmtStart = fullText.lastIndexOf(';', context.pos - 1) + 1;
            const stmtBeforeCursor = fullText.slice(stmtStart, context.pos);
            const beforeWord = fullText.slice(stmtStart, word.from);

            // No completions inside string literals
            if (isInsideString(beforeWord)) return null;

            const entries = entriesRef.current;
            const ctx = detectSqlContext(beforeWord, stmtBeforeCursor);

            // In keyword context, don't auto-open on space (no typed prefix)
            if (word.from === word.to && ctx.kind === 'keyword' && !context.explicit) return null;

            const options = applyPrefixBoost(
                buildCompletionOptions(entries, ctx),
                word.text,
            );

            return options.length > 0 ? { from: word.from, options, validFor: /^\w*$/ } : null;
        };

        const state = EditorState.create({
            doc: sqlValue,
            extensions: [
                history(),
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                autocompletion({
                    filterStrict: true,
                    activateOnTyping: true,
                    override: [completionSource],
                    addToOptions: [{
                        render(completion: Completion) {
                            const kt = (completion as Completion & { keyType?: string }).keyType;
                            if (kt === undefined) return null;
                            return makeKeyTypeBadge(kt as 'pk' | 'fk' | '');
                        },
                        position: 25,
                    }],
                }),
                // sql() provides syntax highlighting only; completions are handled by the
                // override above, which bypasses the language's built-in keyword source.
                sql({ dialect: PostgreSQL }),
                oneDark,
                editorTheme,
                keymap.of([
                    { key: 'Mod-Enter', run: runCmd },
                    { key: 'Ctrl-Enter', run: runCmd },
                    { key: 'Mod-s', run: saveCmd, preventDefault: true },
                    ...defaultKeymap,
                    ...historyKeymap,
                ]),
                EditorView.updateListener.of(update => {
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
        onRun(view ? view.state.doc.toString() : sqlValue);
    }, [onRun, sqlValue]);

    const handleClear = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    }, []);

    return (
        <div
            data-testid="query-editor"
            style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.panel, borderBottom: `1px solid ${T.border}` }}
        >
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', height: 36,
                padding: '0 8px', gap: 4,
                borderBottom: `1px solid ${T.border}`,
                background: T.chrome,
                flexShrink: 0,
            }}>
                <button
                    data-testid="run-button"
                    onClick={handleRun}
                    disabled={loading}
                    title="Run (⌘↵)"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: T.accent, color: '#fff',
                        fontSize: 12, fontWeight: 600,
                        padding: '4px 10px', borderRadius: 4,
                        border: 'none', cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.4 : 1,
                        fontFamily: T.ui,
                    }}
                >
                    <Play size={14} fill="currentColor" />
                    Execute
                </button>
                <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
                <button
                    data-testid="save-button"
                    onClick={onSave}
                    title="Save (⌘S)"
                    style={{ padding: 6, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                >
                    <Save size={16} />
                </button>
                <button
                    data-testid="clear-button"
                    onClick={handleClear}
                    title="Clear"
                    style={{ padding: 6, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                >
                    <Trash2 size={16} />
                </button>
                <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
                <button
                    title="History"
                    style={{ padding: 6, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: 4 }}
                >
                    <Clock size={16} />
                </button>
                <div style={{ marginLeft: 'auto', paddingRight: 8, fontSize: 11, color: T.textDim, fontFamily: T.mono, userSelect: 'none' }}>
                    ⌘↵ run · ⌘S save
                </div>
            </div>

            {/* CodeMirror container */}
            <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} data-testid="cm-editor" />
        </div>
    );
}
