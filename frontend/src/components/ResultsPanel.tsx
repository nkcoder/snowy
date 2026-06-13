import { History, PanelBottomClose, PanelBottomOpen, Pin, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ExportCSV } from '../../wailsjs/go/main/App';
import { T } from '../lib/tokens';
import { ResultsTable } from './ResultsTable';

export type ResultTab = {
  id: string;
  label: string;
  // biome-ignore lint/suspicious/noExplicitAny: DB rows are untyped at the transport layer
  data: { columns: string[]; rows: any[][] } | null;
  error: string | null;
  rowCount: number;
  durationMs: number;
  truncated: boolean;
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
  onTogglePanel: () => void;
  bottomVisible: boolean;
  collapsed: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: CSV cells can be any DB value
function buildCSV(columns: string[], rows: any[][]): string {
  const escapeCsvCell = (cell: unknown) => {
    if (cell === null || cell === undefined) return '';
    const s = String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  // biome-ignore lint/suspicious/noExplicitAny: rows are untyped DB values
  const body = rows.map((r: any[]) => r.map(escapeCsvCell).join(',')).join('\n');
  return `${columns.join(',')}\n${body}`;
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
  onTogglePanel,
  bottomVisible,
  collapsed,
}: ResultsPanelProps) {
  const activeTab = resultTabs.find((t) => t.id === activeResultTabId) ?? resultTabs[0] ?? null;
  const liveTab = resultTabs.find((t) => !t.pinned) ?? null;
  const canPin = !!liveTab?.data && !loading;
  const activeTabPinned = activeTab?.pinned ?? false;
  const pinActive = activeTabPinned || canPin;

  // Per-tab filter state keyed by tab id
  const [filterTextByTab, setFilterTextByTab] = useState<Record<string, string>>({});
  const [filterOpenByTab, setFilterOpenByTab] = useState<Record<string, boolean>>({});
  const tabId = activeTab?.id;
  const filterText = tabId ? (filterTextByTab[tabId] ?? '') : '';
  const filterOpen = tabId ? (filterOpenByTab[tabId] ?? false) : false;

  // Reset filter only when the SAME tab gets a new query result (timestamp changes).
  // A ref tracks the last-seen timestamp per tab so tab-switching doesn't clear filter state.
  const seenTimestampByTab = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!tabId) return;
    const ts = activeTab?.timestamp?.toISOString() ?? '';
    const prev = seenTimestampByTab.current[tabId] ?? '';
    if (prev && prev !== ts) {
      setFilterTextByTab((p) => ({ ...p, [tabId]: '' }));
      setFilterOpenByTab((p) => ({ ...p, [tabId]: false }));
    }
    seenTimestampByTab.current[tabId] = ts;
  }, [activeTab?.timestamp, tabId]);

  const handleFilterToggle = () => {
    if (!tabId) return;
    setFilterOpenByTab((prev) => {
      const next = !prev[tabId];
      if (!next) setFilterTextByTab((p) => ({ ...p, [tabId]: '' }));
      return { ...prev, [tabId]: next };
    });
  };

  const handleFilterChange = (text: string) => {
    if (!tabId) return;
    setFilterTextByTab((prev) => ({ ...prev, [tabId]: text }));
  };

  const handleExport = () => {
    if (!activeTab?.data) return;
    ExportCSV(buildCSV(activeTab.data.columns, activeTab.data.rows), `${activeTab.label}.csv`);
  };

  return (
    <div style={{ background: T.panel }} className="flex flex-col h-full relative">
      {/* Result tab strip */}
      <div
        style={{
          background: T.chrome,
          borderBottom: `1px solid ${T.border}`,
        }}
        className="flex items-center h-8 shrink-0 min-w-0 overflow-hidden"
      >
        {/* Tabs */}
        <div className="flex items-center flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
          {resultTabs.map((tab) => {
            const isActive = tab.id === (activeResultTabId ?? resultTabs[0]?.id);
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                style={{
                  color: isActive ? T.text : T.textSec,
                  background: isActive ? T.panel : 'transparent',
                  borderRight: `1px solid ${T.border}`,
                  borderBottom: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontFamily: 'inherit',
                }}
                className="flex items-center gap-1 px-2.5 h-8 text-[11px] border-none cursor-pointer whitespace-nowrap shrink-0"
              >
                {tab.pinned && (
                  <Pin
                    size={10}
                    style={{ transform: 'rotate(45deg)', color: T.accent }}
                    className="shrink-0"
                  />
                )}
                <span>{tab.label}</span>
                {tab.error !== null && (
                  <span style={{ color: T.err, fontFamily: T.mono }} className="text-[10px] ml-0.5">
                    error
                  </span>
                )}
                {tab.pinned && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    style={{ color: T.textDim }}
                    className="ml-0.5 flex items-center cursor-pointer rounded-[2px] p-1 bg-transparent border-none leading-none"
                  >
                    <X size={10} />
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {/* Right rail */}
        <div
          style={{ borderLeft: `1px solid ${T.border}` }}
          className="flex items-center gap-0.5 px-2 shrink-0"
        >
          <button
            type="button"
            data-testid="results-toggle"
            onClick={onTogglePanel}
            title={bottomVisible ? 'Hide results panel' : 'Show results panel'}
            style={{ color: bottomVisible ? T.textSec : T.textDim }}
            className="flex items-center p-1 bg-transparent border-none rounded-[3px] cursor-pointer"
          >
            {bottomVisible ? <PanelBottomClose size={13} /> : <PanelBottomOpen size={13} />}
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            title="Query history"
            style={{ color: T.textSec }}
            className="flex items-center p-1 bg-transparent border-none rounded-[3px] cursor-pointer"
          >
            <History size={13} />
          </button>
        </div>
      </div>

      {/* Content — absolutely fills the panel below the tab strip (top 32px = h-8).
           Absolute layout avoids the flex percentage-height chain that caused scroll to break. */}
      {!collapsed && (
        <div
          className="overflow-hidden"
          style={{ position: 'absolute', top: 32, left: 0, right: 0, bottom: 0 }}
        >
          {activeTab?.error ? (
            <div
              style={{ color: T.err, fontFamily: T.mono }}
              className="px-[18px] py-3.5 text-xs whitespace-pre-wrap break-words leading-relaxed overflow-auto h-full"
            >
              {activeTab.error}
            </div>
          ) : (
            <ResultsTable
              data={activeTab?.data ?? null}
              truncated={activeTab?.truncated ?? false}
              activeTabPinned={activeTabPinned}
              pinActive={pinActive}
              onPin={onPin}
              onUnpin={onUnpin}
              activeTabId={activeTab?.id}
              onExport={activeTab?.data ? handleExport : undefined}
              filterText={filterText}
              filterOpen={filterOpen}
              onFilterChange={handleFilterChange}
              onFilterToggle={handleFilterToggle}
            />
          )}
          {/* Overlay is rendered after content in the tree so it sits on top in the
             stacking context (no z-index needed). The spinner is always centred in
             the visible panel regardless of scroll position. */}
          {loading && (
            <div
              style={{ background: T.overlay, color: T.textDim }}
              className="absolute inset-0 flex items-center justify-center"
              data-testid="fetching-overlay"
              role="status"
              aria-label="Fetching data"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3">
                <div
                  style={{ border: `2px solid ${T.accent}`, borderTopColor: 'transparent' }}
                  className="w-8 h-8 rounded-full animate-spin"
                />
                <span style={{ fontFamily: T.ui }} className="text-xs font-medium">
                  Fetching data...
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
