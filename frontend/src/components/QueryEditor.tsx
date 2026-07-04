import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { syntaxHighlighting } from '@codemirror/language';
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel,
  SearchQuery,
  search,
  setSearchQuery,
} from '@codemirror/search';
import { EditorState, Prec } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { Clock, Play, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { editorTheme, snowySqlHighlight } from '../lib/editorTheme';
import {
  applyFuzzyMatch,
  buildCompletionOptions,
  type CompletionEntry,
  detectSqlContext,
  type FuzzyCompletion,
  findStatementBounds,
  innerSubqueryContext,
  isAfterStringClose,
  isInsideString,
  makeKeyTypeBadge,
} from '../lib/sqlCompletion';
import { T } from '../lib/tokens';
import { FindBar, findMatchInfo, type MatchInfo } from './FindBar';

interface QueryEditorProps {
  sql: string;
  onChange: (sql: string) => void;
  onRun: (sql: string) => void;
  onSave: () => void;
  onOpenHistory: () => void;
  loading: boolean;
  completions?: CompletionEntry[];
}

export function QueryEditor({
  sql: sqlValue,
  onChange,
  onRun,
  onSave,
  onOpenHistory,
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
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findHasNavigated = useRef(false);
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

    const openFindCmd = (view: EditorView) => {
      openSearchPanel(view);
      setFindOpen(true);
      return true;
    };

    const completionSource = (context: CompletionContext): CompletionResult | null => {
      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      const fullText = context.state.doc.toString();
      const bounds = findStatementBounds(fullText, context.pos);
      const sel = context.state.selection.main;
      // Selection acts as an additional boundary on top of `;`. Clamping
      // composes both: a selection that spans multiple statements still
      // resolves to the statement containing the cursor.
      const stmtStart = sel.empty ? bounds.stmtStart : Math.max(bounds.stmtStart, sel.from);
      const stmtEnd = sel.empty ? bounds.stmtEnd : Math.min(bounds.stmtEnd, sel.to);
      const stmtFull = fullText.slice(stmtStart, stmtEnd);
      const beforeWord = fullText.slice(stmtStart, word.from);
      if (isInsideString(beforeWord) || isAfterStringClose(beforeWord)) return null;
      const sub = innerSubqueryContext(beforeWord, stmtFull);
      const ctx = detectSqlContext(sub?.innerBefore ?? beforeWord, sub?.innerFull ?? stmtFull);
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
        // No-op panel suppresses the default CM search UI while keeping match highlighting active.
        search({ createPanel: () => ({ dom: document.createElement('div') }) }),
        oneDark,
        Prec.high(syntaxHighlighting(snowySqlHighlight)),
        editorTheme,
        Prec.high(keymap.of([{ key: 'Enter', run: insertNewline }])),
        keymap.of([
          { key: 'Mod-f', run: openFindCmd },
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

  useEffect(() => {
    if (findOpen) findInputRef.current?.focus();
  }, [findOpen]);

  const handleFindChange = (val: string) => {
    setFindQuery(val);
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: val, caseSensitive: false })),
    });
    if (val) {
      // Navigate to first match only when the query goes from empty to non-empty,
      // so typing subsequent characters doesn't jump the cursor on every keystroke.
      if (!findHasNavigated.current) {
        findNext(view);
        findHasNavigated.current = true;
      }
      setMatchInfo(findMatchInfo(view, val));
    } else {
      findHasNavigated.current = false;
      setMatchInfo(null);
    }
  };

  const handleFindNext = useCallback(() => {
    const view = viewRef.current;
    if (!view || !findQuery) return;
    findNext(view);
    setMatchInfo(findMatchInfo(view, findQuery));
  }, [findQuery]);

  const handleFindPrev = useCallback(() => {
    const view = viewRef.current;
    if (!view || !findQuery) return;
    findPrevious(view);
    setMatchInfo(findMatchInfo(view, findQuery));
  }, [findQuery]);

  const handleFindClose = useCallback(() => {
    setFindOpen(false);
    setFindQuery('');
    setMatchInfo(null);
    findHasNavigated.current = false;
    const view = viewRef.current;
    if (view) {
      closeSearchPanel(view);
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
      view.focus();
    }
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
          onClick={onOpenHistory}
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

      {/* CodeMirror + find bar */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={containerRef} style={{ height: '100%' }} data-testid="cm-editor" />
        {findOpen && (
          <FindBar
            query={findQuery}
            onQueryChange={handleFindChange}
            onNext={handleFindNext}
            onPrev={handleFindPrev}
            onClose={handleFindClose}
            inputRef={findInputRef}
            matchInfo={matchInfo}
          />
        )}
      </div>
    </div>
  );
}
