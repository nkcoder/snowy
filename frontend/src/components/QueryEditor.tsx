import React, { useState } from 'react';
import { Play, Save, Trash2, Clock, CheckCircle2 } from 'lucide-react';

interface QueryEditorProps {
    onRun: (sql: string) => void;
    loading: boolean;
}

export function QueryEditor({ onRun, loading }: QueryEditorProps) {
    const [sql, setSql] = useState('SELECT * FROM users;');

    return (
        <div className="flex flex-col h-full bg-[#1e1f22] border-b border-[#393b40]">
            {/* Toolbar */}
            <div className="flex items-center h-9 px-2 gap-1 border-b border-[#393b40] bg-[#2b2d30]">
                <button
                    onClick={() => onRun(sql)}
                    disabled={loading || !sql.trim()}
                    className="flex items-center gap-1.5 bg-[#3574f0] hover:bg-[#4b85ff] disabled:opacity-40 text-white text-[12px] font-semibold px-2.5 py-1 rounded transition-colors shadow-sm"
                >
                    <Play size={14} fill="currentColor" />
                    Execute
                </button>
                <div className="h-4 w-[1px] bg-[#393b40] mx-1" />
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors" title="Save Query">
                    <Save size={16} />
                </button>
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors" title="Clear">
                    <Trash2 size={16} />
                </button>
                <div className="h-4 w-[1px] bg-[#393b40] mx-1" />
                <button className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#393b40] rounded transition-colors" title="History">
                    <Clock size={16} />
                </button>
                
                <div className="ml-auto flex items-center gap-4 px-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#62b543] font-medium">
                        <CheckCircle2 size={12} />
                        Connected
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">Tx: Auto</div>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Simulated Gutter */}
                <div className="w-10 bg-[#1e1f22] border-r border-[#393b40] flex flex-col items-center pt-4 text-[12px] text-slate-600 font-mono select-none">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                </div>
                
                <textarea
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    spellCheck={false}
                    className="flex-1 p-4 bg-transparent font-mono text-[13px] resize-none focus:outline-none text-[#dfe1e5] leading-relaxed selection:bg-[#2e436e]"
                    placeholder="Enter SQL query here..."
                />
            </div>
        </div>
    );
}
