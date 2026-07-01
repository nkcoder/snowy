import { useRef, useState } from 'react';
import * as GoApp from '../../wailsjs/go/main/App';
import type { ResultTab } from '../components/ResultsPanel';

function makeLiveResultTab(): ResultTab {
  return {
    id: 'live',
    label: 'Result 1',
    data: null,
    error: null,
    rowCount: 0,
    durationMs: 0,
    truncated: false,
    timestamp: new Date(),
    pinned: false,
    sql: '',
  };
}

// Result-tab model: there is always exactly ONE "live" tab (`pinned === false`)
// plus zero or more pinned tabs. Each query overwrites the live tab in place;
// pinning snapshots the live tab and spawns a fresh empty live tab. This
// `!t.pinned` invariant is load-bearing — it's how every handler below finds
// "the tab to write the next result into" without tracking a separate id.
export function useQueryExecution(activeDatasourceId: string | null) {
  // Monotonic counter for "Result N" labels; reset by resetResults on connect.
  const seqRef = useRef(0);
  const [queryLoading, setQueryLoading] = useState(false);
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([makeLiveResultTab()]);
  const [activeResultTabId, setActiveResultTabId] = useState<string>('live');

  const resetResults = () => {
    seqRef.current = 0;
    const live = makeLiveResultTab();
    setResultTabs([live]);
    setActiveResultTabId('live');
  };

  const handleRunQuery = async (sql: string) => {
    if (!activeDatasourceId) return;
    setQueryLoading(true);
    try {
      const result = await GoApp.ExecuteQuery(activeDatasourceId, sql);
      // A result set (SELECT) has columns and reports rows returned; a non-SELECT
      // (INSERT/UPDATE/DDL) has no columns, so we surface rows *affected* instead.
      const isResultSet = (result.columns?.length ?? 0) > 0;
      const rowCount = isResultSet
        ? (result.rowCount ?? result.rows?.length ?? 0)
        : (result.rowsAffected ?? 0);
      const durationMs = result.durationMs ?? 0;
      const truncated = result.truncated ?? false;
      seqRef.current++;
      const label = `Result ${seqRef.current}`;
      setResultTabs((prev) =>
        prev.map((t) =>
          !t.pinned
            ? {
                ...t,
                label,
                data: result,
                error: null,
                rowCount,
                durationMs,
                truncated,
                sql,
                timestamp: new Date(),
              }
            : t
        )
      );
      setActiveResultTabId('live');
      GoApp.RecordHistory(activeDatasourceId, sql, rowCount, durationMs).catch(() => {});
    } catch (err: unknown) {
      const message =
        typeof err === 'string' ? err : err instanceof Error ? err.message : String(err);
      seqRef.current++;
      setResultTabs((prev) =>
        prev.map((t) =>
          !t.pinned
            ? {
                ...t,
                label: `Result ${seqRef.current}`,
                data: null,
                error: message,
                rowCount: 0,
                durationMs: 0,
                sql,
                timestamp: new Date(),
              }
            : t
        )
      );
      setActiveResultTabId('live');
    } finally {
      setQueryLoading(false);
    }
  };

  // Pin: freeze the current live result under a stable id, then append a new
  // empty live tab so the next query has somewhere to land.
  const handlePinResult = () => {
    const liveTab = resultTabs.find((t) => !t.pinned);
    if (!liveTab?.data) return;
    const pinnedId = `result-pin-${Date.now()}`;
    const pinned: ResultTab = { ...liveTab, id: pinnedId, pinned: true };
    const newLive = makeLiveResultTab();
    setResultTabs((prev) => [...prev.map((t) => (t.id === liveTab.id ? pinned : t)), newLive]);
    setActiveResultTabId(pinnedId);
  };

  const handleCloseResultTab = (id: string) => {
    setResultTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeResultTabId === id) {
        setActiveResultTabId(next[next.length - 1]?.id ?? 'live');
      }
      return next;
    });
  };

  const handleUnpinResult = (id: string) => {
    const pinned = resultTabs.find((t) => t.id === id);
    if (!pinned) return;
    setResultTabs((prev) =>
      prev
        .filter((t) => t.id !== id)
        .map((t) => (t.pinned ? t : { ...pinned, id: 'live', pinned: false }))
    );
    setActiveResultTabId('live');
  };

  return {
    queryLoading,
    resultTabs,
    activeResultTabId,
    setActiveResultTabId,
    handleRunQuery,
    handlePinResult,
    handleCloseResultTab,
    handleUnpinResult,
    resetResults,
  };
}
