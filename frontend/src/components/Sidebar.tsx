import {
  ChevronDown,
  ChevronRight,
  Columns,
  Eye,
  FileCode2,
  Folder,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
  Table2,
  Terminal,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import { ENV_COLORS, T } from '../lib/tokens';
import type { Datasource } from '../types';

const ROW_H = 24;

// ── Types ────────────────────────────────────────────────────────────────────

interface PreloadedTableMetadata {
  name: string;
  type: string;
  columns: ColumnNode[];
  keys: KeyNode[];
  foreignKeys: ForeignKeyNode[];
  indexes: IndexNode[];
  checks: CheckNode[];
}

interface PreloadedSchemaMetadata {
  name: string;
  tables: PreloadedTableMetadata[];
}

interface DatabaseMetadata {
  schemas: PreloadedSchemaMetadata[];
}

interface SidebarProps {
  datasources: Datasource[];
  activeDatasourceId: string | null;
  onConnect: (dsId: string) => void;
  onTableSelect: (schema: string, table: string) => void;
  onAddConnection?: () => void;
  onNewConsole?: () => void;
  onDisconnect?: () => void;
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

interface SchemaNode {
  name: string;
  expanded: boolean;
  tables: TableNode[];
  loaded: boolean;
}

interface SubFolder<T> {
  open: boolean;
  items: T[];
  loaded: boolean;
}

interface KeyNode {
  name: string;
  columns: string;
}

interface ForeignKeyNode {
  name: string;
  columns: string;
  refSchema: string;
  refTable: string;
  refColumns: string;
}

interface IndexNode {
  name: string;
  isUnique: boolean;
  columns: string;
}

interface CheckNode {
  name: string;
  definition: string;
}

interface TableNode {
  name: string;
  type: 'table' | 'view';
  expanded: boolean;
  columns: SubFolder<ColumnNode>;
  keys: SubFolder<KeyNode>;
  foreignKeys: SubFolder<ForeignKeyNode>;
  indexes: SubFolder<IndexNode>;
  checks: SubFolder<CheckNode>;
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
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill={`${color}22`}
      />
      <circle cx="10.4" cy="6.2" r=".6" fill={color} />
    </svg>
  );
}

// ── Column type glyph ─────────────────────────────────────────────────────────
function ColIcon({ kind }: { kind?: 'pk' | 'fk' }) {
  if (kind === 'pk') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect
          x="3"
          y="4"
          width="10"
          height="8"
          rx="1"
          fill="none"
          stroke={T.warn}
          strokeWidth="1.3"
        />
        <circle cx="11" cy="5.5" r="1.4" fill={T.warn} />
      </svg>
    );
  }
  if (kind === 'fk') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <rect
          x="3"
          y="4"
          width="10"
          height="8"
          rx="1"
          fill="none"
          stroke={T.accent}
          strokeWidth="1.3"
        />
        <path d="M10 5.5l2.5 2.5L10 10.5" stroke={T.accent} strokeWidth="1.2" fill="none" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <rect
        x="3"
        y="4"
        width="10"
        height="8"
        rx="1"
        fill="none"
        stroke={T.textDim}
        strokeWidth="1.3"
      />
    </svg>
  );
}

