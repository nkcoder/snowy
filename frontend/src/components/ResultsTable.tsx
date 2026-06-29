import { ChevronDown, Download, Filter, Hash, ListFilter, Pin, Type } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { T } from '../lib/tokens';

const DEFAULT_COL_WIDTH = 160;
const MIN_COL_WIDTH = 40;

const DML_COMMANDS = new Set(['INSERT', 'UPDATE', 'DELETE']);

// Message shown when a statement returns no result rows. DML reports the affected
// count; DDL (CREATE/DROP/TRUNCATE/ALTER) just confirms execution; an empty SELECT
// (has columns) reports no rows.
function emptyResultMessage(data: {
  columns: string[];
  command?: string;
  rowsAffected?: number;
}): string {
  if (data.columns.length === 0) {
    const command = (data.command ?? '').toUpperCase();
    if (DML_COMMANDS.has(command)) {
      return `Success. ${data.rowsAffected ?? 0} rows affected.`;
    }
    return 'Statement executed.';
  }
  return 'No rows.';
}

interface ResultsTableProps {
  // biome-ignore lint/suspicious/noExplicitAny: DB rows are untyped at the transport layer
  data: { columns: string[]; rows: any[][]; rowsAffected?: number; command?: string } | null;
  truncated?: boolean;
  activeTabPinned?: boolean;
  pinActive?: boolean;
  onPin?: () => void;
  onUnpin?: (id: string) => void;
  activeTabId?: string;
  onExport?: () => void;
  filterText?: string;
  filterOpen?: boolean;
  onFilterChange?: (text: string) => void;
  onFilterToggle?: () => void;
}

export function ResultsTable({
  data,
  truncated = false,
  activeTabPinned,
  pinActive,
  onPin,
  onUnpin,
  activeTabId,
  onExport,
  filterText = '',
  filterOpen = false,
  onFilterChange,
  onFilterToggle,
}: ResultsTableProps) {
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [hoveredResizeCol, setHoveredResizeCol] = useState<number | null>(null);
  const [draggingCol, setDraggingCol] = useState<number | null>(null);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  // Refs to <th> elements for direct DOM updates during drag (no React re-render)
  const thRefs = useRef<(HTMLTableCellElement | null)[]>([]);

  useEffect(() => {
    if (data?.columns) {
      setColWidths(data.columns.map(() => DEFAULT_COL_WIDTH));
    }
  }, [data?.columns]);

  const startColDrag = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingCol(colIndex);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startW = colWidthsRef.current[colIndex] ?? DEFAULT_COL_WIDTH;
    let latest = startW;
    const onMove = (ev: MouseEvent) => {
      latest = Math.max(MIN_COL_WIDTH, startW + ev.clientX - startX);
      // Direct DOM update — bypasses React render for smooth 60fps drag
      const th = thRefs.current[colIndex];
      if (th) th.style.width = `${latest}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDraggingCol(null);
      // Commit to React state once drag ends
      const next = [...colWidthsRef.current];
      next[colIndex] = latest;
      setColWidths(next);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

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
        <button
          type="button"
          title="Toggle filter"
          onClick={onFilterToggle}
          style={{ color: filterOpen ? T.accent : T.textSec }}
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

      {/* Filter bar */}
      {filterOpen && (
        <div
          style={{
            background: T.chrome,
            borderBottom: `1px solid ${T.border}`,
          }}
          className="flex items-center gap-2 px-2 py-1 shrink-0"
        >
          <Filter size={12} style={{ color: T.accent, flexShrink: 0 }} />
          <input
            // biome-ignore lint/a11y/noAutofocus: filter bar is user-initiated via button click
            autoFocus
            type="text"
            placeholder="Filter rows…"
            value={filterText}
            onChange={(e) => onFilterChange?.(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.text,
              fontFamily: T.mono,
              fontSize: 12,
              flex: 1,
            }}
          />
          {data && (
            <span style={{ color: T.textDim, fontFamily: T.mono, fontSize: 11, flexShrink: 0 }}>
              {filterText
                ? `${
                    data.rows.filter((row) =>
                      row.some((cell) =>
                        String(cell ?? '')
                          .toLowerCase()
                          .includes(filterText.toLowerCase())
                      )
                    ).length
                  } / ${data.rows.length}`
                : `${data.rows.length}`}
            </span>
          )}
        </div>
      )}

      {/* Truncation notice */}
      {truncated && (
        <div
          style={{
            background: 'rgba(229,192,123,0.08)',
            borderBottom: `1px solid rgba(229,192,123,0.25)`,
            color: '#e5c07b',
            fontFamily: T.ui,
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-[11px] shrink-0"
        >
          <span className="font-semibold">Showing first 1,000 rows.</span>
          <span style={{ color: T.textSec }}>
            Add a LIMIT clause to your query to see fewer results.
          </span>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto min-h-0" style={{ minWidth: 0 }}>
        <table
          className="border-collapse"
          style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
        >
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th
                style={{
                  background: T.gridHeader,
                  border: `1px solid ${T.border}`,
                  color: T.textDim,
                  fontFamily: T.mono,
                  width: 40,
                }}
                className="p-1 text-center text-[10px]"
              >
                #
              </th>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  ref={(el) => {
                    thRefs.current[i] = el;
                  }}
                  style={{
                    background: T.gridHeader,
                    border: `1px solid ${T.border}`,
                    color: T.textSec,
                    fontFamily: T.ui,
                    width: colWidths[i] ?? DEFAULT_COL_WIDTH,
                    padding: 0,
                  }}
                  className="text-left text-xs font-semibold"
                >
                  {/*
                    Flex row: [content flex-1 overflow-hidden] [resize handle 5px shrink-0]
                    Avoids position:absolute inside <th> — unreliable in border-collapse tables.
                  */}
                  <div className="flex items-stretch">
                    <div className="flex items-center gap-2 px-3 py-1 overflow-hidden flex-1 min-w-0">
                      {col.includes('id') || col.includes('price') || col.includes('at') ? (
                        <Hash size={12} style={{ color: T.accent, opacity: 0.5 }} />
                      ) : (
                        <Type size={12} style={{ color: T.textDim }} />
                      )}
                      <span className="truncate">{col}</span>
                      <ChevronDown
                        size={10}
                        className="ml-auto shrink-0 opacity-0"
                        style={{ color: T.textDim }}
                      />
                    </div>
                    <div
                      onMouseDown={(e) => startColDrag(i, e)}
                      onMouseEnter={() => setHoveredResizeCol(i)}
                      onMouseLeave={() => setHoveredResizeCol(null)}
                      className="w-[10px] shrink-0 cursor-col-resize"
                      style={{
                        borderLeft: `${hoveredResizeCol === i || draggingCol === i ? 4 : 1}px solid ${hoveredResizeCol === i || draggingCol === i ? T.accent : 'transparent'}`,
                        transition: draggingCol !== null ? 'none' : 'border 0.1s ease',
                      }}
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
                  {emptyResultMessage(data)}
                </td>
              </tr>
            ) : (
              data.rows
                .map((row, originalIndex) => ({ row, originalIndex }))
                .filter(({ row }) =>
                  filterText
                    ? row.some((cell) =>
                        String(cell ?? '')
                          .toLowerCase()
                          .includes(filterText.toLowerCase())
                      )
                    : true
                )
                .map(({ row, originalIndex }) => (
                  <tr
                    key={originalIndex}
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
                      {originalIndex + 1}
                    </td>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        style={{
                          borderRight: `1px solid ${T.divider}`,
                          color: T.text,
                        }}
                        className="px-3.5 py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-0"
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
