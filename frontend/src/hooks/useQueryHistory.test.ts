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
