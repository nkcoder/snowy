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

  it('does not let a late cache overwrite a fresh live refresh', async () => {
    const fresh = main.DatabaseMetadata.createFrom({ schemas: [{ name: 'live', tables: [] }] });
    const cached = main.DatabaseMetadata.createFrom({ schemas: [{ name: 'stale', tables: [] }] });
    vi.mocked(GoApp.RefreshMetadata).mockResolvedValue(fresh);
    // Cache resolves on a later macrotask, after the live refresh has landed.
    vi.mocked(GoApp.GetCachedMetadata).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(cached), 10))
    );

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });

    await waitFor(() => expect(result.current.metadata).toEqual(fresh));
    // Let the delayed cache promise resolve; it must not clobber the fresh metadata.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.metadata).toEqual(fresh);
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

  it('swallows GetCompletions failure during connect and refresh without throwing', async () => {
    // Both the initial connect() fetch and the post-refresh fetch reject; the
    // hook must keep completions empty and still surface refreshed metadata.
    const meta = main.DatabaseMetadata.createFrom({ schemas: [{ name: 'public', tables: [] }] });
    vi.mocked(GoApp.RefreshMetadata).mockResolvedValue(meta);
    vi.mocked(GoApp.GetCompletions).mockRejectedValue(new Error('completions unavailable'));

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });

    await waitFor(() => expect(result.current.metadata).toEqual(meta));
    expect(result.current.completions).toEqual([]);
    expect(result.current.connectionWarning).toBeNull();
  });

  it('a successful refresh clears a prior warning for the same datasource', async () => {
    // First connect fails -> warning set for ds-1; reconnecting successfully clears it.
    vi.mocked(GoApp.RefreshMetadata).mockRejectedValueOnce(new Error('down'));

    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.connect('ds-1');
    });
    await waitFor(() =>
      expect(result.current.connectionWarning).toEqual({ dsId: 'ds-1', message: 'down' })
    );

    vi.mocked(GoApp.RefreshMetadata).mockResolvedValueOnce(
      main.DatabaseMetadata.createFrom({ schemas: [{ name: 'public', tables: [] }] })
    );
    await act(async () => {
      await result.current.refreshMetadata('ds-1');
    });

    expect(result.current.connectionWarning).toBeNull();
  });

  it('a refresh for one datasource leaves a warning for another intact', async () => {
    const { result } = renderHook(() => useDatasourceSession());
    // Seed a warning for ds-2 directly, then refresh ds-1 successfully.
    act(() => {
      result.current.setConnectionWarning({ dsId: 'ds-2', message: 'other down' });
    });
    await act(async () => {
      await result.current.refreshMetadata('ds-1');
    });
    expect(result.current.connectionWarning).toEqual({ dsId: 'ds-2', message: 'other down' });
  });

  it('disconnect is a no-op when nothing is connected', () => {
    const { result } = renderHook(() => useDatasourceSession());
    act(() => {
      result.current.disconnect();
    });
    expect(GoApp.ClosePool).not.toHaveBeenCalled();
    expect(result.current.activeDatasourceId).toBeNull();
  });
});
