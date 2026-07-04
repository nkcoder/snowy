import { Plus, RefreshCw, Search, Settings, Square, Terminal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSidebarTree } from '../hooks/useSidebarTree';
import type { DatabaseMetadata } from '../lib/sidebarTypes';
import { T } from '../lib/tokens';
import type { Datasource } from '../types';
import { CtxMenuItem, ToolBtn } from './SidebarChrome';
import { SidebarConnectionNode } from './SidebarConnectionNode';

interface SidebarProps {
  datasources: Datasource[];
  activeDatasourceId: string | null;
  onConnect: (dsId: string) => void;
  onTableSelect: (schema: string, table: string) => void;
  onAddConnection?: () => void;
  onNewConsole?: () => void;
  onDisconnect?: () => void;
  onShowProperties?: (dsId: string) => void;
  savedQueries?: { filename: string }[];
  onLoadQuery?: (filename: string) => void;
  onDeleteQuery?: (filename: string) => void;
  onRenameQuery?: (oldFilename: string, newFilename: string) => void;
  width?: number;
  preloadedMetadata?: DatabaseMetadata | null;
  onRefreshMetadata?: () => Promise<void>;
  appVersion?: string;
  appBuildDate?: string;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({
  datasources,
  activeDatasourceId,
  onConnect,
  onTableSelect,
  onAddConnection,
  onNewConsole,
  onDisconnect,
  onShowProperties,
  savedQueries: savedQueriesProp,
  onLoadQuery,
  onDeleteQuery,
  onRenameQuery,
  width = 260,
  preloadedMetadata,
  onRefreshMetadata,
  appVersion,
  appBuildDate: _appBuildDate,
}: SidebarProps) {
  const savedQueries = savedQueriesProp ?? [];

  const {
    schemasPerDs,
    loadingDs,
    expandedDs,
    setExpandedDs,
    loadSchemas,
    handleRefreshClick,
    toggleDs,
    toggleSchema,
    toggleTable,
    toggleTableSubFolder,
    toggleColumnsFolder,
  } = useSidebarTree({ activeDatasourceId, preloadedMetadata, onRefreshMetadata });

  // ── UI state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ dsId: string; x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    const onPointer = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxMenu]);

  const ctxIsActive = ctxMenu?.dsId === activeDatasourceId;
  const closeMenu = (cb?: () => void) => {
    setCtxMenu(null);
    cb?.();
  };

  return (
    <div
      className="flex flex-col h-full shrink-0 overflow-hidden"
      style={{
        width,
        minHeight: 0,
        background: T.sidebar,
        borderRight: `0.5px solid ${T.border}`,
        fontFamily: T.ui,
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 shrink-0"
        style={{
          background: T.chrome,
          borderBottom: `0.5px solid ${T.divider}`,
        }}
      >
        <ToolBtn icon={<Plus size={13} />} title="New connection" onClick={onAddConnection} />
        <ToolBtn
          icon={<RefreshCw size={12} className={loadingDs.size > 0 ? 'animate-spin' : ''} />}
          title="Synchronize"
          onClick={() => activeDatasourceId && handleRefreshClick(activeDatasourceId)}
          disabled={!activeDatasourceId || loadingDs.size > 0}
        />
        <ToolBtn
          icon={<Square size={11} />}
          title="Disconnect"
          color={T.err}
          onClick={onDisconnect}
          disabled={!activeDatasourceId}
        />
        <div
          className="shrink-0"
          style={{ width: 1, height: 14, background: T.border, margin: '0 4px' }}
        />
        <ToolBtn
          icon={<Terminal size={13} />}
          title="New query console ⌘⇧N"
          color={T.accent}
          badge
          onClick={onNewConsole}
          disabled={!activeDatasourceId}
        />
      </div>

      {/* ── Search bar ───────────────────────────────────────────── */}
      <div className="px-2 py-1.5 shrink-0" style={{ borderBottom: `0.5px solid ${T.divider}` }}>
        <div
          className="flex items-center gap-1.5"
          style={{
            padding: '3px 8px',
            background: T.panel,
            border: `0.5px solid ${T.border}`,
            borderRadius: 4,
          }}
        >
          <Search size={11} color={T.textDim} />
          <input
            data-testid="sidebar-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter objects…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 11.5,
              color: search ? T.text : T.textDim,
              fontFamily: T.ui,
            }}
          />
          {search ? (
            <button
              type="button"
              data-testid="sidebar-search-clear"
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: T.textDim }}
              className="cursor-pointer p-0 flex items-center"
            >
              <X size={11} />
            </button>
          ) : (
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>⌘F</span>
          )}
        </div>
      </div>

