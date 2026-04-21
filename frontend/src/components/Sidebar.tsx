import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Database, Table, Columns, RefreshCw, Folder } from 'lucide-react';
import * as GoApp from '../../wailsjs/go/main/App';

interface SidebarProps {
    datasourceId: string | null;
    onTableSelect: (schema: string, table: string) => void;
}

interface TreeItem {
    name: string;
    type: 'schema' | 'table' | 'column' | 'view';
    schema?: string;
    dataType?: string;
    children?: TreeItem[];
    expanded: boolean;
}

export function Sidebar({ datasourceId, onTableSelect }: SidebarProps) {
    const [tree, setTree] = useState<TreeItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (datasourceId) {
            loadSchemas();
        }
    }, [datasourceId]);

    const loadSchemas = async () => {
        if (!datasourceId) return;
        setLoading(true);
        try {
            const schemas = await GoApp.ListSchemas(datasourceId);
            const items: TreeItem[] = schemas.map(s => ({
                name: s.name,
                type: 'schema',
                children: [],
                expanded: false
            }));
            setTree(items);
        } catch (err) {
            console.error("Failed to load schemas", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleItem = async (path: number[]) => {
        const item = getItemByPath(tree, path);
        if (!item) return;

        const newTree = [...tree];
        const target = getItemByPath(newTree, path)!;

        if (target.type === 'schema' && (!target.children || target.children.length === 0)) {
            try {
                const tables = await GoApp.ListTables(datasourceId!, target.name);
                target.children = tables.map(t => ({
                    name: t.name,
                    type: t.type === 'VIEW' ? 'view' : 'table',
                    schema: target.name,
                    children: [],
                    expanded: false
                }));
            } catch (err) {
                console.error("Failed to load tables", err);
            }
        } else if ((target.type === 'table' || target.type === 'view') && (!target.children || target.children.length === 0)) {
             try {
                const columns = await GoApp.ListColumns(datasourceId!, target.schema!, target.name);
                target.children = columns.map(c => ({
                    name: c.name,
                    type: 'column',
                    dataType: c.dataType,
                    expanded: false
                }));
            } catch (err) {
                console.error("Failed to load columns", err);
            }
        }

        target.expanded = !target.expanded;
        setTree(newTree);
    };

    const getItemByPath = (items: TreeItem[], path: number[]): TreeItem | null => {
        let current: TreeItem | null = null;
        let list = items;
        for (const index of path) {
            if (index < 0 || index >= list.length) return null;
            current = list[index];
            list = current.children || [];
        }
        return current;
    };

    const renderItem = (item: TreeItem, path: number[], depth: number) => {
        const hasChildren = item.type === 'schema' || item.type === 'table' || item.type === 'view';
        let Icon = item.type === 'schema' ? Folder : (item.type === 'column' ? Columns : Table);
        let metaText = "";
        if (item.type === 'schema' && item.children?.length) metaText = String(item.children.length);
        if (item.type === 'column') metaText = item.dataType || "";

        return (
            <div key={path.join('-')} className="select-none">
                <div 
                    className={`flex items-center gap-1.5 py-0.5 px-2 hover:bg-[#323438] cursor-pointer text-[13px] group ${item.expanded ? 'text-slate-100' : 'text-slate-300'}`}
                    onClick={() => {
                        if (hasChildren) {
                            toggleItem(path);
                        }
                    }}
                    onDoubleClick={() => {
                        if (item.type === 'table' || item.type === 'view') {
                            onTableSelect(item.schema!, item.name);
                        }
                    }}
                    style={{ paddingLeft: `${depth * 14 + 6}px` }}
                >
                    <span className="w-3.5 flex items-center justify-center">
                        {hasChildren && (
                            item.expanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />
                        )}
                    </span>
                    <Icon size={14} className={item.type === 'schema' ? 'text-blue-400' : (item.type === 'column' ? 'text-slate-500' : 'text-slate-400')} />
                    <span className="truncate">{item.name}</span>
                    {metaText && (
                        <span className="text-[11px] text-slate-500 ml-auto group-hover:text-slate-400 font-mono">{metaText}</span>
                    )}
                </div>
                {item.expanded && item.children && (
                    <div>
                        {item.children.map((child, i) => renderItem(child, [...path, i], depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#2b2d30] border-r border-[#393b40] w-64 overflow-hidden">
            <div className="flex items-center justify-between px-3 h-9 border-b border-[#393b40] bg-[#2b2d30]">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Database Explorer</h2>
                <div className="flex items-center gap-2">
                    <button onClick={loadSchemas} disabled={loading} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
                {!datasourceId ? (
                    <div className="p-4 text-[12px] text-slate-500 italic">No connection active</div>
                ) : tree.length === 0 && !loading ? (
                    <div className="p-4 text-[12px] text-slate-500 italic">No schemas found</div>
                ) : (
                    tree.map((item, i) => renderItem(item, [i], 0))
                )}
            </div>
        </div>
    );
}
