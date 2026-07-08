import { Eye, FileCode2, Folder, X } from 'lucide-react';
import { type Dispatch, type SetStateAction, useState } from 'react';
import type { SchemaNode } from '../lib/sidebarTypes';
import { ENV_COLORS, T } from '../lib/tokens';
import type { Datasource } from '../types';
import { DatabaseIcon, ElephantIcon, SchemaIcon } from './SidebarIcons';
import { SidebarTableNode } from './SidebarTableNode';
import { ROW_H, TreeRow } from './TreeRow';

type SubFolderKey = 'keys' | 'foreignKeys' | 'indexes' | 'checks';

interface SidebarConnectionNodeProps {
  ds: Datasource;
  isActive: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  schemas: SchemaNode[];
  search: string;
  onToggleDs: (dsId: string) => void;
  onOpenContextMenu: (dsId: string, x: number, y: number) => void;
  onConnect: (dsId: string) => void;
  setExpandedDs: Dispatch<SetStateAction<Set<string>>>;
  onTableSelect: (schema: string, table: string) => void;
  onToggleSchema: (dsId: string, idx: number) => void;
  onToggleTable: (dsId: string, schemaIdx: number, tableIdx: number) => void;
  onToggleColumns: (dsId: string, schemaIdx: number, tableIdx: number) => void;
  onToggleSubFolder: (
    dsId: string,
    schemaIdx: number,
    tableIdx: number,
    folder: SubFolderKey
  ) => void;
  savedQueries: { filename: string }[];
  queriesOpen: boolean;
  setQueriesOpen: Dispatch<SetStateAction<boolean>>;
  renamingFile: string | null;
  renameValue: string;
  setRenamingFile: Dispatch<SetStateAction<string | null>>;
  setRenameValue: Dispatch<SetStateAction<string>>;
  onLoadQuery?: (filename: string) => void;
  onDeleteQuery?: (filename: string) => void;
  onRenameQuery?: (oldFilename: string, newFilename: string) => void;
}

export function SidebarConnectionNode({
  ds,
  isActive,
  isExpanded,
  isLoading,
  schemas,
  search,
  onToggleDs,
  onOpenContextMenu,
  onConnect,
  setExpandedDs,
  onTableSelect,
  onToggleSchema,
  onToggleTable,
  onToggleColumns,
  onToggleSubFolder,
  savedQueries,
  queriesOpen,
  setQueriesOpen,
  renamingFile,
  renameValue,
  setRenamingFile,
  setRenameValue,
  onLoadQuery,
  onDeleteQuery,
  onRenameQuery,
}: SidebarConnectionNodeProps) {
  const connColor = ENV_COLORS[ds.env] ?? T.accent;

  // Presentational fold state for the database node and the per-schema
  // tables/views group folders. These are pure UI toggles (data is already
  // loaded), so they live here rather than in the tree data model.
  const [dbOpen, setDbOpen] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const toggleFolder = (key: string) =>
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
    <div>
      {/* Connection row */}
      <TreeRow
        depth={0}
        expanded={isExpanded}
        icon={<ElephantIcon size={15} color={connColor} />}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenContextMenu(ds.id, e.clientX, e.clientY);
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
        onClick={() => onToggleDs(ds.id)}
        onDoubleClick={() => {
          if (isActive) return; // already active: no-op, preserves open tabs/results
          onConnect(ds.id);
          setExpandedDs((prev) => new Set([...prev, ds.id]));
        }}
        data-testid={`conn-node-${ds.id}`}
      />

      {/* Expanded tree */}
      {isExpanded && (
        <>
          {/* Database row — shown for all expanded connections */}
          <TreeRow
            data-testid={`db-row-${ds.id}`}
            depth={1}
            expanded={dbOpen}
            icon={<DatabaseIcon />}
            label={<span>{ds.database}</span>}
            onClick={() => setDbOpen((o) => !o)}
          />

          {dbOpen && (
            <>
              {/* Schema tree — rendered for any expanded connection, from cache */}
              {isLoading && schemas.length === 0 && (
                <div style={{ padding: '6px 32px', color: T.textDim, fontSize: 11 }}>Loading…</div>
              )}

              {!isActive && !isLoading && schemas.length === 0 && (
                <div
                  style={{
                    padding: '6px 32px',
                    color: T.textDim,
                    fontSize: 11,
                    fontStyle: 'italic',
                  }}
                >
                  Not connected — double-click to connect
                </div>
              )}

              {filteredSchemas.map((schema) => {
                const realSi = schemas.findIndex((s) => s.name === schema.name);
                return (
                  <div key={schema.name}>
                    {/* Schema row */}
                    <TreeRow
                      data-testid={`schema-row-${schema.name}`}
                      depth={2}
                      expanded={schema.expanded}
                      icon={<SchemaIcon />}
                      label={schema.name}
                      meta={schema.loaded ? schema.tables.length : undefined}
                      onClick={() => onToggleSchema(ds.id, realSi)}
                    />

                    {/* Tables folder */}
                    {schema.expanded && (
                      <>
                        {/* Tables group label */}
                        <TreeRow
                          data-testid={`folder-tables-${schema.name}`}
                          depth={3}
                          expanded={!collapsedFolders.has(`${schema.name}:tables`)}
                          icon={<Folder size={13} color={T.accent} />}
                          label={<span style={{ color: T.textSec }}>tables</span>}
                          meta={schema.tables.filter((t) => t.type === 'table').length || undefined}
                          onClick={() => toggleFolder(`${schema.name}:tables`)}
                        />
                        {!collapsedFolders.has(`${schema.name}:tables`) &&
                          schema.tables
                            .filter((t) => t.type === 'table')
                            .map((table, ti) => {
                              const realTi =
                                schemas[realSi]?.tables.findIndex((t) => t.name === table.name) ??
                                ti;
                              return (
                                <SidebarTableNode
                                  key={table.name}
                                  dsId={ds.id}
                                  schemaName={schema.name}
                                  table={table}
                                  realSi={realSi}
                                  realTi={realTi}
                                  isActive={isActive}
                                  onToggleTable={onToggleTable}
                                  onToggleColumns={onToggleColumns}
                                  onToggleSubFolder={onToggleSubFolder}
                                  onTableSelect={onTableSelect}
                                />
                              );
                            })}

                        {/* Views group */}
                        {schema.tables.some((t) => t.type === 'view') && (
                          <>
                            <TreeRow
                              data-testid={`folder-views-${schema.name}`}
                              depth={3}
                              expanded={!collapsedFolders.has(`${schema.name}:views`)}
                              icon={<Folder size={11} color={T.accent} />}
                              label={<span style={{ color: T.textSec }}>views</span>}
                              meta={
                                schema.tables.filter((t) => t.type === 'view').length || undefined
                              }
                              onClick={() => toggleFolder(`${schema.name}:views`)}
                            />
                            {!collapsedFolders.has(`${schema.name}:views`) &&
                              schema.tables
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
                                        onClick={() => onToggleTable(ds.id, realSi, realVi)}
                                        onDoubleClick={
                                          isActive
                                            ? () => onTableSelect(schema.name, view.name)
                                            : undefined
                                        }
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
                                                <span
                                                  style={{
                                                    fontFamily: T.mono,
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: T.text,
                                                  }}
                                                >
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

              {isActive && !isLoading && schemas.length === 0 && (
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

              {/* Saved queries folder (active connection only) */}
              {isActive && (
                <>
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
                              if (renameValue.trim())
                                onRenameQuery?.(q.filename, renameValue.trim());
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
        </>
      )}
    </div>
  );
}
