import { ChevronRight, Clock, X } from 'lucide-react';
import type { main } from '../../wailsjs/go/models';
import { T } from '../lib/tokens';
import { fmtDuration } from '../lib/utils';

export type HistoryEntry = main.HistoryEntry;

interface HistoryDrawerProps {
  entries: HistoryEntry[];
  loading: boolean;
  onClose: () => void;
  onSelect: (sql: string) => void;
}

function relativeTime(isoStr: string): string {
  const ms = Date.now() - new Date(isoStr).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sqlSnippet(sql: string, max = 90): string {
  const trimmed = sql.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function HistoryDrawer({ entries, loading, onClose, onSelect }: HistoryDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="history-backdrop"
        onClick={onClose}
        style={{ background: 'rgba(0,0,0,0.35)' }}
        className="fixed inset-0 z-[99]"
      />

      {/* Drawer */}
      <div
        style={{
          background: T.panel,
          borderLeft: `1px solid ${T.border}`,
          boxShadow: T.shadow,
        }}
        className="fixed top-0 right-0 bottom-0 w-[420px] flex flex-col z-[100]"
      >
        {/* Header */}
        <div
          style={{ borderBottom: `1px solid ${T.border}` }}
          className="flex items-center justify-between h-11 px-4 shrink-0"
        >
          <div
            style={{ color: T.text }}
            className="flex items-center gap-2 text-[13px] font-semibold"
          >
            <Clock size={15} color={T.accent} />
            Query History
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ color: T.textDim }}
            className="flex items-center p-1 bg-transparent border-none cursor-pointer rounded"
          >
            <X size={15} />
          </button>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {loading && (
            <div style={{ color: T.textDim }} className="py-6 px-4 text-center text-xs">
              Loading…
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div style={{ color: T.textDim }} className="py-10 px-4 text-center text-xs italic">
              No history yet. Run a query to start recording.
            </div>
          )}
          {!loading &&
            entries.map((entry) => (
              <button
                type="button"
                key={entry.id}
                onClick={() => onSelect(entry.sql)}
                style={{
                  borderBottom: `1px solid ${T.divider}`,
                  fontFamily: 'inherit',
                }}
                className="block w-full text-left px-4 py-2.5 bg-transparent border-none cursor-pointer"
                onMouseEnter={(e) => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={10} color={T.textDim} />
                  <span style={{ color: T.textDim, fontFamily: T.mono }} className="text-[10px]">
                    {relativeTime(entry.executedAt)}
                  </span>
                  <span style={{ color: T.textDim }} className="text-[10px]">
                    ·
                  </span>
                  <span style={{ color: T.textDim, fontFamily: T.mono }} className="text-[10px]">
                    {entry.rowCount} rows
                  </span>
                  <span style={{ color: T.textDim }} className="text-[10px]">
                    ·
                  </span>
                  <span style={{ color: T.textDim, fontFamily: T.mono }} className="text-[10px]">
                    {fmtDuration(entry.durationMs)}
                  </span>
                  <ChevronRight size={10} color={T.textDim} className="ml-auto" />
                </div>
                <div
                  style={{ color: T.textSec, fontFamily: T.mono }}
                  className="text-[11.5px] leading-relaxed whitespace-pre-wrap break-all"
                >
                  {sqlSnippet(entry.sql)}
                </div>
              </button>
            ))}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div
            style={{ borderTop: `1px solid ${T.border}`, color: T.textDim }}
            className="px-4 py-2 text-center text-[10px] shrink-0"
          >
            {entries.length} recent entr{entries.length === 1 ? 'y' : 'ies'} · click to load into
            editor
          </div>
        )}
      </div>
    </>
  );
}