// ── TreeRow primitive ─────────────────────────────────────────────────────────
function TreeRow({
  depth,
  expanded,
  hasChildren = true,
  icon,
  label,
  meta,
  selected,
  onClick,
  onDoubleClick,
  onContextMenu,
  badge,
  actions,
  dim = false,
  bold = false,
  small = false,
  'data-testid': testId,
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
  onContextMenu?: (e: React.MouseEvent) => void;
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
      onContextMenu={onContextMenu}
      style={{
        height: small ? 22 : ROW_H,
        paddingLeft: pad,
        paddingRight: 8,
        background: selected ? T.selected : 'transparent',
        borderLeft: `2px solid ${selected ? T.selectedBorder : 'transparent'}`,
        color: dim ? T.textDim : T.text,
        fontSize: small ? 11 : 13,
        fontWeight: bold ? 600 : selected ? 600 : 400,
        cursor: onClick ? 'pointer' : 'default',
      }}
      className={`flex items-center gap-1.5 select-none relative shrink-0 snowy-row`}
    >
      {hasChildren ? (
        <div className="flex items-center shrink-0" style={{ width: 14, color: T.textDim }}>
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </div>
      ) : (
        <div className="shrink-0" style={{ width: 14 }} />
      )}
      {icon && <div className="flex items-center shrink-0">{icon}</div>}
      <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</div>
      {meta !== undefined && (
        <div
          className="shrink-0"
          style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, marginLeft: 4 }}
        >
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
  icon,
  title,
  onClick,
  disabled,
  color,
  badge,
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
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        color: disabled ? T.textDim : color || T.textSec,
        cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
      }}
      className="relative flex items-center justify-center bg-transparent border-0 p-0 shrink-0"
    >
      {icon}
      {badge && (
        <div
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 9,
            height: 9,
            borderRadius: 5,
            background: T.accent,
            color: '#fff',
            fontSize: 8,
            fontWeight: 800,
            lineHeight: 1,
            border: `1.5px solid ${T.chrome}`,
          }}
          className="flex items-center justify-center"
        >
          +
        </div>
      )}
    </button>
  );
}

// ── Context menu item ─────────────────────────────────────────────────────────
function CtxMenuItem({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '5px 14px',
        color: disabled ? T.textDim : T.text,
        cursor: disabled ? 'default' : 'pointer',
      }}
      className={`select-none${disabled ? '' : ' snowy-row'}`}
    >
      {label}
    </div>
  );
}

// ── TableNode factory ─────────────────────────────────────────────────────────
function emptyFolder<T>(): SubFolder<T> {
  return { open: false, items: [], loaded: false };
}

