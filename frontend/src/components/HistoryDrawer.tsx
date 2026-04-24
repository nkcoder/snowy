import React from 'react';
import { X, Clock, Database, ChevronRight } from 'lucide-react';

export type HistoryEntry = {
  id: string;
  sql: string;
  rowCount: number;
  durationMs: number;
  executedAt: string;
};

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
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function sqlSnippet(sql: string, max = 90): string {
  const trimmed = sql.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

export function HistoryDrawer({ entries, loading, onClose, onSelect }: HistoryDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 99,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: '#1f1d1b',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 44,
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#ecebe8' }}>
            <Clock size={15} color="oklch(0.62 0.17 240)" />
            Query History
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 5,
              color: '#6e6a62',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ecebe8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6e6a62')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }} className="custom-scrollbar">
          {loading && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6e6a62', fontSize: 12 }}>
              Loading…
            </div>
          )}
          {!loading && entries.length === 0 && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#6e6a62', fontSize: 12, fontStyle: 'italic' }}>
              No history yet. Run a query to start recording.
            </div>
          )}
          {!loading && entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => onSelect(entry.sql)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <Clock size={10} color="#6e6a62" />
                <span style={{ fontSize: 10, color: '#6e6a62', fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  {relativeTime(entry.executedAt)}
                </span>
                <span style={{ color: '#3f3d3a', fontSize: 10 }}>·</span>
                <span style={{ fontSize: 10, color: '#6e6a62', fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  {entry.rowCount} rows
                </span>
                <span style={{ color: '#3f3d3a', fontSize: 10 }}>·</span>
                <span style={{ fontSize: 10, color: '#6e6a62', fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  {fmtDuration(entry.durationMs)}
                </span>
                <ChevronRight size={10} color="#3f3d3a" style={{ marginLeft: 'auto' }} />
              </div>
              {/* SQL snippet */}
              <div style={{
                fontSize: 11.5,
                color: '#c5c2bb',
                fontFamily: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {sqlSnippet(entry.sql)}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            fontSize: 10,
            color: '#6e6a62',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            {entries.length} recent entr{entries.length === 1 ? 'y' : 'ies'} · click to load into editor
          </div>
        )}
      </div>
    </>
  );
}
