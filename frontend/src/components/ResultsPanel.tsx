import React from 'react';
import { Pin, X, History } from 'lucide-react';
import { ResultsTable } from './ResultsTable';
import { T } from '../lib/tokens';

export type ResultTab = {
  id: string;
  label: string;
  data: { columns: string[]; rows: any[][] } | null;
  error: string | null;
  rowCount: number;
  durationMs: number;
  timestamp: Date;
  pinned: boolean;
  sql: string;
};

interface ResultsPanelProps {
  resultTabs: ResultTab[];
  activeResultTabId: string | null;
  loading: boolean;
  onSelectTab: (id: string) => void;
  onPin: () => void;
  onUnpin: (id: string) => void;
  onCloseTab: (id: string) => void;
  onOpenHistory: () => void;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function downloadCSV(columns: string[], rows: any[][], filename = 'results.csv') {
  const escape = (cell: any) => {
    if (cell === null || cell === undefined) return '';
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = columns.join(',');
  const body = rows.map(r => r.map(escape).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ResultsPanel({
  resultTabs,
  activeResultTabId,
  loading,
  onSelectTab,
  onPin,
  onUnpin,
  onCloseTab,
  onOpenHistory,
}: ResultsPanelProps) {
  const activeTab = resultTabs.find(t => t.id === activeResultTabId) ?? resultTabs[0] ?? null;
  const liveTab = resultTabs.find(t => !t.pinned) ?? null;
  const canPin = !!liveTab?.data && !loading;
  const activeTabPinned = activeTab?.pinned ?? false;
  const pinActive = activeTabPinned || canPin;

  const handleExport = () => {
    if (!activeTab?.data) return;
    downloadCSV(activeTab.data.columns, activeTab.data.rows, `${activeTab.label}.csv`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.panel }}>
      {/* Result tab strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        background: T.chrome,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          {resultTabs.map(tab => {
            const isActive = tab.id === (activeResultTabId ?? resultTabs[0]?.id);
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 10px',
                  height: 32,
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? T.text : T.textSec,
                  background: isActive ? T.panel : 'transparent',
                  border: 'none',
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                {tab.pinned && (
                  <Pin
                    size={10}
                    style={{ transform: 'rotate(45deg)', color: T.accent, flexShrink: 0 }}
                  />
                )}
                <span>{tab.label}</span>
                {tab.error !== null && (
                  <span style={{ fontSize: 10, color: T.err, fontFamily: T.mono, marginLeft: 2 }}>
                    error
                  </span>
                )}
                {tab.data !== null && tab.error === null && (
                  <span style={{
                    fontSize: 10,
                    color: T.textDim,
                    fontFamily: T.mono,
                    marginLeft: 2,
                  }}>
                    {tab.rowCount} rows · {fmtDuration(tab.durationMs)}
                  </span>
                )}
                {tab.pinned && (
                  <button
                    onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
                    style={{
                      marginLeft: 2,
                      color: T.textDim,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: 2,
                      padding: '4px',
                      background: 'none',
                      border: 'none',
                      lineHeight: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Right rail actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          paddingRight: 8,
          paddingLeft: 8,
          borderLeft: `1px solid ${T.border}`,
          flexShrink: 0,
        }}>
          <button
            onClick={onOpenHistory}
            title="Query history"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              color: T.textSec,
              background: 'none',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            <History size={13} />
          </button>
        </div>
      </div>

      {/* Result content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab?.error ? (
          <div style={{
            padding: '14px 18px',
            fontFamily: T.mono,
            fontSize: 12,
            color: T.err,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.6,
          }}>
            {activeTab.error}
          </div>
        ) : (
          <ResultsTable
            data={activeTab?.data ?? null}
            loading={loading}
            activeTabPinned={activeTabPinned}
            pinActive={pinActive}
            onPin={onPin}
            onUnpin={onUnpin}
            activeTabId={activeTab?.id}
            onExport={activeTab?.data ? handleExport : undefined}
          />
        )}
      </div>
    </div>
  );
}
