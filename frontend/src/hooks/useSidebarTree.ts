import { useCallback, useEffect, useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import { hydrateSchemaNodes, makeTableNode } from '../lib/sidebarNodes';
import type {
  CheckNode,
  DatabaseMetadata,
  ForeignKeyNode,
  IndexNode,
  KeyNode,
  SchemaNode,
  TableNode,
} from '../lib/sidebarTypes';

interface UseSidebarTreeArgs {
  activeDatasourceId: string | null;
  preloadedMetadata?: DatabaseMetadata | null;
  onRefreshMetadata?: () => Promise<void>;
}

// Owns the per-datasource lazy tree: schema/table/sub-folder state plus the
// loaders and toggle handlers. Extracted from Sidebar to keep the component
// focused on rendering. Behaviour is unchanged.
export function useSidebarTree({
  activeDatasourceId,
  preloadedMetadata,
  onRefreshMetadata,
}: UseSidebarTreeArgs) {
  const [schemasPerDs, setSchemasPerDs] = useState<Record<string, SchemaNode[]>>({});
  const [loadingDs, setLoadingDs] = useState<Set<string>>(new Set());
  const [expandedDs, setExpandedDs] = useState<Set<string>>(new Set());

  // Auto-expand the active connection when it changes
  useEffect(() => {
    if (activeDatasourceId) {
      setExpandedDs((prev) => new Set([...prev, activeDatasourceId]));
    }
  }, [activeDatasourceId]);

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

  // Lazily load a non-active connection's structure from the on-disk cache (no DB call).
  // Stores [] on empty/error so the "loaded-but-empty" state can render the placeholder.
  const loadCachedMetadata = useCallback(async (dsId: string) => {
    if (!dsId) return;
    setLoadingDs((prev) => new Set([...prev, dsId]));
    try {
      const cached = await GoApp.GetCachedMetadata(dsId);
      setSchemasPerDs((prev) => ({
        ...prev,
        [dsId]: hydrateSchemaNodes(cached, prev[dsId] ?? []),
      }));
    } catch (err) {
      console.error('Failed to load cached metadata for', dsId, err);
      setSchemasPerDs((prev) => ({ ...prev, [dsId]: prev[dsId] ?? [] }));
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
    setSchemasPerDs((prev) => ({
      ...prev,
      [activeDatasourceId]: hydrateSchemaNodes(preloadedMetadata, prev[activeDatasourceId] ?? []),
    }));
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
    const willOpen = !expandedDs.has(dsId);
    setExpandedDs((prev) => {
      const next = new Set(prev);
      if (next.has(dsId)) next.delete(dsId);
      else next.add(dsId);
      return next;
    });
    // Load structure on first expand. Active connection: live schemas (already connected).
    // Non-active: on-disk cache only — never opens a DB connection.
    if (willOpen && !schemasPerDs[dsId] && !loadingDs.has(dsId)) {
      if (dsId === activeDatasourceId) {
        loadSchemas(dsId);
      } else {
        loadCachedMetadata(dsId);
      }
    }
  };

  // ── Schema toggles ─────────────────────────────────────────────────────────
  const toggleSchema = async (dsId: string, idx: number) => {
    const schemas = schemasPerDs[dsId] ?? [];
    const schema = schemas[idx];
    if (!schema) return;
    if (!schema.loaded && !schema.expanded && dsId === activeDatasourceId) {
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
      if (!table.columns.loaded && dsId === activeDatasourceId) {
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
                                default: c.default ?? '',
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
    if (sub.loaded || dsId !== activeDatasourceId) {
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

  return {
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
  };
}
