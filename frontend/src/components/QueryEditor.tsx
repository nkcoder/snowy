import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Play, Save, Trash2, Clock } from 'lucide-react';

interface QueryEditorProps {
    sql: string;
    onChange: (sql: string) => void;
    onRun: (sql: string) => void;
    onSave: () => void;
    loading: boolean;
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
}, { dark: true });

export function QueryEditor({ sql: sqlValue, onChange, onRun, onSave, loading }: QueryEditorProps) {
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

        const saveCmd = (view: EditorView) => {
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
                sql(),
                oneDark,
                editorTheme,
                keymap.of([
                    { key: 'Mod-Enter', run: runCmd },
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
