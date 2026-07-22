import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../wailsjs/go/models';
import { useQueryHistory } from './useQueryHistory';

vi.mock('../../wailsjs/go/main/App');

import * as GoApp from '../../wailsjs/go/main/App';

describe('useQueryHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts closed with no entries', () => {
    const { result } = renderHook(() => useQueryHistory('ds-1'));
    expect(result.current.historyOpen).toBe(false);
    expect(result.current.historyEntries).toEqual([]);
    expect(result.current.historyLoading).toBe(false);
  });

  it('openHistory is a no-op when no datasource is active', async () => {
    const { result } = renderHook(() => useQueryHistory(null));
    await act(async () => {
      await result.current.openHistory();
    });
    expect(GoApp.GetQueryHistory).not.toHaveBeenCalled();
    expect(result.current.historyOpen).toBe(false);
  });

  it('openHistory opens the drawer and loads entries', async () => {
    const entries = [main.HistoryEntry.createFrom({ id: '1', sql: 'SELECT 1' })];
    vi.mocked(GoApp.GetQueryHistory).mockResolvedValue(entries);

    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });

    expect(GoApp.GetQueryHistory).toHaveBeenCalledWith('ds-1', 100);
    expect(result.current.historyOpen).toBe(true);
    expect(result.current.historyEntries).toEqual(entries);
    expect(result.current.historyLoading).toBe(false);
  });

  it('openHistory coerces a null result to an empty array', async () => {
    // Go nil slices deserialize as JSON null; the hook must default to [].
    vi.mocked(GoApp.GetQueryHistory).mockResolvedValue(null as unknown as main.HistoryEntry[]);

    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });

    expect(result.current.historyEntries).toEqual([]);
    expect(result.current.historyLoading).toBe(false);
  });

  it('openHistory clears entries and stops loading on error', async () => {
    vi.mocked(GoApp.GetQueryHistory).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });

    expect(result.current.historyOpen).toBe(true);
    expect(result.current.historyEntries).toEqual([]);
    expect(result.current.historyLoading).toBe(false);
  });

  it('clearHistory is a no-op when no datasource is active', async () => {
    const { result } = renderHook(() => useQueryHistory(null));
    await act(async () => {
      await result.current.clearHistory();
    });
    expect(GoApp.ClearHistory).not.toHaveBeenCalled();
  });

  it('clearHistory wipes entries via the backend', async () => {
    const entries = [main.HistoryEntry.createFrom({ id: '1', sql: 'SELECT 1' })];
    vi.mocked(GoApp.GetQueryHistory).mockResolvedValue(entries);
    vi.mocked(GoApp.ClearHistory).mockResolvedValue(undefined);

    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });
    expect(result.current.historyEntries).toEqual(entries);

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(GoApp.ClearHistory).toHaveBeenCalledWith('ds-1');
    expect(result.current.historyEntries).toEqual([]);
  });

  it('clearHistory leaves entries intact on error', async () => {
    const entries = [main.HistoryEntry.createFrom({ id: '1', sql: 'SELECT 1' })];
    vi.mocked(GoApp.GetQueryHistory).mockResolvedValue(entries);
    vi.mocked(GoApp.ClearHistory).mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });

    await act(async () => {
      await result.current.clearHistory();
    });

    expect(warn).toHaveBeenCalled();
    expect(result.current.historyEntries).toEqual(entries);
    warn.mockRestore();
  });

  it('closeHistory closes the drawer', async () => {
    vi.mocked(GoApp.GetQueryHistory).mockResolvedValue([]);
    const { result } = renderHook(() => useQueryHistory('ds-1'));
    await act(async () => {
      await result.current.openHistory();
    });
    expect(result.current.historyOpen).toBe(true);

    act(() => {
      result.current.closeHistory();
    });
    await waitFor(() => expect(result.current.historyOpen).toBe(false));
  });
});
