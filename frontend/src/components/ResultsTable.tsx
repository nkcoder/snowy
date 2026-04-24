import React from 'react';
import { Filter, Download, Settings, ChevronDown, ListFilter, Hash, Type } from 'lucide-react';

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
            <div className="flex items-center justify-center h-full bg-[#1e1f22] text-slate-500">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#3574f0] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-medium">Fetching data...</span>
                </div>
            </div>
        );
    }

    if (!data || !data.rows) {
        return (
            <div className="flex items-center justify-center h-full bg-[#1e1f22] text-slate-600 italic text-[13px] font-medium">
                Execute a query to view results
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#1e1f22]">
            {/* Table Toolbar */}
            <div className="flex items-center h-8 px-2 gap-2 border-b border-[#393b40] bg-[#2b2d30]">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 border-r border-[#393b40] pr-2">
                    <span className="font-bold text-slate-300">{data.rows.length}</span> rows
                </div>
                <button className="p-1 text-slate-400 hover:text-slate-200"><Filter size={14} /></button>
                <button className="p-1 text-slate-400 hover:text-slate-200"><ListFilter size={14} /></button>
                <div className="h-4 w-[1px] bg-[#393b40]" />
                <button className="p-1 text-slate-400 hover:text-slate-200"><Download size={14} /></button>
                <div className="ml-auto text-[10px] text-slate-500 font-mono uppercase tracking-tighter">Read-only</div>
            </div>

            {/* Table Grid */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="min-w-full border-collapse border-hidden">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            <th className="px-1 py-1 bg-[#2b2d30] border border-[#393b40] text-center text-[10px] text-slate-500 font-mono w-10">
                                #
                            </th>
                            {data.columns.map((col, i) => (
                                <th key={i} className="px-3 py-1 bg-[#2b2d30] border border-[#393b40] text-left text-[12px] font-semibold text-slate-300 whitespace-nowrap group">
                                    <div className="flex items-center gap-2">
                                        {col.includes('id') || col.includes('price') || col.includes('at') ? <Hash size={12} className="text-blue-500/50" /> : <Type size={12} className="text-slate-500" />}
                                        {col}
                                        <ChevronDown size={10} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-500" />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="font-mono text-[12px]">
                        {data.rows.length === 0 ? (
                            <tr>
                                <td colSpan={data.columns.length + 1} className="px-4 py-8 text-center text-slate-500 italic">
                                    Success. 0 rows affected.
                                </td>
                            </tr>
                        ) : (
                            data.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-[#2e436e]/40 group border-b border-[#2b2d30]">
                                    <td className="px-1 py-0.5 bg-[#2b2d30] border-r border-[#393b40] text-[10px] text-slate-500 text-center select-none group-hover:text-slate-300">
                                        {rowIndex + 1}
                                    </td>
                                    {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-3 py-0.5 border-r border-[#2b2d30] whitespace-nowrap overflow-hidden text-ellipsis max-w-xs text-[#dfe1e5]">
                                            {cell === null ? <span className="text-[#626469] italic">null</span> : String(cell)}
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
