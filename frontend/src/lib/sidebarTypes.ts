// Shared tree-node and metadata types for the Sidebar and its sub-components.

export interface ColumnNode {
  name: string;
  dataType: string;
  isNullable: string;
  keyType: string;
}

export interface KeyNode {
  name: string;
  columns: string;
}

export interface ForeignKeyNode {
  name: string;
  columns: string;
  refSchema: string;
  refTable: string;
  refColumns: string;
}

export interface IndexNode {
  name: string;
  isUnique: boolean;
  columns: string;
}

export interface CheckNode {
  name: string;
  definition: string;
}

// A lazily-loaded sub-section under a table node (columns, keys, foreign keys,
// indexes, checks). `loaded` is the cache flag: the first expansion fetches
// `items` from the backend and flips `loaded` true; every later open/close just
// toggles `open` and reads the cached `items` — no re-fetch. When metadata is
// preloaded from the cache, sub-folders are created already-loaded (see the
// `loaded: true` assignments in the metadata-hydration path).
export interface SubFolder<T> {
  open: boolean;
  items: T[];
  loaded: boolean;
}

export interface TableNode {
  name: string;
  type: 'table' | 'view';
  expanded: boolean;
  columns: SubFolder<ColumnNode>;
  keys: SubFolder<KeyNode>;
  foreignKeys: SubFolder<ForeignKeyNode>;
  indexes: SubFolder<IndexNode>;
  checks: SubFolder<CheckNode>;
}

export interface SchemaNode {
  name: string;
  expanded: boolean;
  tables: TableNode[];
  loaded: boolean;
}

export interface PreloadedTableMetadata {
  name: string;
  type: string;
  columns: ColumnNode[];
  keys: KeyNode[];
  foreignKeys: ForeignKeyNode[];
  indexes: IndexNode[];
  checks: CheckNode[];
}

export interface PreloadedSchemaMetadata {
  name: string;
  tables: PreloadedTableMetadata[];
}

export interface DatabaseMetadata {
  schemas: PreloadedSchemaMetadata[];
}
