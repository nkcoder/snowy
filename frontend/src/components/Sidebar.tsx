import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown,
  RefreshCw, Plus, Settings, X, Search, FileCode2,
  Square, Terminal, Eye, Folder, Table2, Columns,
} from 'lucide-react';
import * as GoApp from '../../wailsjs/go/main/App';
import { T, ENV_COLORS } from '../lib/tokens';
import type { Datasource } from '../types';

const ROW_H = 24;

// ── Types ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  datasources: Datasource[];
  activeDatasourceId: string | null;
  onConnect: (dsId: string) => void;
  onTableSelect: (schema: string, table: string) => void;
  onAddConnection?: () => void;
  onNewConsole?: () => void;
  savedQueries?: { filename: string }[];
  onLoadQuery?: (filename: string) => void;
  onDeleteQuery?: (filename: string) => void;
  onRenameQuery?: (oldFilename: string, newFilename: string) => void;
  width?: number;
}

interface SchemaNode {
  name: string;
  expanded: boolean;
  tables: TableNode[];
  loaded: boolean;
}

interface TableNode {
  name: string;
  type: 'table' | 'view';
  expanded: boolean;
  columns: ColumnNode[];
  loaded: boolean;
}

interface ColumnNode {
  name: string;
  dataType: string;
  isNullable: string;
  keyType: string;
}

// ── Postgres elephant glyph ───────────────────────────────────────────────────
function ElephantIcon({ size = 14, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M3.5 7.5c0-2.5 2-4.2 4.6-4.2 2.7 0 4.6 1.7 4.6 4 0 1.8-1 3-1 3.8l.6 1.6h-1.7l-.5-1.2c-.4.3-1 .4-1.6.4l.3 1.2H7.2l-.5-1.4c-1.1-.2-1.9-.6-2.4-1.1-.3.4-.7.6-1.1.6"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={color + '22'}
      />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

// ── Column type glyph ─────────────────────────────────────────────────────────
function ColIcon({ kind }: { kind?: 'pk' | 'fk' }) {
  if (kind === 'pk') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={T.warn} strokeWidth="1.3" />
        <circle cx="11" cy="5.5" r="1.4" fill={T.warn} />
      </svg>
    );
  }
  if (kind === 'fk') {
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={T.accent} strokeWidth="1.3" />
        <path d="M10 5.5l2.5 2.5L10 10.5" stroke={T.accent} strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="10" height="8" rx="1" fill="none" stroke={T.textDim} strokeWidth="1.3" />
    </svg>
  );
}

