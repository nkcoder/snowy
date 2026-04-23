import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Database, Table2, Columns,
  RefreshCw, Plus, Settings, X, Search, FileCode2,
  Eye, BarChart2, ArrowUpRight,
} from 'lucide-react';
import * as GoApp from '../../wailsjs/go/main/App';
import { T } from '../lib/tokens';

const ROW_H = 24; // px height for each tree row

// ── Types ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  datasourceId: string | null;
  datasourceName?: string;
  datasourceDb?: string;
  onTableSelect: (schema: string, table: string) => void;
  onAddConnection?: () => void;
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
}

// ── Row component ─────────────────────────────────────────────────────────────
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
      {/* Chevron */}
      {hasChildren ? (
        <div style={{ width: 12, display: 'flex', alignItems: 'center', color: T.textDim, flexShrink: 0 }}>
          {expanded
            ? <ChevronDown size={10} />
            : <ChevronRight size={10} />
          }
        </div>
      ) : (
        <div style={{ width: 12, flexShrink: 0 }} />
      )}

      {/* Icon */}
      {icon && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}

      {/* Label */}
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>

      {/* Meta (right-aligned count / type) */}
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

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({ datasourceId, datasourceName, datasourceDb, onTableSelect, onAddConnection }: SidebarProps) {
  const [schemas, setSchemas] = useState<SchemaNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Folder expanded state (queries/schemas/views/reports)
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [schemasOpen, setSchemasOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const loadSchemas = useCallback(async () => {
    if (!datasourceId) return;
    setLoading(true);
    try {
      const result = await GoApp.ListSchemas(datasourceId);
      setSchemas(result.map(s => ({
        name: s.name,
        expanded: false,
        tables: [],
        loaded: false,
      })));
    } catch (err) {
      console.error('Failed to load schemas', err);
    } finally {
      setLoading(false);
    }
  }, [datasourceId]);

  useEffect(() => {
    setSchemas([]);
    setSearch('');
    if (datasourceId) loadSchemas();
  }, [datasourceId, loadSchemas]);

  // ── Expand a schema → load its tables ──
  const toggleSchema = async (idx: number) => {
    const schema = schemas[idx];
    if (!schema.loaded && !schema.expanded) {
      // Load tables
      try {
        const tables = await GoApp.ListTables(datasourceId!, schema.name);
        setSchemas(prev => prev.map((s, i) => i !== idx ? s : {
          ...s,
          expanded: true,
          loaded: true,
          tables: tables.map(t => ({
            name: t.name,
            type: t.type === 'VIEW' ? 'view' : 'table',
            expanded: false,
            columns: [],
            loaded: false,
          })),
        }));
      } catch (err) {
        console.error('Failed to load tables', err);
      }
    } else {
      setSchemas(prev => prev.map((s, i) => i !== idx ? s : { ...s, expanded: !s.expanded }));
    }
  };

  // ── Expand a table → load its columns ──
  const toggleTable = async (schemaIdx: number, tableIdx: number) => {
    const schema = schemas[schemaIdx];
    const table = schema.tables[tableIdx];
    if (!table.loaded && !table.expanded) {
      try {
        const cols = await GoApp.ListColumns(datasourceId!, schema.name, table.name);
        setSchemas(prev => prev.map((s, si) => si !== schemaIdx ? s : {
          ...s,
          tables: s.tables.map((t, ti) => ti !== tableIdx ? t : {
            ...t,
            expanded: true,
            loaded: true,
            columns: cols.map(c => ({ name: c.name, dataType: c.dataType, isNullable: c.isNullable })),
          }),
        }));
      } catch (err) {
        console.error('Failed to load columns', err);
      }
    } else {
      setSchemas(prev => prev.map((s, si) => si !== schemaIdx ? s : {
        ...s,
        tables: s.tables.map((t, ti) => ti !== tableIdx ? t : { ...t, expanded: !t.expanded }),
      }));
    }
  };

  // ── Filtered schemas for search ──
  const filteredSchemas = search.trim()
    ? schemas.map(s => ({
        ...s,
        expanded: true,
        tables: s.tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
      })).filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.tables.length > 0)
    : schemas;

  // ── Views count (tables of type 'view' across all schemas) ──
  const viewsCount = schemas.reduce((n, s) => n + s.tables.filter(t => t.type === 'view').length, 0);

  return (
    <div style={{
      width: 260, flexShrink: 0,
      background: T.sidebar,
      borderRight: `0.5px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
      height: '100%',
      fontFamily: T.ui,
    }}>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div style={{ padding: '8px 10px 6px', borderBottom: `0.5px solid ${T.divider}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px',
          background: T.panel,
          border: `0.5px solid ${T.border}`,
          borderRadius: 5,
        }}>
          <Search size={12} color={T.textDim} />
          <input
            data-testid="sidebar-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find anything…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: search ? T.text : T.textDim,
              fontFamily: T.ui,
            }}
          />
          {search ? (
            <button data-testid="sidebar-search-clear" onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 0, display: 'flex', alignItems: 'center' }}>
              <X size={11} />
            </button>
          ) : (
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim, padding: '1px 4px', background: T.hover, borderRadius: 3 }}>⌘K</span>
          )}
        </div>
      </div>

      {/* ── Tree ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {!datasourceId ? (
          <div style={{ padding: '16px 12px', color: T.textDim, fontSize: 12, fontStyle: 'italic' }}>
            No connection active
          </div>
        ) : (
          <>
            {/* Connection row */}
            <TreeRow
              depth={0}
              expanded={true}
              icon={<Database size={13} color={T.accent} />}
              label={
                <span>
                  <span style={{ color: T.text, fontWeight: 600 }}>{datasourceName ?? 'Connected'}</span>
                  {datasourceDb && (
                    <span style={{ color: T.textDim, fontFamily: T.mono, fontSize: 10.5, marginLeft: 6 }}>
                      {datasourceDb}
                    </span>
                  )}
                </span>
              }
              selected
              actions={
                <button
                  data-testid="btn-refresh-schemas"
                  onClick={e => { e.stopPropagation(); loadSchemas(); }}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 2, display: 'flex', alignItems: 'center' }}
                  title="Refresh"
                >
                  <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                </button>
              }
            />

            {/* ── queries folder ─────────────────────────────────── */}
            <TreeRow
              data-testid="folder-queries"
              depth={1}
              expanded={queriesOpen}
              icon={<FileCode2 size={12} color={T.warn} />}
              label={<span style={{ color: T.textSec }}>queries</span>}
              meta={0}
              bold
              onClick={() => setQueriesOpen(o => !o)}
              actions={
                <div style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec }}>
                  <Plus size={10} />
                </div>
              }
            />
            {queriesOpen && (
              <div style={{ padding: '4px 0 4px 32px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>
                Saved queries — Sprint 3
              </div>
            )}

            {/* ── schemas folder ─────────────────────────────────── */}
            <TreeRow
              data-testid="folder-schemas"
              depth={1}
              expanded={schemasOpen}
              icon={<Database size={12} color={T.accent} />}
              label={<span style={{ color: T.textSec }}>schemas</span>}
              meta={schemas.length || undefined}
              bold
              onClick={() => setSchemasOpen(o => !o)}
            />
            {schemasOpen && (
              <>
                {loading && schemas.length === 0 && (
                  <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11 }}>Loading…</div>
                )}
                {filteredSchemas.map((schema, si) => (
                  <div key={schema.name}>
                    {/* Schema row */}
                    <TreeRow
                      data-testid={`schema-row-${schema.name}`}
                      depth={2}
                      expanded={schema.expanded}
                      icon={<Database size={11} color={T.textSec} />}
                      label={schema.name}
                      meta={schema.loaded ? schema.tables.length : undefined}
                      onClick={() => toggleSchema(schemas.findIndex(s => s.name === schema.name))}
                    />
                    {/* Tables under schema */}
                    {schema.expanded && schema.tables.map((table, ti) => {
                      const realSchemaIdx = schemas.findIndex(s => s.name === schema.name);
                      const isView = table.type === 'view';
                      return (
                        <div key={table.name}>
                          <TreeRow
                            data-testid={`table-row-${schema.name}-${table.name}`}
                            depth={3}
                            expanded={table.expanded}
                            icon={
                              isView
                                ? <Eye size={11} color={T.textDim} />
                                : <Table2 size={11} color={T.textDim} />
                            }
                            label={
                              <span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{table.name}</span>
                            }
                            onClick={() => toggleTable(realSchemaIdx, ti)}
                            onDoubleClick={() => onTableSelect(schema.name, table.name)}
                          />
                          {/* Columns */}
                          {table.expanded && table.columns.map(col => (
                            <TreeRow
                              key={col.name}
                              depth={4}
                              hasChildren={false}
                              icon={<Columns size={10} color={T.textDim} />}
                              label={
                                <span style={{ fontFamily: T.mono, fontSize: 11 }}>{col.name}</span>
                              }
                              meta={col.dataType}
                              dim
                              small
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {!loading && schemas.length === 0 && (
                  <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>No schemas found</div>
                )}
              </>
            )}

            {/* ── views folder ───────────────────────────────────── */}
            <TreeRow
              data-testid="folder-views"
              depth={1}
              expanded={viewsOpen}
              icon={<Eye size={12} color={T.textSec} />}
              label={<span style={{ color: T.textDim }}>views</span>}
              meta={viewsCount || undefined}
              dim
              onClick={() => setViewsOpen(o => !o)}
            />
            {viewsOpen && viewsCount === 0 && (
              <div style={{ padding: '4px 0 4px 40px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>
                {schemas.some(s => s.loaded) ? 'No views found' : 'Expand schemas to load views'}
              </div>
            )}
            {viewsOpen && viewsCount > 0 && schemas.map(schema =>
              schema.tables.filter(t => t.type === 'view').map(view => (
                <TreeRow
                  key={`${schema.name}.${view.name}`}
                  data-testid={`view-row-${schema.name}-${view.name}`}
                  depth={2}
                  hasChildren={false}
                  icon={<Eye size={11} color={T.textDim} />}
                  label={
                    <span>
                      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim }}>{schema.name}.</span>
                      <span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{view.name}</span>
                    </span>
                  }
                  onDoubleClick={() => onTableSelect(schema.name, view.name)}
                  dim
                />
              ))
            )}

            {/* ── reports / exports (low priority, collapsed) ─────── */}
            <TreeRow
              depth={1}
              expanded={reportsOpen}
              icon={<BarChart2 size={12} color={T.textDim} />}
              label={<span style={{ color: T.textDim }}>reports</span>}
              dim
              onClick={() => setReportsOpen(o => !o)}
            />
            {reportsOpen && (
              <div style={{ padding: '4px 0 4px 40px', color: T.textDim, fontSize: 11, fontStyle: 'italic' }}>
                Coming soon
              </div>
            )}
            <TreeRow
              depth={1}
              expanded={false}
              icon={<ArrowUpRight size={12} color={T.textDim} />}
              label={<span style={{ color: T.textDim }}>exports</span>}
              dim
            />
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 10px',
        borderTop: `0.5px solid ${T.divider}`,
        display: 'flex', alignItems: 'center', gap: 6,
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
          <Plus size={11} color="#fff" /> New connection
        </button>
        <div style={{ flex: 1 }} />
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 2, display: 'flex', alignItems: 'center' }}>
          <Settings size={13} />
        </button>
      </div>
    </div>
  );
}