function makeTableNode(name: string, type: 'table' | 'view'): TableNode {
  return {
    name,
    type,
    expanded: false,
    columns: emptyFolder(),
    keys: emptyFolder(),
    foreignKeys: emptyFolder(),
    indexes: emptyFolder(),
    checks: emptyFolder(),
  };
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

  // ── Per-datasource tree state ────────────────────────────────────────────
  const [schemasPerDs, setSchemasPerDs] = useState<Record<string, SchemaNode[]>>({});
  const [loadingDs, setLoadingDs] = useState<Set<string>>(new Set());
  const [expandedDs, setExpandedDs] = useState<Set<string>>(new Set());

  // ── UI state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [queriesOpen, setQueriesOpen] = useState(false);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ── Context menu state ────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ dsId: string; x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  // Auto-expand the active connection when it changes
  useEffect(() => {
    if (activeDatasourceId) {
      setExpandedDs((prev) => new Set([...prev, activeDatasourceId]));
    }
  }, [activeDatasourceId]);

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

  // ── Schema loading (lazy fallback) ───────────────────────────────────────
  const loadSchemas = useCallback(async (dsId: string) => {
    if (!dsId) return;
    setLoadingDs((prev) => new Set([...prev, dsId]));
    try {
      const result = await GoApp.ListSchemas(dsId);
      setSchemasPerDs((prev) => ({
        ...prev,
        [dsId]: result.map((s) => ({
          name: s.name,
          expanded: false,
          tables: [],
          loaded: false,
        })),
      }));
    } catch (err) {
      console.error('Failed to load schemas for', dsId, err);
    } finally {
      setLoadingDs((prev) => {
        const n = new Set(prev);
        n.delete(dsId);
        return n;
      });
    }
  }, []);

  // Populate full tree from preloaded metadata (cache hit or background refresh).
  // Preserves expand/open state on subsequent refreshes.
  useEffect(() => {
    if (!preloadedMetadata || !activeDatasourceId) return;
    setSchemasPerDs((prev) => {
      const existing = prev[activeDatasourceId] ?? [];
      return {
        ...prev,
        [activeDatasourceId]: preloadedMetadata.schemas.map((s) => {
          const existingSchema = existing.find((es) => es.name === s.name);
          return {
            name: s.name,
            expanded: existingSchema?.expanded ?? false,
            loaded: true,
            tables: s.tables.map((t) => {
              const existingTable = existingSchema?.tables.find((et) => et.name === t.name);
              return {
                name: t.name,
                type: (t.type === 'VIEW' ? 'view' : 'table') as 'table' | 'view',
                expanded: existingTable?.expanded ?? false,
                columns: {
                  open: existingTable?.columns.open ?? false,
                  loaded: true,
                  items: t.columns,
                },
                keys: { open: existingTable?.keys.open ?? false, loaded: true, items: t.keys },
                foreignKeys: {
                  open: existingTable?.foreignKeys.open ?? false,
                  loaded: true,
                  items: t.foreignKeys,
                },
                indexes: {
                  open: existingTable?.indexes.open ?? false,
                  loaded: true,
                  items: t.indexes,
                },
                checks: {
                  open: existingTable?.checks.open ?? false,
                  loaded: true,
                  items: t.checks,
                },
              };
            }),
          };
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedMetadata, activeDatasourceId]);

  // Fallback auto-load: only fires when App.tsx is not providing preloaded metadata
  // (i.e., in tests or standalone usage where onRefreshMetadata is absent).
  useEffect(() => {
    if (activeDatasourceId && !schemasPerDs[activeDatasourceId] && !onRefreshMetadata) {
      loadSchemas(activeDatasourceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasourceId, schemasPerDs, onRefreshMetadata, loadSchemas]);

  // handleRefreshClick: uses full metadata refresh when available, else schema-only fallback.
  const handleRefreshClick = useCallback(
    async (dsId: string) => {
      if (!dsId) return;
      setLoadingDs((prev) => new Set([...prev, dsId]));
      try {
        if (onRefreshMetadata) {
          await onRefreshMetadata();
        } else {
          await loadSchemas(dsId);
        }
      } finally {
        setLoadingDs((prev) => {
          const n = new Set(prev);
          n.delete(dsId);
          return n;
        });
      }
    },
    [onRefreshMetadata, loadSchemas]
  );

  // ── Toggle connection expansion ────────────────────────────────────────────
  const toggleDs = (dsId: string) => {
    setExpandedDs((prev) => {
      const next = new Set(prev);
      if (next.has(dsId)) {
        next.delete(dsId);
      } else {
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
        setSchemasPerDs((prev) => ({
          ...prev,
          [dsId]: (prev[dsId] ?? []).map((s, i) =>
            i !== idx
              ? s
              : {
                ...s,
                expanded: true,
                loaded: true,
                tables: tables.map((t) =>
                  makeTableNode(t.name, t.type === 'VIEW' ? 'view' : 'table')
                ),
              }
          ),
        }));
      } catch (err) {
        console.error('Failed to load tables', err);
      }
    } else {
      setSchemasPerDs((prev) => ({
        ...prev,
        [dsId]: (prev[dsId] ?? []).map((s, i) => (i !== idx ? s : { ...s, expanded: !s.expanded })),
      }));
    }
  };

  const patchTable = (
    dsId: string,
    schemaIdx: number,
    tableIdx: number,
    patch: Partial<TableNode>
  ) => {
    setSchemasPerDs((prev) => ({
      ...prev,
      [dsId]: (prev[dsId] ?? []).map((s, si) =>
        si !== schemaIdx
          ? s
          : {
            ...s,
            tables: s.tables.map((t, ti) => (ti !== tableIdx ? t : { ...t, ...patch })),
          }
      ),
    }));
  };

  const toggleTable = async (dsId: string, schemaIdx: number, tableIdx: number) => {
    const schema = schemasPerDs[dsId]?.[schemaIdx];
    const table = schema?.tables[tableIdx];
    if (!schema || !table) return;

    if (!table.expanded) {
      // Expand: auto-open columns sub-folder if not yet loaded
      patchTable(dsId, schemaIdx, tableIdx, { expanded: true });
      if (!table.columns.loaded) {
        try {
          const cols = await GoApp.ListColumns(dsId, schema.name, table.name);
          setSchemasPerDs((prev) => ({
            ...prev,
            [dsId]: (prev[dsId] ?? []).map((s, si) =>
              si !== schemaIdx
                ? s
                : {
                  ...s,
                  tables: s.tables.map((t, ti) =>
                    ti !== tableIdx
                      ? t
                      : {
                        ...t,
                        columns: {
                          open: true,
                          loaded: true,
                          items: (cols ?? []).map((c) => ({
                            name: c.name,
                            dataType: c.dataType,
                            isNullable: c.isNullable,
                            keyType: c.keyType ?? '',
                          })),
                        },
                      }
                  ),
                }
            ),
          }));
        } catch (err) {
          console.error('Failed to load columns', err);
        }
      } else {
        patchTable(dsId, schemaIdx, tableIdx, { columns: { ...table.columns, open: true } });
      }
    } else {
      patchTable(dsId, schemaIdx, tableIdx, { expanded: false });
    }
  };

  const toggleTableSubFolder = async (
    dsId: string,
    schemaIdx: number,
    tableIdx: number,
    folder: 'keys' | 'foreignKeys' | 'indexes' | 'checks'
  ) => {
    const schema = schemasPerDs[dsId]?.[schemaIdx];
    const table = schema?.tables[tableIdx];
    if (!schema || !table) return;

    const sub = table[folder];
    if (sub.open) {
      patchTable(dsId, schemaIdx, tableIdx, { [folder]: { ...sub, open: false } });
      return;
    }
    if (sub.loaded) {
      patchTable(dsId, schemaIdx, tableIdx, { [folder]: { ...sub, open: true } });
      return;
    }

    // Load data for the first time
    try {
      let items: KeyNode[] | ForeignKeyNode[] | IndexNode[] | CheckNode[] = [];
      if (folder === 'keys') {
        items = await GoApp.ListTableKeys(dsId, schema.name, table.name);
      } else if (folder === 'foreignKeys') {
        items = await GoApp.ListTableForeignKeys(dsId, schema.name, table.name);
      } else if (folder === 'indexes') {
        items = await GoApp.ListTableIndexes(dsId, schema.name, table.name);
      } else {
        items = await GoApp.ListTableChecks(dsId, schema.name, table.name);
      }
      patchTable(dsId, schemaIdx, tableIdx, {
        [folder]: { open: true, loaded: true, items: items ?? [] },
      });
    } catch (err) {
      console.error(`Failed to load ${folder}`, err);
    }
  };

  const toggleColumnsFolder = (dsId: string, schemaIdx: number, tableIdx: number) => {
    const table = schemasPerDs[dsId]?.[schemaIdx]?.tables[tableIdx];
    if (!table) return;
    patchTable(dsId, schemaIdx, tableIdx, {
      columns: { ...table.columns, open: !table.columns.open },
    });
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
      ? schemas
        .map((s) => ({
          ...s,
          expanded: true,
          tables: s.tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
        }))
        .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.tables.length > 0)
      : schemas;

    return (
      <div key={ds.id}>
        {/* Connection row */}
        <TreeRow
          depth={0}
          expanded={isExpanded}
          icon={<ElephantIcon size={15} color={connColor} />}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ dsId: ds.id, x: e.clientX, y: e.clientY });
          }}
          label={
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                {ds.name}
              </span>
            </span>
          }
          badge={
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: 0.3,
                padding: '1px 5px',
                borderRadius: 10,
                border: `0.5px solid ${T.border}`,
                color: T.textDim,
                background: T.panelAlt,
                textTransform: 'uppercase' as const,
              }}
              className="shrink-0"
            >
              {ds.env}
            </span>
          }
          actions={
            <div
              className="shrink-0"
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                marginLeft: 2,
                background: isActive ? T.ok : T.textDim,
                boxShadow: isActive ? `0 0 4px ${T.ok}` : 'none',
              }}
            />
          }
          onClick={() => {
            if (isActive) {
              toggleDs(ds.id);
            } else {
              onConnect(ds.id);
              setExpandedDs((prev) => new Set([...prev, ds.id]));
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke={T.textSec}
                  strokeWidth="1.5"
                >
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
                  <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11 }}>
                    Loading…
                  </div>
                )}

                {filteredSchemas.map((schema, _si) => {
                  const realSi = schemas.findIndex((s) => s.name === schema.name);
                  return (
                    <div key={schema.name}>
                      {/* Schema row */}
                      <TreeRow
                        data-testid={`schema-row-${schema.name}`}
                        depth={2}
                        expanded={schema.expanded}
                        icon={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke={T.accent}
                            strokeWidth="1.5"
                          >
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
                            icon={<Folder size={13} color={T.accent} />}
                            label={<span style={{ color: T.textSec }}>tables</span>}
                            meta={
                              schema.tables.filter((t) => t.type === 'table').length || undefined
                            }
                          />
                          {schema.tables
                            .filter((t) => t.type === 'table')
                            .map((table, ti) => {
                              const realTi =
                                schemas[realSi]?.tables.findIndex((t) => t.name === table.name) ??
                                ti;
                              return (
                                <div key={table.name}>
                                  <TreeRow
                                    data-testid={`table-row-${schema.name}-${table.name}`}
                                    depth={4}
                                    expanded={table.expanded}
                                    icon={<Table2 size={13} color={T.textSec} />}
                                    label={table.name}
                                    onClick={() => toggleTable(ds.id, realSi, realTi)}
                                    onDoubleClick={() => onTableSelect(schema.name, table.name)}
                                  />
                                  {table.expanded && (
                                    <>
                                      {/* columns sub-folder */}
                                      <TreeRow
                                        data-testid={`subfolder-columns-${schema.name}-${table.name}`}
                                        depth={5}
                                        expanded={table.columns.open}
                                        icon={<Columns size={13} color={T.accent} />}
                                        label={<span style={{ color: T.textSec }}>columns</span>}
                                        meta={
                                          table.columns.loaded
                                            ? table.columns.items.length || undefined
                                            : undefined
                                        }
                                        onClick={() => toggleColumnsFolder(ds.id, realSi, realTi)}
                                      />
                                      {table.columns.open &&
                                        table.columns.items.map((col) => (
                                          <TreeRow
                                            key={col.name}
                                            depth={6}
                                            hasChildren={false}
                                            icon={
                                              <ColIcon
                                                kind={col.keyType as 'pk' | 'fk' | undefined}
                                              />
                                            }
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text }}>
                                                  {col.name}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  {col.dataType}
                                                </span>
                                              </span>
                                            }
                                            dim={!col.keyType}
                                            small
                                          />
                                        ))}

                                      {/* keys sub-folder */}
                                      <TreeRow
                                        data-testid={`subfolder-keys-${schema.name}-${table.name}`}
                                        depth={5}
                                        expanded={table.keys.open}
                                        icon={
                                          <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            style={{ flexShrink: 0 }}
                                          >
                                            <circle
                                              cx="5.5"
                                              cy="8"
                                              r="3.5"
                                              stroke={T.warn}
                                              strokeWidth="1.3"
                                            />
                                            <path
                                              d="M8.5 8h5M11.5 8v2"
                                              stroke={T.warn}
                                              strokeWidth="1.3"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        }
                                        label={<span style={{ color: T.textSec }}>keys</span>}
                                        meta={
                                          table.keys.loaded
                                            ? table.keys.items.length || undefined
                                            : undefined
                                        }
                                        onClick={() =>
                                          toggleTableSubFolder(ds.id, realSi, realTi, 'keys')
                                        }
                                      />
                                      {table.keys.open &&
                                        table.keys.items.map((k) => (
                                          <TreeRow
                                            key={k.name}
                                            depth={6}
                                            hasChildren={false}
                                            icon={<ColIcon kind="pk" />}
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 12 }}>
                                                  {k.name}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  {k.columns}
                                                </span>
                                              </span>
                                            }
                                            small
                                          />
                                        ))}

                                      {/* foreign keys sub-folder */}
                                      <TreeRow
                                        data-testid={`subfolder-fk-${schema.name}-${table.name}`}
                                        depth={5}
                                        expanded={table.foreignKeys.open}
                                        icon={<ColIcon kind="fk" />}
                                        label={
                                          <span style={{ color: T.textSec }}>foreign keys</span>
                                        }
                                        meta={
                                          table.foreignKeys.loaded
                                            ? table.foreignKeys.items.length || undefined
                                            : undefined
                                        }
                                        onClick={() =>
                                          toggleTableSubFolder(ds.id, realSi, realTi, 'foreignKeys')
                                        }
                                      />
                                      {table.foreignKeys.open &&
                                        table.foreignKeys.items.map((fk) => (
                                          <TreeRow
                                            key={fk.name}
                                            depth={6}
                                            hasChildren={false}
                                            icon={<ColIcon kind="fk" />}
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 11 }}>
                                                  {fk.name}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 10.5,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  → {fk.refTable}
                                                </span>
                                              </span>
                                            }
                                            small
                                          />
                                        ))}

                                      {/* indexes sub-folder */}
                                      <TreeRow
                                        data-testid={`subfolder-indexes-${schema.name}-${table.name}`}
                                        depth={5}
                                        expanded={table.indexes.open}
                                        icon={
                                          <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            style={{ flexShrink: 0 }}
                                          >
                                            <path
                                              d="M2 4h12M4 8h8M6 12h4"
                                              stroke={T.accent}
                                              strokeWidth="1.4"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        }
                                        label={<span style={{ color: T.textSec }}>indexes</span>}
                                        meta={
                                          table.indexes.loaded
                                            ? table.indexes.items.length || undefined
                                            : undefined
                                        }
                                        onClick={() =>
                                          toggleTableSubFolder(ds.id, realSi, realTi, 'indexes')
                                        }
                                      />
                                      {table.indexes.open &&
                                        table.indexes.items.map((idx) => (
                                          <TreeRow
                                            key={idx.name}
                                            depth={6}
                                            hasChildren={false}
                                            icon={
                                              <svg
                                                width="13"
                                                height="13"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                style={{ flexShrink: 0 }}
                                              >
                                                <path
                                                  d="M2 4h12M4 8h8M6 12h4"
                                                  stroke={idx.isUnique ? T.ok : T.textDim}
                                                  strokeWidth="1.4"
                                                  strokeLinecap="round"
                                                />
                                              </svg>
                                            }
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 12 }}>
                                                  {idx.name}
                                                </span>
                                                {idx.isUnique && (
                                                  <span
                                                    style={{
                                                      fontSize: 9.5,
                                                      color: T.ok,
                                                      marginLeft: 6,
                                                      fontWeight: 600,
                                                    }}
                                                  >
                                                    UNIQUE
                                                  </span>
                                                )}
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  {idx.columns}
                                                </span>
                                              </span>
                                            }
                                            small
                                          />
                                        ))}

                                      {/* checks sub-folder */}
                                      <TreeRow
                                        data-testid={`subfolder-checks-${schema.name}-${table.name}`}
                                        depth={5}
                                        expanded={table.checks.open}
                                        icon={
                                          <svg
                                            width="13"
                                            height="13"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            style={{ flexShrink: 0 }}
                                          >
                                            <rect
                                              x="2"
                                              y="2"
                                              width="12"
                                              height="12"
                                              rx="2"
                                              stroke={T.textSec}
                                              strokeWidth="1.3"
                                            />
                                            <path
                                              d="M5 8l2 2 4-4"
                                              stroke={T.textSec}
                                              strokeWidth="1.3"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        }
                                        label={<span style={{ color: T.textSec }}>checks</span>}
                                        meta={
                                          table.checks.loaded
                                            ? table.checks.items.length || undefined
                                            : undefined
                                        }
                                        onClick={() =>
                                          toggleTableSubFolder(ds.id, realSi, realTi, 'checks')
                                        }
                                      />
                                      {table.checks.open &&
                                        table.checks.items.map((c) => (
                                          <TreeRow
                                            key={c.name}
                                            depth={6}
                                            hasChildren={false}
                                            icon={
                                              <svg
                                                width="13"
                                                height="13"
                                                viewBox="0 0 16 16"
                                                fill="none"
                                                style={{ flexShrink: 0 }}
                                              >
                                                <rect
                                                  x="2"
                                                  y="2"
                                                  width="12"
                                                  height="12"
                                                  rx="2"
                                                  stroke={T.textSec}
                                                  strokeWidth="1.3"
                                                />
                                                <path
                                                  d="M5 8l2 2 4-4"
                                                  stroke={T.textSec}
                                                  strokeWidth="1.3"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            }
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 11 }}>
                                                  {c.name}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 10.5,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  {c.definition}
                                                </span>
                                              </span>
                                            }
                                            small
                                          />
                                        ))}
                                    </>
                                  )}
                                </div>
                              );
                            })}

                          {/* Views group */}
                          {schema.tables.some((t) => t.type === 'view') && (
                            <>
                              <TreeRow
                                depth={3}
                                expanded={false}
                                icon={<Folder size={11} color={T.accent} />}
                                label={<span style={{ color: T.textSec }}>views</span>}
                                meta={
                                  schema.tables.filter((t) => t.type === 'view').length || undefined
                                }
                              />
                              {schema.tables
                                .filter((t) => t.type === 'view')
                                .map((view, vi) => {
                                  const realVi =
                                    schemas[realSi]?.tables.findIndex(
                                      (t) => t.name === view.name
                                    ) ?? vi;
                                  return (
                                    <div key={view.name}>
                                      <TreeRow
                                        data-testid={`table-row-${schema.name}-${view.name}`}
                                        depth={4}
                                        expanded={view.expanded}
                                        icon={<Eye size={13} color={T.textDim} />}
                                        label={view.name}
                                        onClick={() => toggleTable(ds.id, realSi, realVi)}
                                        onDoubleClick={() => onTableSelect(schema.name, view.name)}
                                      />
                                      {view.expanded &&
                                        view.columns.open &&
                                        view.columns.items.map((col) => (
                                          <TreeRow
                                            key={col.name}
                                            depth={5}
                                            hasChildren={false}
                                            icon={<Eye size={13} color={T.textDim} />}
                                            label={
                                              <span>
                                                <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text }}>
                                                  {col.name}
                                                </span>
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 11,
                                                    color: T.textDim,
                                                    marginLeft: 8,
                                                  }}
                                                >
                                                  {col.dataType}
                                                </span>
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
                  <div
                    style={{
                      padding: '6px 32px',
                      color: T.textDim,
                      fontSize: 11,
                      fontStyle: 'italic',
                    }}
                  >
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
                  onClick={() => setQueriesOpen((o) => !o)}
                />
                {queriesOpen && savedQueries.length === 0 && (
                  <div
                    style={{
                      padding: '4px 0 4px 54px',
                      color: T.textDim,
                      fontSize: 11,
                      fontStyle: 'italic',
                    }}
                  >
                    No saved queries
                  </div>
                )}
                {queriesOpen &&
                  savedQueries.map((q) =>
                    renamingFile === q.filename ? (
                      <div
                        key={q.filename}
                        className="flex items-center gap-1"
                        style={{ height: ROW_H, paddingLeft: 6 + 3 * 14, paddingRight: 8 }}
                      >
                        <FileCode2 size={11} color={T.warn} style={{ flexShrink: 0 }} />
                        <input
                          data-testid={`rename-input-${q.filename}`}
                          // biome-ignore lint/a11y/noAutofocus: rename inline-editor requires immediate focus
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameValue.trim()) {
                              onRenameQuery?.(q.filename, renameValue.trim());
                              setRenamingFile(null);
                            } else if (e.key === 'Escape') {
                              setRenamingFile(null);
                            }
                          }}
                          onBlur={() => {
                            if (renameValue.trim()) onRenameQuery?.(q.filename, renameValue.trim());
                            setRenamingFile(null);
                          }}
                          style={{
                            flex: 1,
                            background: T.panel,
                            border: `1px solid ${T.accent}`,
                            borderRadius: 3,
                            color: T.text,
                            fontSize: 11.5,
                            fontFamily: T.mono,
                            padding: '1px 4px',
                            outline: 'none',
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
                        label={
                          <span style={{ fontFamily: T.mono, fontSize: 11.5 }}>{q.filename}</span>
                        }
                        onClick={() => onLoadQuery?.(q.filename)}
                        onDoubleClick={() => {
                          setRenamingFile(q.filename);
                          setRenameValue(q.filename);
                        }}
                        actions={
                          <button
                            type="button"
                            data-testid={`delete-query-${q.filename}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteQuery?.(q.filename);
                            }}
                            style={{ background: 'none', border: 'none', color: T.textDim }}
                            className="cursor-pointer p-0.5 flex items-center"
                            title="Delete query"
                          >
                            <X size={10} />
                          </button>
                        }
                      />
                    )
                  )}
              </>
            )}
          </>
        )}
      </div>
    );
  };

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
          datasources.map((ds) => renderConnectionNode(ds))
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
              v{appVersion}
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
