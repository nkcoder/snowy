import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../wailsjs/go/models';
import { useDatasourceSession } from './useDatasourceSession';

vi.mock('../../wailsjs/go/main/App');

import * as GoApp from '../../wailsjs/go/main/App';

describe('useDatasourceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(GoApp.ListSavedQueries).mockResolvedValue([]);
    vi.mocked(GoApp.GetCompletions).mockResolvedValue(
      main.CompletionSet.createFrom({ entries: [] })
    );
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValue(
      main.DatabaseMetadata.createFrom({ schemas: [] })
    );
    vi.mocked(GoApp.RefreshMetadata).mockResolvedValue(
      main.DatabaseMetadata.createFrom({ schemas: [] })
    );
    vi.mocked(GoApp.ClosePool).mockResolvedValue(undefined);
  });

  it('starts with no active datasource', () => {
    const { result } = renderHook(() => useDatasourceSession());
    expect(result.current.activeDatasourceId).toBeNull();
    expect(result.current.savedQueries).toEqual([]);
    expect(result.current.completions).toEqual([]);
    expect(result.current.metadata).toBeNull();
    expect(result.current.connectionWarning).toBeNull();
  });

  it('connect loads saved queries, completions, and refreshed metadata', async () => {
    const meta = main.DatabaseMetadata.createFrom({ schemas: [{ name: 'public', tables: [] }] });
    vi.mocked(GoApp.ListSavedQueries).mockResolvedValue([{ filename: 'a.sql' }]);
    vi.mocked(GoApp.RefreshMetadata).mockResolvedValue(meta);
    vi.mocked(GoApp.GetCompletions).mockResolvedValue(
      main.CompletionSet.createFrom({ entries: [{ label: 'users', type: 'table' }] })
    );

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });

    expect(result.current.activeDatasourceId).toBe('ds-1');
    expect(GoApp.ListSavedQueries).toHaveBeenCalledWith('ds-1');
    expect(GoApp.GetCachedMetadata).toHaveBeenCalledWith('ds-1');
    expect(GoApp.RefreshMetadata).toHaveBeenCalledWith('ds-1');

    await waitFor(() => expect(result.current.savedQueries).toEqual([{ filename: 'a.sql' }]));
    await waitFor(() => expect(result.current.metadata).toEqual(meta));
    expect(result.current.connectionWarning).toBeNull();
  });

  it('connect surfaces a connection warning when the live refresh fails', async () => {
    vi.mocked(GoApp.RefreshMetadata).mockRejectedValue(new Error('unreachable'));

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });

    await waitFor(() =>
      expect(result.current.connectionWarning).toEqual({ dsId: 'ds-1', message: 'unreachable' })
    );
  });

  it('connect shows cached metadata immediately when the cache is non-empty', async () => {
    const cached = main.DatabaseMetadata.createFrom({ schemas: [{ name: 'cached', tables: [] }] });
    vi.mocked(GoApp.GetCachedMetadata).mockResolvedValue(cached);
    // Keep the live refresh pending so the cached value is what we observe.
    vi.mocked(GoApp.RefreshMetadata).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });

    await waitFor(() => expect(result.current.metadata).toEqual(cached));
  });

  it('disconnect closes the pool and clears the active datasource', async () => {
    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });
    await waitFor(() => expect(result.current.activeDatasourceId).toBe('ds-1'));

    act(() => {
      result.current.disconnect();
    });

    expect(GoApp.ClosePool).toHaveBeenCalledWith('ds-1');
    expect(result.current.activeDatasourceId).toBeNull();
    expect(result.current.metadata).toBeNull();
  });
});
