import { useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';

// useQueryHistory owns the history-drawer state: whether it's open, the loaded
// entries, and the loading flag. openHistory fetches the latest 100 entries for
// the active datasource; selecting an entry is left to the caller (it touches
// tab state).
export function useQueryHistory(activeDatasourceId: string | null) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<main.HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async () => {
    if (!activeDatasourceId) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const entries = await GoApp.GetQueryHistory(activeDatasourceId, 100);
      setHistoryEntries(entries ?? []);
    } catch (err) {
      console.warn('GetQueryHistory failed', err);
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => setHistoryOpen(false);

  const clearHistory = async () => {
    if (!activeDatasourceId) return;
    try {
      await GoApp.ClearHistory(activeDatasourceId);
      setHistoryEntries([]);
    } catch (err) {
      console.warn('ClearHistory failed', err);
    }
  };

  return { historyOpen, historyEntries, historyLoading, openHistory, closeHistory, clearHistory };
}