// ── TreeRow primitive ─────────────────────────────────────────────────────────
function TreeRow({
  depth, expanded, hasChildren = true, icon, label, meta,
  selected, onClick, onDoubleClick, badge, actions, dim = false,
  bold = false, small = false, 'data-testid': testId,
}: {
  depth: number;
  expanded?: boolean;
  hasChildren?: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  meta?: string | number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  dim?: boolean;
  bold?: boolean;
  small?: boolean;
  'data-testid'?: string;
}) {
  const pad = 6 + depth * 14;
  return (
    <div
      data-testid={testId}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        height: small ? 20 : ROW_H,
        display: 'flex', alignItems: 'center',
        paddingLeft: pad, paddingRight: 8,
        background: selected ? T.selected : 'transparent',
        borderLeft: `2px solid ${selected ? T.selectedBorder : 'transparent'}`,
        color: dim ? T.textDim : T.text,
        gap: 4,
        fontSize: small ? 10.5 : 12.5,
        fontWeight: bold ? 600 : (selected ? 600 : 400),
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        flexShrink: 0,
      }}
      className="snowy-row"
    >
      {hasChildren ? (
        <div style={{ width: 12, display: 'flex', alignItems: 'center', color: T.textDim, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </div>
      ) : (
        <div style={{ width: 12, flexShrink: 0 }} />
      )}
      {icon && <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      {meta !== undefined && (
        <div style={{ fontSize: 10.5, color: T.textDim, fontFamily: T.mono, flexShrink: 0, marginLeft: 4 }}>
          {meta}
        </div>
      )}
      {badge}
      {actions}
    </div>
  );
}

// ── Toolbar icon button ───────────────────────────────────────────────────────
function ToolBtn({
  icon, title, onClick, disabled, color, badge,
}: {
  icon: React.ReactNode;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  badge?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        width: 24, height: 24,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: disabled ? T.textDim : (color || T.textSec),
        background: 'none',
        border: 'none',
        cursor: disabled ? 'default' : (onClick ? 'pointer' : 'default'),
        padding: 0,
        flexShrink: 0,
      }}
    >
      {icon}
      {badge && (
        <div style={{
          position: 'absolute', right: -1, bottom: -1,
          width: 9, height: 9, borderRadius: 5,
          background: T.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 800, lineHeight: 1,
          border: `1.5px solid ${T.chrome}`,
        }}>+</div>
      )}
    </button>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({
  datasources,
  activeDatasourceId,
  onConnect,
  onTableSelect, onAddConnection, onNewConsole,
  savedQueries: savedQueriesProp,
  onLoadQuery, onDeleteQuery, onRenameQuery,
  width = 260,
}: SidebarProps) {
  const savedQueries = savedQueriesProp ?? [];

  // ── Per-datasource tree state ────────────────────────────────────────────
  const [schemasPerDs, setSchemasPerDs] = useState<Record<string, SchemaNode[]>>({});
  const [loadingDs, setLoadingDs] = useState<Set<string>>(new Set());
  const [expandedDs, setExpandedDs] = useState<Set<string>>(new Set());

  // ── UI state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Auto-expand the active connection when it changes
  useEffect(() => {
    if (activeDatasourceId) {
      setExpandedDs(prev => new Set([...prev, activeDatasourceId]));
    }
  }, [activeDatasourceId]);

  // ── Schema loading ────────────────────────────────────────────────────────
  const loadSchemas = useCallback(async (dsId: string) => {
    if (!dsId) return;
    setLoadingDs(prev => new Set([...prev, dsId]));
    try {
      const result = await GoApp.ListSchemas(dsId);
      setSchemasPerDs(prev => ({
        ...prev,
        [dsId]: result.map(s => ({
          name: s.name, expanded: false, tables: [], loaded: false,
        })),
      }));
    } catch (err) {
      console.error('Failed to load schemas for', dsId, err);
    } finally {
      setLoadingDs(prev => { const n = new Set(prev); n.delete(dsId); return n; });
    }
  }, []);

  // Load schemas for active connection when it changes or is expanded
  useEffect(() => {
    if (activeDatasourceId && !schemasPerDs[activeDatasourceId]) {
      loadSchemas(activeDatasourceId);
    }
  }, [activeDatasourceId, schemasPerDs, loadSchemas]);

  // ── Toggle connection expansion ────────────────────────────────────────────
  const toggleDs = (dsId: string) => {
    setExpandedDs(prev => {
      const next = new Set(prev);
      if (next.has(dsId)) { next.delete(dsId); } else {
        next.add(dsId);
        // Load schemas if not yet loaded for this connection
        if (dsId === activeDatasourceId && !schemasPerDs[dsId]) {
          loadSchemas(dsId);
        }
      }
      return next;
    });
  };

  // ── Schema toggles ─────────────────────────────────────────────────────────
  const toggleSchema = async (dsId: string, idx: number) => {
    const schemas = schemasPerDs[dsId] ?? [];
    const schema = schemas[idx];
    if (!schema) return;
    if (!schema.loaded && !schema.expanded) {
      try {
        const tables = await GoApp.ListTables(dsId, schema.name);
        setSchemasPerDs(prev => ({
          ...prev,
          [dsId]: (prev[dsId] ?? []).map((s, i) => i !== idx ? s : {
            ...s, expanded: true, loaded: true,
            tables: tables.map(t => ({
              name: t.name,
              type: t.type === 'VIEW' ? 'view' : 'table',
              expanded: false, columns: [], loaded: false,
            })),
          }),
        }));
      } catch (err) {
        console.error('Failed to load tables', err);
      }
    } else {
      setSchemasPerDs(prev => ({
        ...prev,
        [dsId]: (prev[dsId] ?? []).map((s, i) => i !== idx ? s : { ...s, expanded: !s.expanded }),
      }));
    }
  };

  const toggleTable = async (dsId: string, schemaIdx: number, tableIdx: number) => {
    const schema = schemasPerDs[dsId]?.[schemaIdx];
    const table = schema?.tables[tableIdx];
    if (!schema || !table) return;
    if (!table.loaded && !table.expanded) {
      try {
        const cols = await GoApp.ListColumns(dsId, schema.name, table.name);
        setSchemasPerDs(prev => ({
          ...prev,
          [dsId]: (prev[dsId] ?? []).map((s, si) => si !== schemaIdx ? s : {
            ...s,
            tables: s.tables.map((t, ti) => ti !== tableIdx ? t : {
              ...t, expanded: true, loaded: true,
              columns: cols.map(c => ({ name: c.name, dataType: c.dataType, isNullable: c.isNullable, keyType: c.keyType ?? '' })),
            }),
          }),
        }));
      } catch (err) {
        console.error('Failed to load columns', err);
      }
    } else {
      setSchemasPerDs(prev => ({
        ...prev,
        [dsId]: (prev[dsId] ?? []).map((s, si) => si !== schemaIdx ? s : {
          ...s,
          tables: s.tables.map((t, ti) => ti !== tableIdx ? t : { ...t, expanded: !t.expanded }),
        }),
      }));
    }
  };

  // ── Connection node renderer ────────────────────────────────────────────────
  const renderConnectionNode = (ds: Datasource) => {
    const isActive = ds.id === activeDatasourceId;
    const isExpanded = expandedDs.has(ds.id);
    const isLoading = loadingDs.has(ds.id);
    const schemas = schemasPerDs[ds.id] ?? [];
    const connColor = ENV_COLORS[ds.env] ?? T.accent;

    // Filter schemas by search
    const filteredSchemas = search.trim()
      ? schemas.map(s => ({
          ...s, expanded: true,
          tables: s.tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
        })).filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.tables.length > 0)
      : schemas;

    return (
      <div key={ds.id}>
        {/* Connection row */}
        <TreeRow
          depth={0}
          expanded={isExpanded}
          icon={<ElephantIcon size={15} color={connColor} />}
          label={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ds.name}
              </span>
            </span>
          }
          badge={
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: 0.3, padding: '1px 5px',
              borderRadius: 10, border: `0.5px solid ${T.border}`,
              color: T.textDim, background: T.panelAlt, flexShrink: 0,
              textTransform: 'uppercase' as const,
            }}>
              {ds.env}
            </span>
          }
          actions={
            <div style={{
              width: 6, height: 6, borderRadius: 3, flexShrink: 0, marginLeft: 2,
              background: isActive ? T.ok : T.textDim,
              boxShadow: isActive ? `0 0 4px ${T.ok}` : 'none',
            }} />
          }
          onClick={() => {
            if (isActive) {
              toggleDs(ds.id);
            } else {
              onConnect(ds.id);
              setExpandedDs(prev => new Set([...prev, ds.id]));
            }
          }}
          data-testid={`conn-node-${ds.id}`}
        />

        {/* Expanded tree */}
        {isExpanded && (
          <>
            {/* Database row — shown for all expanded connections */}
            <TreeRow
              depth={1}
              expanded={isActive}
              icon={
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={T.textSec} strokeWidth="1.5">
                  <ellipse cx="8" cy="4" rx="5" ry="1.8" />
                  <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
                  <path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
                </svg>
              }
              label={<span>{ds.database}</span>}
              onClick={!isActive ? () => onConnect(ds.id) : undefined}
            />

            {/* Schema tree (only for active connection) */}
            {isActive && (
              <>
                {isLoading && schemas.length === 0 && (
                  <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11 }}>Loading…</div>
                )}

                {filteredSchemas.map((schema, si) => {
                  const realSi = schemas.findIndex(s => s.name === schema.name);
                  return (
                    <div key={schema.name}>
                      {/* Schema row */}
                      <TreeRow
                        data-testid={`schema-row-${schema.name}`}
                        depth={2}
                        expanded={schema.expanded}
                        icon={
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={T.accent} strokeWidth="1.5">
                            <rect x="2" y="3" width="5" height="4" rx="1" />
                            <rect x="9" y="9" width="5" height="4" rx="1" />
                            <path d="M4.5 7v2.5a1 1 0 001 1H9" />
                          </svg>
                        }
                        label={schema.name}
                        meta={schema.loaded ? schema.tables.length : undefined}
                        onClick={() => toggleSchema(ds.id, realSi)}
                      />

                      {/* Tables folder */}
                      {schema.expanded && (
                        <>
                          {/* Tables group label */}
                          <TreeRow
                            depth={3}
                            expanded={true}
                            icon={<Folder size={11} color={T.accent} />}
                            label={<span style={{ color: T.textSec }}>tables</span>}
                            meta={schema.tables.filter(t => t.type === 'table').length || undefined}
                          />
                          {schema.tables.filter(t => t.type === 'table').map((table, ti) => {
                            const realTi = schemas[realSi]?.tables.findIndex(t => t.name === table.name) ?? ti;
                            return (
                              <div key={table.name}>
                                <TreeRow
                                  data-testid={`table-row-${schema.name}-${table.name}`}
                                  depth={4}
                                  expanded={table.expanded}
                                  icon={<Table2 size={11} color={T.textSec} />}
                                  label={
                                    <span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{table.name}</span>
                                  }
                                  onClick={() => toggleTable(ds.id, realSi, realTi)}
                                  onDoubleClick={() => onTableSelect(schema.name, table.name)}
                                />
                                {table.expanded && table.columns.map(col => (
                                  <TreeRow
                                    key={col.name}
                                    depth={5}
                                    hasChildren={false}
                                    icon={<ColIcon kind={col.keyType as 'pk' | 'fk' | undefined} />}
                                    label={
                                      <span>
                                        <span style={{ fontFamily: T.mono, fontSize: 11 }}>{col.name}</span>
                                        <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.textDim, marginLeft: 8 }}>{col.dataType}</span>
                                      </span>
                                    }
                                    dim={!col.keyType}
                                    small
                                  />
                                ))}
                              </div>
                            );
                          })}

                          {/* Views group */}
                          {schema.tables.some(t => t.type === 'view') && (
                            <>
                              <TreeRow
                                depth={3}
                                expanded={false}
                                icon={<Folder size={11} color={T.accent} />}
                                label={<span style={{ color: T.textSec }}>views</span>}
                                meta={schema.tables.filter(t => t.type === 'view').length || undefined}
                              />
                              {schema.tables.filter(t => t.type === 'view').map((view, vi) => {
                                const realVi = schemas[realSi]?.tables.findIndex(t => t.name === view.name) ?? vi;
                                return (
                                  <div key={view.name}>
                                    <TreeRow
                                      data-testid={`table-row-${schema.name}-${view.name}`}
                                      depth={4}
                                      expanded={view.expanded}
                                      icon={<Eye size={11} color={T.textDim} />}
                                      label={<span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{view.name}</span>}
                                      onClick={() => toggleTable(ds.id, realSi, realVi)}
                                      onDoubleClick={() => onTableSelect(schema.name, view.name)}
                                    />
                                    {view.expanded && view.columns.map(col => (
                                      <TreeRow
                                        key={col.name}
                                        depth={5}
                                        hasChildren={false}
                                        icon={<Eye size={10} color={T.textDim} />}
                                        label={
                                          <span>
                                            <span style={{ fontFamily: T.mono, fontSize: 11 }}>{col.name}</span>
                                            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.textDim, marginLeft: 8 }}>{col.dataType}</span>
                                          </span>
                                        }
                                        dim
                                        small
                                      />
                                    ))}
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {!isLoading && schemas.length === 0 && (
                  <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>
                    No schemas found
                  </div>
                )}

                {/* Saved queries folder (under active connection) */}
                <TreeRow
                  data-testid="folder-queries"
                  depth={2}
                  expanded={queriesOpen}
                  icon={<FileCode2 size={11} color={T.warn} />}
                  label={<span style={{ color: T.textSec }}>queries</span>}
                  meta={savedQueries.length || undefined}
                  onClick={() => setQueriesOpen(o => !o)}
                />
                {queriesOpen && savedQueries.length === 0 && (
                  <div style={{ padding: '4px 0 4px 54px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>
                    No saved queries
                  </div>
                )}
                {queriesOpen && savedQueries.map(q => (
                  renamingFile === q.filename ? (
                    <div
                      key={q.filename}
                      style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 6 + 3 * 14, paddingRight: 8, gap: 4 }}
                    >
                      <FileCode2 size={11} color={T.warn} style={{ flexShrink: 0 }} />
                      <input
                        data-testid={`rename-input-${q.filename}`}
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && renameValue.trim()) {
                            onRenameQuery?.(q.filename, renameValue.trim());
                            setRenamingFile(null);
                          } else if (e.key === 'Escape') { setRenamingFile(null); }
                        }}
                        onBlur={() => {
                          if (renameValue.trim()) onRenameQuery?.(q.filename, renameValue.trim());
                          setRenamingFile(null);
                        }}
                        style={{
                          flex: 1, background: T.panel, border: `1px solid ${T.accent}`,
                          borderRadius: 3, color: T.text, fontSize: 11.5,
                          fontFamily: T.mono, padding: '1px 4px', outline: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <TreeRow
                      key={q.filename}
                      data-testid={`query-row-${q.filename}`}
                      depth={3}
                      hasChildren={false}
                      icon={<FileCode2 size={11} color={T.warn} />}
                      label={<span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{q.filename}</span>}
                      onClick={() => onLoadQuery?.(q.filename)}
                      onDoubleClick={() => { setRenamingFile(q.filename); setRenameValue(q.filename); }}
                      actions={
                        <button
                          data-testid={`delete-query-${q.filename}`}
                          onClick={e => { e.stopPropagation(); onDeleteQuery?.(q.filename); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 2, display: 'flex', alignItems: 'center' }}
                          title="Delete query"
                        >
                          <X size={10} />
                        </button>
                      }
                    />
                  )
                ))}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: 260, flexShrink: 0,
      background: T.sidebar,
      borderRight: `0.5px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      fontFamily: T.ui,
    }}>
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div style={{
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: T.chrome,
        borderBottom: `0.5px solid ${T.divider}`,
        flexShrink: 0,
      }}>
        <ToolBtn icon={<Plus size={13} />} title="New connection" onClick={onAddConnection} />
        <ToolBtn
          icon={
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <ellipse cx="8" cy="4" rx="5" ry="1.8" />
              <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4" />
              <path d="M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
            </svg>
          }
          title="Data source properties"
        />
        <ToolBtn
          icon={<RefreshCw size={12} className={loadingDs.size > 0 ? 'animate-spin' : ''} />}
          title="Synchronize"
          onClick={() => activeDatasourceId && loadSchemas(activeDatasourceId)}
          disabled={!activeDatasourceId || loadingDs.size > 0}
        />
        <ToolBtn icon={<Square size={11} />} title="Stop" color={T.err} />
        <div style={{ width: 1, height: 14, background: T.border, margin: '0 4px', flexShrink: 0 }} />
        <ToolBtn
          icon={<Terminal size={13} />}
          title="New query console ⌘⇧N"
          color={T.accent}
          badge
          onClick={onNewConsole}
          disabled={!activeDatasourceId}
        />
        <ToolBtn
          icon={
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1" />
              <path d="M2 6.5h12M2 10h12M6 3v10M10 3v10" />
            </svg>
          }
          title="Jump to table"
        />
        <ToolBtn
          icon={<span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>DDL</span>}
          title="Show DDL"
        />
        <ToolBtn
          icon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="12" height="10" rx="1" />
              <path d="M8 3v10" />
            </svg>
          }
          title="Diagram"
        />
        <ToolBtn
          icon={
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.2" />
              <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
            </svg>
          }
          title="Preview"
        />
      </div>

      {/* ── Search bar ───────────────────────────────────────────── */}
      <div style={{ padding: '6px 8px', borderBottom: `0.5px solid ${T.divider}`, flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px',
          background: T.panel,
          border: `0.5px solid ${T.border}`,
          borderRadius: 4,
        }}>
          <Search size={11} color={T.textDim} />
          <input
            data-testid="sidebar-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter objects…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 11.5, color: search ? T.text : T.textDim,
              fontFamily: T.ui,
            }}
          />
          {search ? (
            <button
              data-testid="sidebar-search-clear"
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <X size={11} />
            </button>
          ) : (
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>⌘F</span>
          )}
        </div>
      </div>

      {/* ── Tree ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {datasources.length === 0 ? (
          <div style={{ padding: '16px 12px', color: T.textDim, fontSize: 12, fontStyle: 'italic' }}>
            No connections — click + to add one
          </div>
        ) : (
          datasources.map(ds => renderConnectionNode(ds))
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 10px',
        borderTop: `0.5px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0,
      }}>
        <button
          data-testid="sidebar-new-connection"
          onClick={onAddConnection}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: T.accent, color: '#fff',
            borderRadius: 4, fontSize: 11.5, fontWeight: 500,
            border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={11} color="#fff" /> Connections
        </button>
        <div style={{ flex: 1 }} />
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 2, display: 'flex', alignItems: 'center' }}>
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
}
