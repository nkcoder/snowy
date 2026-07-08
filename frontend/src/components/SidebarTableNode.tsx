import { Columns, Table2 } from 'lucide-react';
import type { TableNode } from '../lib/sidebarTypes';
import { T } from '../lib/tokens';
import { CheckIcon, ColIcon, IndexIcon, KeysIcon } from './SidebarIcons';
import { TreeRow } from './TreeRow';

type SubFolderKey = 'keys' | 'foreignKeys' | 'indexes' | 'checks';

interface SidebarTableNodeProps {
  dsId: string;
  schemaName: string;
  table: TableNode;
  realSi: number;
  realTi: number;
  isActive: boolean;
  onToggleTable: (dsId: string, schemaIdx: number, tableIdx: number) => void;
  onToggleColumns: (dsId: string, schemaIdx: number, tableIdx: number) => void;
  onToggleSubFolder: (
    dsId: string,
    schemaIdx: number,
    tableIdx: number,
    folder: SubFolderKey
  ) => void;
  onTableSelect: (schema: string, table: string) => void;
}

export function SidebarTableNode({
  dsId,
  schemaName,
  table,
  realSi,
  realTi,
  isActive,
  onToggleTable,
  onToggleColumns,
  onToggleSubFolder,
  onTableSelect,
}: SidebarTableNodeProps) {
  return (
    <div>
      <TreeRow
        data-testid={`table-row-${schemaName}-${table.name}`}
        depth={4}
        expanded={table.expanded}
        icon={<Table2 size={13} color={T.textSec} />}
        label={table.name}
        onClick={() => onToggleTable(dsId, realSi, realTi)}
        onDoubleClick={isActive ? () => onTableSelect(schemaName, table.name) : undefined}
      />
      {table.expanded && (
        <>
          {/* columns sub-folder */}
          <TreeRow
            data-testid={`subfolder-columns-${schemaName}-${table.name}`}
            depth={5}
            expanded={table.columns.open}
            icon={<Columns size={13} color={T.accent} />}
            label={<span style={{ color: T.textSec }}>columns</span>}
            meta={table.columns.loaded ? table.columns.items.length || undefined : undefined}
            onClick={() => onToggleColumns(dsId, realSi, realTi)}
          />
          {table.columns.open &&
            table.columns.items.map((col) => (
              <TreeRow
                key={col.name}
                depth={6}
                hasChildren={false}
                icon={<ColIcon kind={col.keyType as 'pk' | 'fk' | undefined} />}
                label={
                  <span>
                    <span
                      style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.text }}
                    >
                      {col.name}
                    </span>
                    <span
                      style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginLeft: 8 }}
                    >
                      {col.dataType}
                    </span>
                    {col.default && (
                      <span
                        style={{
                          fontFamily: T.mono,
                          fontSize: 11,
                          color: T.textDim,
                          marginLeft: 6,
                          opacity: 0.7,
                        }}
                      >
                        = {col.default}
                      </span>
                    )}
                  </span>
                }
                dim={!col.keyType}
                small
              />
            ))}

          {/* keys sub-folder */}
          <TreeRow
            data-testid={`subfolder-keys-${schemaName}-${table.name}`}
            depth={5}
            expanded={table.keys.open}
            icon={<KeysIcon />}
            label={<span style={{ color: T.textSec }}>keys</span>}
            meta={table.keys.loaded ? table.keys.items.length || undefined : undefined}
            onClick={() => onToggleSubFolder(dsId, realSi, realTi, 'keys')}
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
                    <span style={{ fontFamily: T.mono, fontSize: 12 }}>{k.name}</span>
                    <span
                      style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginLeft: 8 }}
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
            data-testid={`subfolder-fk-${schemaName}-${table.name}`}
            depth={5}
            expanded={table.foreignKeys.open}
            icon={<ColIcon kind="fk" />}
            label={<span style={{ color: T.textSec }}>foreign keys</span>}
            meta={
              table.foreignKeys.loaded ? table.foreignKeys.items.length || undefined : undefined
            }
            onClick={() => onToggleSubFolder(dsId, realSi, realTi, 'foreignKeys')}
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
                    <span style={{ fontFamily: T.mono, fontSize: 11 }}>{fk.name}</span>
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
            data-testid={`subfolder-indexes-${schemaName}-${table.name}`}
            depth={5}
            expanded={table.indexes.open}
            icon={<IndexIcon color={T.accent} />}
            label={<span style={{ color: T.textSec }}>indexes</span>}
            meta={table.indexes.loaded ? table.indexes.items.length || undefined : undefined}
            onClick={() => onToggleSubFolder(dsId, realSi, realTi, 'indexes')}
          />
          {table.indexes.open &&
            table.indexes.items.map((idx) => (
              <TreeRow
                key={idx.name}
                depth={6}
                hasChildren={false}
                icon={<IndexIcon color={idx.isUnique ? T.ok : T.textDim} />}
                label={
                  <span>
                    <span style={{ fontFamily: T.mono, fontSize: 12 }}>{idx.name}</span>
                    {idx.isUnique && (
                      <span style={{ fontSize: 9.5, color: T.ok, marginLeft: 6, fontWeight: 600 }}>
                        UNIQUE
                      </span>
                    )}
                    <span
                      style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, marginLeft: 8 }}
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
            data-testid={`subfolder-checks-${schemaName}-${table.name}`}
            depth={5}
            expanded={table.checks.open}
            icon={<CheckIcon />}
            label={<span style={{ color: T.textSec }}>checks</span>}
            meta={table.checks.loaded ? table.checks.items.length || undefined : undefined}
            onClick={() => onToggleSubFolder(dsId, realSi, realTi, 'checks')}
          />
          {table.checks.open &&
            table.checks.items.map((c) => (
              <TreeRow
                key={c.name}
                depth={6}
                hasChildren={false}
                icon={<CheckIcon />}
                label={
                  <span>
                    <span style={{ fontFamily: T.mono, fontSize: 11 }}>{c.name}</span>
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
}
