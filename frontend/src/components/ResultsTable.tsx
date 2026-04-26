import React from 'react';
import { Filter, Download, ListFilter, Hash, Type, ChevronDown } from 'lucide-react';
import { T } from '../lib/tokens';

interface ResultsTableProps {
    data: {
        columns: string[];
        rows: any[][];
    } | null;
    loading: boolean;
}

export function ResultsTable({ data, loading }: ResultsTableProps) {
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: T.panel, color: T.textDim }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${T.accent}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, fontFamily: T.ui }}>Fetching data...</span>
                </div>
            </div>
        );
    }

    if (!data || !data.rows) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: T.panel, color: T.textDim, fontStyle: 'italic', fontSize: 13, fontWeight: 500, fontFamily: T.ui }}>
                Execute a query to view results
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.panel }}>
            {/* Table Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', height: 32, padding: '0 8px', gap: 8, borderBottom: `1px solid ${T.border}`, background: T.chrome, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.textSec, borderRight: `1px solid ${T.border}`, paddingRight: 8 }}>
                    <span style={{ fontWeight: 700, color: T.text }}>{data.rows.length}</span> rows
                </div>
                <button style={{ padding: 4, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Filter size={14} />
                </button>
                <button style={{ padding: 4, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ListFilter size={14} />
                </button>
                <div style={{ width: 1, height: 16, background: T.border }} />
                <button style={{ padding: 4, color: T.textSec, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Download size={14} />
                </button>
                <div style={{ marginLeft: 'auto', fontSize: 10, color: T.textDim, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Read-only
                </div>
            </div>

            {/* Table Grid */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                            <th style={{ padding: '4px 4px', background: T.gridHeader, border: `1px solid ${T.border}`, textAlign: 'center', fontSize: 10, color: T.textDim, fontFamily: T.mono, width: 40 }}>
                                #
                            </th>
                            {data.columns.map((col, i) => (
                                <th key={i} style={{ padding: '4px 12px', background: T.gridHeader, border: `1px solid ${T.border}`, textAlign: 'left', fontSize: 12, fontWeight: 600, color: T.textSec, whiteSpace: 'nowrap', fontFamily: T.ui }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {col.includes('id') || col.includes('price') || col.includes('at')
                                            ? <Hash size={12} style={{ color: T.accent, opacity: 0.5 }} />
                                            : <Type size={12} style={{ color: T.textDim }} />
                                        }
                                        {col}
                                        <ChevronDown size={10} style={{ marginLeft: 'auto', opacity: 0, color: T.textDim }} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody style={{ fontFamily: T.mono, fontSize: 12 }}>
                        {data.rows.length === 0 ? (
                            <tr>
                                <td colSpan={data.columns.length + 1} style={{ padding: '32px 16px', textAlign: 'center', color: T.textDim, fontStyle: 'italic' }}>
                                    Success. 0 rows affected.
                                </td>
                            </tr>
                        ) : (
                            data.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} style={{ borderBottom: `1px solid ${T.divider}` }} className="snowy-grid-row">
                                    <td style={{ padding: '2px 4px', background: T.gridHeader, borderRight: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textAlign: 'center', userSelect: 'none' }}>
                                        {rowIndex + 1}
                                    </td>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} style={{ padding: '2px 12px', borderRight: `1px solid ${T.divider}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320, color: T.text }}>
                                            {cell === null ? <span style={{ color: T.textDim, fontStyle: 'italic' }}>null</span> : String(cell)}
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
