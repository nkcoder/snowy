import React from 'react';
import { Pin, X, History, Download } from 'lucide-react';
import { ResultsTable } from './ResultsTable';

export type ResultTab = {
  id: string;
  label: string;
  data: { columns: string[]; rows: any[][] } | null;
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
  onCloseTab,
  onOpenHistory,
}: ResultsPanelProps) {
  const activeTab = resultTabs.find(t => t.id === activeResultTabId) ?? resultTabs[0] ?? null;
  const liveTab = resultTabs.find(t => !t.pinned) ?? null;
  const canPin = !!liveTab?.data && !loading;

  const handleExport = () => {
    if (!activeTab?.data) return;
    downloadCSV(activeTab.data.columns, activeTab.data.rows, `${activeTab.label}.csv`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1f22' }}>
      {/* Result tab strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        background: '#2b2d30',
        borderBottom: '1px solid #393b40',
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
                  color: isActive ? '#ecebe8' : '#a9a59d',
                  background: isActive ? '#1e1f22' : 'transparent',
                  border: 'none',
                  borderRight: '1px solid #393b40',
                  borderBottom: isActive ? '2px solid oklch(0.62 0.17 240)' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                {/* Pin icon for pinned tabs */}
                {tab.pinned && (
                  <Pin
                    size={10}
                    style={{ transform: 'rotate(45deg)', color: 'oklch(0.62 0.17 240)', flexShrink: 0 }}
                  />
                )}
                <span>{tab.label}</span>
                {/* Stats */}
                {tab.data !== null && (
                  <span style={{
                    fontSize: 10,
                    color: '#6e6a62',
                    fontFamily: '"SF Mono", ui-monospace, monospace',
                    marginLeft: 2,
                  }}>
                    {tab.rowCount} rows · {fmtDuration(tab.durationMs)}
                  </span>
                )}
                {/* Close for pinned tabs */}
                {tab.pinned && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }}
                    style={{
                      marginLeft: 2,
                      color: '#6e6a62',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderRadius: 2,
                      padding: '1px 2px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ecebe8')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#6e6a62')}
                  >
                    <X size={10} />
                  </span>
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
          borderLeft: '1px solid #393b40',
          flexShrink: 0,
        }}>
          {/* Pin button — only for live tab when it has data */}
          <button
            onClick={onPin}
            disabled={!canPin}
            title="Pin result"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 7px',
              fontSize: 10,
              fontWeight: 500,
              color: canPin ? '#a9a59d' : '#3f3d3a',
              background: 'none',
              border: canPin ? '1px solid #393b40' : '1px solid transparent',
              borderRadius: 3,
              cursor: canPin ? 'pointer' : 'default',
              fontFamily: 'inherit',
              letterSpacing: 0.2,
            }}
          >
            <Pin size={11} />
            Pin
          </button>
          <button
            onClick={onOpenHistory}
            title="Query history"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              color: '#a9a59d',
              background: 'none',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ecebe8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#a9a59d')}
          >
            <History size={13} />
          </button>
          <button
            onClick={handleExport}
            disabled={!activeTab?.data}
            title="Export CSV"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              color: activeTab?.data ? '#a9a59d' : '#3f3d3a',
              background: 'none',
              border: 'none',
              borderRadius: 3,
              cursor: activeTab?.data ? 'pointer' : 'default',
            }}
            onMouseEnter={e => { if (activeTab?.data) e.currentTarget.style.color = '#ecebe8'; }}
            onMouseLeave={e => { if (activeTab?.data) e.currentTarget.style.color = '#a9a59d'; }}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      {/* Result content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ResultsTable data={activeTab?.data ?? null} loading={loading} />
      </div>
    </div>
  );
}
