import { describe, expect, it } from 'vitest';
import { emptyFolder, hydrateSchemaNodes, makeTableNode } from './sidebarNodes';
import type { DatabaseMetadata, SchemaNode } from './sidebarTypes';

describe('emptyFolder', () => {
  it('is closed, empty, and unloaded', () => {
    expect(emptyFolder()).toEqual({ open: false, items: [], loaded: false });
  });
});

describe('makeTableNode', () => {
  it('creates a collapsed table node with five empty sub-folders', () => {
    const node = makeTableNode('users', 'table');
    expect(node.name).toBe('users');
    expect(node.type).toBe('table');
    expect(node.expanded).toBe(false);
    for (const folder of [node.columns, node.keys, node.foreignKeys, node.indexes, node.checks]) {
      expect(folder).toEqual({ open: false, items: [], loaded: false });
    }
  });

  it('preserves the view type', () => {
    expect(makeTableNode('v_active', 'view').type).toBe('view');
  });
});

describe('hydrateSchemaNodes', () => {
  const metadata: DatabaseMetadata = {
    schemas: [
      {
        name: 'public',
        tables: [
          {
            name: 'users',
            type: 'BASE TABLE',
            columns: [
              { name: 'id', dataType: 'int4', isNullable: 'NO', default: '', keyType: 'pk' },
            ],
            keys: [{ name: 'users_pkey', columns: 'id' }],
            foreignKeys: [],
            indexes: [],
            checks: [],
          },
          {
            name: 'v_active',
            type: 'VIEW',
            columns: [],
            keys: [],
            foreignKeys: [],
            indexes: [],
            checks: [],
          },
        ],
      },
    ],
  };

  it('returns [] for null/undefined metadata', () => {
    expect(hydrateSchemaNodes(null, [])).toEqual([]);
    expect(hydrateSchemaNodes(undefined, [])).toEqual([]);
  });

  it('marks schemas, tables, and sub-folders as loaded', () => {
    const [schema] = hydrateSchemaNodes(metadata, []);
    expect(schema.loaded).toBe(true);
    const [users] = schema.tables;
    expect(users.columns.loaded).toBe(true);
    expect(users.columns.items).toHaveLength(1);
    expect(users.keys.items).toEqual([{ name: 'users_pkey', columns: 'id' }]);
  });

  it('maps VIEW type to view, others to table', () => {
    const [schema] = hydrateSchemaNodes(metadata, []);
    expect(schema.tables.find((t) => t.name === 'users')?.type).toBe('table');
    expect(schema.tables.find((t) => t.name === 'v_active')?.type).toBe('view');
  });

  it('preserves expand/open state from existing nodes', () => {
    const existing: SchemaNode[] = [
      {
        name: 'public',
        expanded: true,
        loaded: true,
        tables: [
          {
            name: 'users',
            type: 'table',
            expanded: true,
            columns: { open: true, loaded: true, items: [] },
            keys: { open: false, loaded: true, items: [] },
            foreignKeys: { open: false, loaded: true, items: [] },
            indexes: { open: false, loaded: true, items: [] },
            checks: { open: false, loaded: true, items: [] },
          },
        ],
      },
    ];
    const [schema] = hydrateSchemaNodes(metadata, existing);
    expect(schema.expanded).toBe(true);
    const users = schema.tables.find((t) => t.name === 'users');
    expect(users?.expanded).toBe(true);
    expect(users?.columns.open).toBe(true);
  });

  it('defaults expand/open to false for schemas with no existing state', () => {
    const [schema] = hydrateSchemaNodes(metadata, []);
    expect(schema.expanded).toBe(false);
    expect(schema.tables[0].expanded).toBe(false);
    expect(schema.tables[0].columns.open).toBe(false);
  });
});
