import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSidebarTree } from './useSidebarTree';

vi.mock('../../wailsjs/go/main/App');

import * as GoApp from '../../wailsjs/go/main/App';

// Drive the hook through its live-load path (activeDatasourceId set, no
// onRefreshMetadata) so sub-folders are loaded:false and the loader/catch
// branches are actually exercised — the paths the Sidebar component tests and
// e2e don't reach.
async function loadTree() {
  vi.mocked(GoApp.ListSchemas).mockResolvedValue([
    { name: 'public' } as Awaited<ReturnType<typeof GoApp.ListSchemas>>[number],
  ]);
  vi.mocked(GoApp.ListTables).mockResolvedValue([
    { name: 'users', type: 'BASE TABLE' } as Awaited<ReturnType<typeof GoApp.ListTables>>[number],
  ]);

  const view = renderHook(() => useSidebarTree({ activeDatasourceId: 'ds-1' }));

  // fallback effect auto-loads schemas
  await waitFor(() => expect(view.result.current.schemasPerDs['ds-1']).toBeDefined());
  // expand schema -> live-loads the (unloaded) table
  await act(async () => {
    await view.result.current.toggleSchema('ds-1', 0);
  });
  await waitFor(() => expect(view.result.current.schemasPerDs['ds-1'][0].tables).toHaveLength(1));
  return view;
}

describe('useSidebarTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSchemas).mockResolvedValue([]);
    vi.mocked(GoApp.ListTables).mockResolvedValue([]);
    vi.mocked(GoApp.ListColumns).mockResolvedValue([]);
    vi.mocked(GoApp.ListTableKeys).mockResolvedValue([]);
    vi.mocked(GoApp.ListTableForeignKeys).mockResolvedValue([]);
    vi.mocked(GoApp.ListTableIndexes).mockResolvedValue([]);
    vi.mocked(GoApp.ListTableChecks).mockResolvedValue([]);
  });

  it('toggleColumnsFolder flips columns open/closed', async () => {
    const view = await loadTree();
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].columns.open).toBe(false);
    act(() => view.result.current.toggleColumnsFolder('ds-1', 0, 0));
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].columns.open).toBe(true);
    act(() => view.result.current.toggleColumnsFolder('ds-1', 0, 0));
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].columns.open).toBe(false);
  });

  it('toggleColumnsFolder is a no-op for an out-of-range table', async () => {
    const view = await loadTree();
    // guard: table lookup returns undefined -> early return, no throw
    act(() => view.result.current.toggleColumnsFolder('ds-1', 9, 9));
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].columns.open).toBe(false);
  });

  it('swallows a ListColumns failure when expanding a table', async () => {
    const view = await loadTree();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(GoApp.ListColumns).mockRejectedValueOnce(new Error('columns boom'));

    await act(async () => {
      await view.result.current.toggleTable('ds-1', 0, 0);
    });

    // table still expands; the load error is swallowed (logged, not thrown)
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].expanded).toBe(true);
    expect(err).toHaveBeenCalledWith('Failed to load columns', expect.any(Error));
    err.mockRestore();
  });

  it('swallows a sub-folder load failure', async () => {
    const view = await loadTree();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(GoApp.ListTableKeys).mockRejectedValueOnce(new Error('keys boom'));

    await act(async () => {
      await view.result.current.toggleTableSubFolder('ds-1', 0, 0, 'keys');
    });

    expect(err).toHaveBeenCalledWith('Failed to load keys', expect.any(Error));
    err.mockRestore();
  });

  it('loads each sub-folder type on first open', async () => {
    const view = await loadTree();
    for (const folder of ['keys', 'foreignKeys', 'indexes', 'checks'] as const) {
      await act(async () => {
        await view.result.current.toggleTableSubFolder('ds-1', 0, 0, folder);
      });
      expect(view.result.current.schemasPerDs['ds-1'][0].tables[0][folder].open).toBe(true);
      expect(view.result.current.schemasPerDs['ds-1'][0].tables[0][folder].loaded).toBe(true);
    }
    expect(GoApp.ListTableKeys).toHaveBeenCalled();
    expect(GoApp.ListTableForeignKeys).toHaveBeenCalled();
    expect(GoApp.ListTableIndexes).toHaveBeenCalled();
    expect(GoApp.ListTableChecks).toHaveBeenCalled();
  });

  it('toggleTableSubFolder closes an already-open folder without reloading', async () => {
    const view = await loadTree();
    await act(async () => {
      await view.result.current.toggleTableSubFolder('ds-1', 0, 0, 'keys');
    });
    vi.mocked(GoApp.ListTableKeys).mockClear();
    await act(async () => {
      await view.result.current.toggleTableSubFolder('ds-1', 0, 0, 'keys');
    });
    expect(view.result.current.schemasPerDs['ds-1'][0].tables[0].keys.open).toBe(false);
    expect(GoApp.ListTableKeys).not.toHaveBeenCalled();
  });
});
