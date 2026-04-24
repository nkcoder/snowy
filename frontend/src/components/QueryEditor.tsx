import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import type { Completion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Play, Save, Trash2, Clock } from 'lucide-react';

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

// Override CodeMirror's default background to match app chrome
const editorTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '13px',
        background: '#1e1f22',
    },
    '.cm-content': {
        fontFamily: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
        caretColor: '#ecebe8',
        padding: '8px 0',
    },
    '.cm-scroller': { overflow: 'auto' },
    '.cm-gutters': {
        background: '#1e1f22',
        borderRight: '1px solid #393b40',
        color: '#4a4a50',
    },
    '.cm-activeLineGutter': { background: '#25262b' },
    '.cm-activeLine': { background: '#25262b' },
    '.cm-selectionBackground, ::selection': { background: '#2e436e !important' },
    '.cm-cursor': { borderLeftColor: '#ecebe8' },
    '.cm-focused .cm-selectionBackground': { background: '#2e436e' },
    // ── Autocomplete popover ────────────────────────────────────────────────────
    '.cm-tooltip.cm-tooltip-autocomplete': {
        width: '440px',
        background: '#2b2d30',
        border: '1px solid #393b40',
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
    // Type-specific icon colours
    '.cm-completionIcon-type': { color: 'oklch(0.62 0.17 240)' },  // table → blue
    '.cm-completionIcon-property': { color: '#e5c07b' },             // column → gold
    '.cm-completionIcon-namespace': { color: '#98c379' },            // schema → green
    '.cm-completionIcon-keyword': { color: '#c678dd' },              // keyword → purple
}, { dark: true });

// Compartment allows reconfiguring the sql extension after editor creation
const sqlCompartment = new Compartment();

/**
 * Build @codemirror/lang-sql schema config from CompletionEntry array.
 * schema: maps table/qualified-table names to their column Completions
 * tables: Completion[] for table-level completions
 */
function buildSqlConfig(entries: CompletionEntry[]): { schema: Record<string, Completion[]>; tables: Completion[] } {
    const schema: Record<string, Completion[]> = {};
    const tables: Completion[] = [];
    const seenTables = new Set<string>();

    for (const e of entries) {
        if (e.kind === 'schema') {
            // Schemas surface as namespace completions — handled via tables list context
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
    // Suppress updateListener during programmatic (non-user) dispatches
    const isProgrammatic = useRef(false);
    // Track latest callbacks without re-creating the editor
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
                // sql compartment starts with no schema; updated when completions arrive
                sqlCompartment.of(sql({ dialect: PostgreSQL })),
                oneDark,
                editorTheme,
                keymap.of([
                    { key: 'Mod-Enter', run: runCmd },
                    { key: 'Ctrl-Enter', run: runCmd }, // fallback for non-Mac / test environments
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
        // Only create editor once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync external sql changes into editor (e.g. tab switch, table double-click, load from sidebar)
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        const current = view.state.doc.toString();
        if (current === sqlValue) return;
        isProgrammatic.current = true;
        view.dispatch({ changes: { from: 0, to: current.length, insert: sqlValue } });
        isProgrammatic.current = false;
    }, [sqlValue]);

    // Reconfigure sql extension when DB completions arrive or change
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
        // Let updateListener fire naturally (user-initiated clear = dirty)
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } });
    }, []);

    return (
        <div className="flex flex-col h-full bg-[#1e1f22] border-b border-[#393b40]" data-testid="query-editor">
            {/* Toolbar */}
            <div className="flex items-center h-9 px-2 gap-1 border-b border-[#393b40] bg-[#2b2d30] flex-shrink-0">
                <button
                    data-testid="run-button"
                    onClick={handleRun}
                    disabled={loading}
                    title="Run (⌘↵)"
                    className="flex items-center gap-1.5 bg-[#3574f0] hover:bg-[#4b85ff] disabled:opacity-40 text-white text-[12px] font-semibold px-2.5 py-1 rounded transition-colors shadow-sm"
                >
                    <Play size={14} fill="currentColor" />
                    Execute
                </button>
                <div className="h-4 w-[1px] bg-[#393b40] mx-1" />
                <button
                    data-testid="save-button"
                    onClick={onSave}
                    title="Save (⌘S)"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors"
                >
                    <Save size={16} />
                </button>
                <button
                    data-testid="clear-button"
                    onClick={handleClear}
                    title="Clear"
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors"
                >
                    <Trash2 size={16} />
                </button>
                <div className="h-4 w-[1px] bg-[#393b40] mx-1" />
                <button
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors"
                    title="History"
                >
                    <Clock size={16} />
                </button>
                <div className="ml-auto px-2 text-[11px] text-slate-500 font-mono select-none">
                    ⌘↵ run · ⌘S save
                </div>
            </div>

            {/* CodeMirror container */}
            <div ref={containerRef} className="flex-1 overflow-hidden" data-testid="cm-editor" />
        </div>
    );
}
