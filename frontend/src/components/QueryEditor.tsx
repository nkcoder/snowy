import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import type { Completion } from '@codemirror/autocomplete';
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
}, { dark: true });

const sqlCompartment = new Compartment();

function buildSqlConfig(entries: CompletionEntry[]): { schema: Record<string, Completion[]>; tables: Completion[] } {
    const schema: Record<string, Completion[]> = {};
    const tables: Completion[] = [];
    const seenTables = new Set<string>();

    for (const e of entries) {
        if (e.kind === 'schema') {
            // Schemas surface as namespace completions
        } else if (e.kind === 'table' || e.kind === 'view') {
            const qualKey = `${e.schema}.${e.name}`;
            if (!seenTables.has(qualKey)) {
                seenTables.add(qualKey);
                tables.push({
                    label: e.name,
                    detail: e.schema,
                    type: 'type',
                    boost: e.kind === 'table' ? 2 : 1,
                });
                if (!schema[e.name]) schema[e.name] = [];
                if (!schema[qualKey]) schema[qualKey] = [];
            }
        } else if (e.kind === 'column') {
            const colCompletion: Completion = {
                label: e.name,
                detail: e.dataType,
                type: 'property',
            };
            const unqual = e.table;
            const qual = `${e.schema}.${e.table}`;
            if (!schema[unqual]) schema[unqual] = [];
            schema[unqual].push(colCompletion);
            if (!schema[qual]) schema[qual] = [];
            schema[qual].push(colCompletion);
        }
    }

    return { schema, tables };
}

export function QueryEditor({ sql: sqlValue, onChange, onRun, onSave, loading, completions }: QueryEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isProgrammatic = useRef(false);
    const onRunRef = useRef(onRun);
    const onSaveRef = useRef(onSave);
    const onChangeRef = useRef(onChange);
    onRunRef.current = onRun;
    onSaveRef.current = onSave;
    onChangeRef.current = onChange;

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

        const state = EditorState.create({
            doc: sqlValue,
            extensions: [
                history(),
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                sqlCompartment.of(sql({ dialect: PostgreSQL })),
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

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const { schema, tables } = buildSqlConfig(completions ?? []);
        view.dispatch({
            effects: sqlCompartment.reconfigure(sql({ dialect: PostgreSQL, schema, tables })),
        });
    }, [completions]);

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