      {/* ── Tree ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-1" style={{ minHeight: 0 }}>
        {datasources.length === 0 ? (
          <div
            style={{ padding: '16px 12px', color: T.textDim, fontSize: 12, fontStyle: 'italic' }}
          >
            No connections — click + to add one
          </div>
        ) : (
          [...datasources]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
            .map((ds) => (
              <SidebarConnectionNode
                key={ds.id}
                ds={ds}
                isActive={ds.id === activeDatasourceId}
                isExpanded={expandedDs.has(ds.id)}
                isLoading={loadingDs.has(ds.id)}
                schemas={schemasPerDs[ds.id] ?? []}
                search={search}
                onToggleDs={toggleDs}
                onOpenContextMenu={(dsId, x, y) => setCtxMenu({ dsId, x, y })}
                onConnect={onConnect}
                setExpandedDs={setExpandedDs}
                onTableSelect={onTableSelect}
                onToggleSchema={toggleSchema}
                onToggleTable={toggleTable}
                onToggleColumns={toggleColumnsFolder}
                onToggleSubFolder={toggleTableSubFolder}
                savedQueries={savedQueries}
                queriesOpen={queriesOpen}
                setQueriesOpen={setQueriesOpen}
                renamingFile={renamingFile}
                renameValue={renameValue}
                setRenamingFile={setRenamingFile}
                setRenameValue={setRenameValue}
                onLoadQuery={onLoadQuery}
                onDeleteQuery={onDeleteQuery}
                onRenameQuery={onRenameQuery}
              />
            ))
        )}
      </div>

      {/* ── Context menu ─────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          data-testid={`ctx-menu-${ctxMenu.dsId}`}
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 1000,
            background: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            minWidth: 160,
            padding: '4px 0',
            fontSize: 12.5,
            fontFamily: T.ui,
          }}
        >
          <CtxMenuItem
            label="Properties"
            onClick={() => closeMenu(() => onShowProperties?.(ctxMenu.dsId))}
          />
          <CtxMenuItem
            label="New Query Console"
            disabled={!ctxIsActive}
            onClick={() => closeMenu(onNewConsole)}
          />
          <CtxMenuItem
            label="Refresh"
            onClick={() =>
              closeMenu(() => {
                if (!ctxIsActive) {
                  onConnect(ctxMenu.dsId);
                  if (!onRefreshMetadata) loadSchemas(ctxMenu.dsId);
                } else {
                  handleRefreshClick(ctxMenu.dsId);
                }
              })
            }
          />
          <CtxMenuItem
            label="Disconnect"
            disabled={!ctxIsActive}
            onClick={() => closeMenu(onDisconnect)}
          />
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 shrink-0"
        style={{
          padding: '8px 10px',
          borderTop: `0.5px solid ${T.divider}`,
        }}
      >
        {appVersion && (
          <div className="flex items-baseline gap-1.5">
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: -0.2 }}>
              Snowy
            </span>
            <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, opacity: 0.7 }}>
              {appVersion}
            </span>
          </div>
        )}
        <div className="flex-1" />
        <button
          type="button"
          style={{ background: 'none', border: 'none', color: T.textDim }}
          className="cursor-pointer p-0.5 flex items-center"
        >
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
}
