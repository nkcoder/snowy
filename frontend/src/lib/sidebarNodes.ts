import type { DatabaseMetadata, SchemaNode, SubFolder, TableNode } from './sidebarTypes';

export function emptyFolder<T>(): SubFolder<T> {
  return { open: false, items: [], loaded: false };
}

export function makeTableNode(name: string, type: 'table' | 'view'): TableNode {
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

// Build SchemaNode[] from backend metadata, preserving expand/open state from
// any existing nodes. Everything is marked loaded:true so deeper expansion reads
// from cache (no DB call).
export function hydrateSchemaNodes(
  metadata: DatabaseMetadata | null | undefined,
  existing: SchemaNode[]
): SchemaNode[] {
  if (!metadata?.schemas) return [];
  return metadata.schemas.map((s) => {
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
          checks: { open: existingTable?.checks.open ?? false, loaded: true, items: t.checks },
        };
      }),
    };
  });
}
