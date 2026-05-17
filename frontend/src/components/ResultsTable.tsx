import { ChevronDown, Download, Filter, Hash, ListFilter, Pin, Type } from 'lucide-react';
import { T } from '../lib/tokens';

interface ResultsTableProps {
  // biome-ignore lint/suspicious/noExplicitAny: DB rows are untyped at the transport layer
  data: { columns: string[]; rows: any[][] } | null;
  loading: boolean;
  activeTabPinned?: boolean;
  pinActive?: boolean;
  onPin?: () => void;
  onUnpin?: (id: string) => void;
  activeTabId?: string;
  onExport?: () => void;
}

export function ResultsTable({
  data,
  loading,
  activeTabPinned,
  pinActive,
  onPin,
  onUnpin,
  activeTabId,
  onExport,
}: ResultsTableProps) {
  if (loading) {
    return (
      <div
        style={{ background: T.panel, color: T.textDim }}
        className="flex items-center justify-center h-full"
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
    );
  }

  if (!data?.rows) {
    return (
      <div
        style={{ background: T.panel, color: T.textDim, fontFamily: T.ui }}
        className="flex items-center justify-center h-full text-[13px] font-medium italic"
      >
        Execute a query to view results
      </div>
    );
  }

  return (
    <div style={{ background: T.panel }} className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        style={{
          background: T.chrome,
          borderBottom: `1px solid ${T.border}`,
        }}
        className="flex items-center h-8 px-2 gap-2 shrink-0"
      >
        <div
          style={{ color: T.textSec, borderRight: `1px solid ${T.border}` }}
          className="flex items-center gap-1 text-[11px] pr-2"
        >
          <span style={{ color: T.text }} className="font-bold">
            {data.rows.length}
          </span>{' '}
          rows
        </div>
        <button
          type="button"
          style={{ color: T.textSec }}
          className="p-1 bg-transparent border-none cursor-pointer flex items-center"
        >
          <Filter size={14} />
        </button>
        <button
          type="button"
          style={{ color: T.textSec }}
          className="p-1 bg-transparent border-none cursor-pointer flex items-center"
        >
          <ListFilter size={14} />
        </button>
        <div style={{ background: T.border }} className="w-px h-4" />
        <button
          type="button"
          onClick={onExport}
          disabled={!onExport}
          title="Export CSV"
          style={{
            cursor: onExport ? 'pointer' : 'default',
            color: onExport ? T.textSec : T.textDim,
          }}
          className="p-1 bg-transparent border-none flex items-center"
        >
          <Download size={14} />
        </button>
        <div style={{ background: T.border }} className="w-px h-4" />
        {(onPin || onUnpin) && (
          <button
            type="button"
            onClick={activeTabPinned ? () => onUnpin && activeTabId && onUnpin(activeTabId) : onPin}
            disabled={!pinActive}
            title={activeTabPinned ? 'Unpin result' : 'Pin result'}
            style={{
              color: activeTabPinned ? T.accent : pinActive ? T.textSec : T.textDim,
              background: activeTabPinned ? `${T.accent}18` : 'none',
              border: pinActive
                ? `1px solid ${activeTabPinned ? T.accent : T.border}`
                : '1px solid transparent',
              cursor: pinActive ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
            className="flex items-center gap-1 px-1.5 py-[3px] text-[10px] font-medium rounded-[3px]"
          >
            <Pin size={11} style={{ transform: activeTabPinned ? 'rotate(45deg)' : 'none' }} />
            {activeTabPinned ? 'Unpin' : 'Pin'}
          </button>
        )}
        <div
          style={{ color: T.textDim, fontFamily: T.mono }}
          className="ml-auto text-[10px] uppercase tracking-[0.4px]"
        >
          Read-only
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th
                style={{
                  background: T.gridHeader,
                  border: `1px solid ${T.border}`,
                  color: T.textDim,
                  fontFamily: T.mono,
                }}
                className="p-1 text-center text-[10px] w-10"
              >
                #
              </th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    background: T.gridHeader,
                    border: `1px solid ${T.border}`,
                    color: T.textSec,
                    fontFamily: T.ui,
                  }}
                  className="px-3 py-1 text-left text-xs font-semibold whitespace-nowrap"
                >
                  <div className="flex items-center gap-2">
                    {col.includes('id') || col.includes('price') || col.includes('at') ? (
                      <Hash size={12} style={{ color: T.accent, opacity: 0.5 }} />
                    ) : (
                      <Type size={12} style={{ color: T.textDim }} />
                    )}
                    {col}
                    <ChevronDown
                      size={10}
                      className="ml-auto opacity-0"
                      style={{ color: T.textDim }}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ fontFamily: T.mono }} className="text-xs">
            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={data.columns.length + 1}
                  style={{ color: T.textDim }}
                  className="py-8 px-4 text-center italic"
                >
                  Success. 0 rows affected.
                </td>
              </tr>
            ) : (
              data.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{ borderBottom: `1px solid ${T.divider}` }}
                  className="snowy-grid-row"
                >
                  <td
                    style={{
                      background: T.gridHeader,
                      borderRight: `1px solid ${T.border}`,
                      color: T.textDim,
                    }}
                    className="px-1 py-0.5 text-[10px] text-center select-none"
                  >
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      style={{
                        borderRight: `1px solid ${T.divider}`,
                        color: T.text,
                      }}
                      className="px-3 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[320px]"
                    >
                      {cell === null ? (
                        <span style={{ color: T.textDim }} className="italic">
                          null
                        </span>
                      ) : (
                        String(cell)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
