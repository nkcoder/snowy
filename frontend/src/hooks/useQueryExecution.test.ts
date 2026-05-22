import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { main } from '../../wailsjs/go/models';
import { useQueryExecution } from './useQueryExecution';

vi.mock('../../wailsjs/go/main/App');

import * as GoApp from '../../wailsjs/go/main/App';

describe('useQueryExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with a single live result tab', () => {
    const { result } = renderHook(() => useQueryExecution('ds-1'));
    expect(result.current.resultTabs).toHaveLength(1);
    expect(result.current.resultTabs[0].id).toBe('live');
    expect(result.current.resultTabs[0].pinned).toBe(false);
    expect(result.current.activeResultTabId).toBe('live');
    expect(result.current.queryLoading).toBe(false);
  });

  it('does nothing when activeDatasourceId is null', async () => {
    const { result } = renderHook(() => useQueryExecution(null));
    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });
    expect(GoApp.ExecuteQuery).not.toHaveBeenCalled();
  });

  it('handleRunQuery on success updates live tab data', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: ['id'],
      rows: [[1]],
      rowCount: 1,
      durationMs: 10,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT id FROM t');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.data?.columns).toEqual(['id']);
    expect(liveTab?.error).toBeNull();
    expect(liveTab?.rowCount).toBe(1);
    expect(liveTab?.durationMs).toBe(10);
    expect(liveTab?.sql).toBe('SELECT id FROM t');
    expect(result.current.queryLoading).toBe(false);
  });

  it('handleRunQuery on error sets error field', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockRejectedValueOnce(new Error('syntax error'));

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('INVALID SQL');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.error).toBe('syntax error');
    expect(liveTab?.data).toBeNull();
    expect(result.current.queryLoading).toBe(false);
  });

  it('handleRunQuery sets queryLoading true during execution', async () => {
    let resolveQuery!: (v: main.QueryResult | PromiseLike<main.QueryResult>) => void;
    vi.mocked(GoApp.ExecuteQuery).mockReturnValueOnce(
      new Promise<main.QueryResult>((res) => {
        resolveQuery = res;
      })
    );

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    act(() => {
      void result.current.handleRunQuery('SELECT 1');
    });

    expect(result.current.queryLoading).toBe(true);

    await act(async () => {
      resolveQuery({ columns: [], rows: [], rowCount: 0, durationMs: 0, truncated: false });
    });

    expect(result.current.queryLoading).toBe(false);
  });

  it('handlePinResult does nothing when no data', () => {
    const { result } = renderHook(() => useQueryExecution('ds-1'));
    const tabsBefore = result.current.resultTabs;
    act(() => result.current.handlePinResult());
    expect(result.current.resultTabs).toEqual(tabsBefore);
  });

  it('handlePinResult pins live tab and creates new live tab', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: ['id'],
      rows: [[1]],
      rowCount: 1,
      durationMs: 5,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    act(() => result.current.handlePinResult());

    const tabs = result.current.resultTabs;
    const pinned = tabs.filter((t) => t.pinned);
    const live = tabs.filter((t) => !t.pinned);
    expect(pinned).toHaveLength(1);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe('live');
    expect(pinned[0].data?.columns).toEqual(['id']);
  });

  it('handleCloseResultTab removes pinned tab', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    act(() => result.current.handlePinResult());

    const pinnedId = result.current.resultTabs.find((t) => t.pinned)!.id;

    act(() => result.current.handleCloseResultTab(pinnedId));

    expect(result.current.resultTabs.find((t) => t.id === pinnedId)).toBeUndefined();
    expect(result.current.activeResultTabId).toBe('live');
  });

  it('handleUnpinResult restores pinned to live', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: ['x'],
      rows: [[42]],
      rowCount: 1,
      durationMs: 1,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT x FROM t');
    });

    act(() => result.current.handlePinResult());

    const pinnedId = result.current.resultTabs.find((t) => t.pinned)!.id;

    act(() => result.current.handleUnpinResult(pinnedId));

    const tabs = result.current.resultTabs;
    expect(tabs.every((t) => !t.pinned)).toBe(true);
    const live = tabs.find((t) => t.id === 'live');
    expect(live?.data?.columns).toEqual(['x']);
    expect(result.current.activeResultTabId).toBe('live');
  });

  it('handleUnpinResult does nothing for unknown id', () => {
    const { result } = renderHook(() => useQueryExecution('ds-1'));
    const before = result.current.resultTabs.length;
    act(() => result.current.handleUnpinResult('ghost'));
    expect(result.current.resultTabs.length).toBe(before);
  });

  it('resetResults returns to initial state', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: ['id'],
      rows: [[1]],
      rowCount: 1,
      durationMs: 5,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    act(() => result.current.handlePinResult());
    expect(result.current.resultTabs.length).toBeGreaterThan(1);

    act(() => result.current.resetResults());

    expect(result.current.resultTabs).toHaveLength(1);
    expect(result.current.resultTabs[0].id).toBe('live');
    expect(result.current.resultTabs[0].data).toBeNull();
    expect(result.current.activeResultTabId).toBe('live');
  });

  it('handles string error thrown by ExecuteQuery', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockRejectedValueOnce('query failed');

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('BAD');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.error).toBe('query failed');
  });

  it('uses rows.length as rowCount when rowCount is missing', async () => {
    // Cover the `result.rowCount ?? result.rows?.length ?? 0` fallback branch
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: ['id'],
      rows: [[1], [2], [3]],
      rowCount: undefined as unknown as number,
      durationMs: 0,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.rowCount).toBe(3); // falls back to rows.length
  });

  it('uses 0 as rowCount when both rowCount and rows are missing', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: [],
      rows: undefined as unknown as never[][],
      rowCount: undefined as unknown as number,
      durationMs: undefined as unknown as number,
      truncated: undefined as unknown as boolean,
    });
    vi.mocked(GoApp.RecordHistory).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.rowCount).toBe(0);
    expect(liveTab?.durationMs).toBe(0);
    expect(liveTab?.truncated).toBe(false);
  });

  it('handles non-Error non-string thrown from ExecuteQuery', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockRejectedValueOnce({ code: 500 });

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    await act(async () => {
      await result.current.handleRunQuery('FAIL');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.error).toBeTruthy();
  });

  it('RecordHistory failure is silently swallowed', async () => {
    vi.mocked(GoApp.ExecuteQuery).mockResolvedValueOnce({
      columns: [],
      rows: [],
      rowCount: 0,
      durationMs: 0,
      truncated: false,
    });
    vi.mocked(GoApp.RecordHistory).mockRejectedValueOnce(new Error('history write failed'));

    const { result } = renderHook(() => useQueryExecution('ds-1'));

    // Should not throw even when RecordHistory fails
    await act(async () => {
      await result.current.handleRunQuery('SELECT 1');
    });

    const liveTab = result.current.resultTabs.find((t) => !t.pinned);
    expect(liveTab?.error).toBeNull(); // success despite history failure
  });
});
