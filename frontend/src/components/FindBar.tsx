import type { EditorView } from '@codemirror/view';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { T } from '../lib/tokens';

export interface MatchInfo {
  current: number;
  total: number;
}

export interface FindBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  matchInfo?: MatchInfo | null;
}

export function findMatchInfo(view: EditorView, searchStr: string): MatchInfo | null {
  if (!searchStr) return null;
  const docText = view.state.doc.toString();
  const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let re: RegExp;
  try {
    re = new RegExp(escaped, 'gi');
  } catch {
    return null;
  }
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  for (;;) {
    m = re.exec(docText);
    if (m === null) break;
    starts.push(m.index);
    if (m[0].length === 0) re.lastIndex++;
  }
  const total = starts.length;
  if (total === 0) return { current: 0, total: 0 };
  const selFrom = view.state.selection.main.from;
  const idx = starts.indexOf(selFrom);
  return { current: idx === -1 ? 0 : idx + 1, total };
}

export function FindBar({
  query,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
  inputRef,
  matchInfo,
}: FindBarProps) {
  return (
    <div
      data-testid="find-bar"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: T.chrome,
        border: `1px solid ${T.border}`,
        borderRadius: 6,
        padding: '3px 4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      <input
        ref={inputRef}
        data-testid="find-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            onNext();
            e.preventDefault();
          } else if (e.key === 'Enter' && e.shiftKey) {
            onPrev();
            e.preventDefault();
          } else if (e.key === 'Escape') {
            onClose();
          }
        }}
        placeholder="Find…"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        style={{
          background: T.panel,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          color: T.text,
          fontFamily: T.mono,
          fontSize: 12,
          padding: '2px 6px',
          width: 160,
          outline: 'none',
        }}
      />
      {matchInfo != null && (
        <span
          data-testid="find-match-count"
          style={{
            fontSize: 11,
            color: matchInfo.total === 0 ? T.err : T.textDim,
            minWidth: 52,
            textAlign: 'center',
            padding: '0 4px',
            whiteSpace: 'nowrap',
          }}
        >
          {matchInfo.total === 0 ? 'No matches' : `${matchInfo.current} of ${matchInfo.total}`}
        </span>
      )}
      <button
        type="button"
        data-testid="find-prev"
        onClick={onPrev}
        disabled={!query}
        title="Previous match (Shift+Enter)"
        style={{
          color: T.textDim,
          background: 'none',
          border: 'none',
          cursor: query ? 'pointer' : 'default',
          padding: '2px 3px',
          borderRadius: 3,
        }}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        data-testid="find-next"
        onClick={onNext}
        disabled={!query}
        title="Next match (Enter)"
        style={{
          color: T.textDim,
          background: 'none',
          border: 'none',
          cursor: query ? 'pointer' : 'default',
          padding: '2px 3px',
          borderRadius: 3,
        }}
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        data-testid="find-close"
        onClick={onClose}
        title="Close (Esc)"
        style={{
          color: T.textDim,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 3,
          marginLeft: 2,
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
